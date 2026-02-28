"""
MIDI-LLM Service — Text-to-MIDI generation using a fine-tuned Llama 3.2 1B model.

Lazy-loads the model on first request. Uses INT4 (NF4) quantization for speed on 6GB VRAM.
This file is completely self-contained. To remove the MIDI-LLM feature,
simply delete this file and the corresponding router.

Model: https://huggingface.co/slseanwu/MIDI-LLM_Llama-3.2-1B
Paper: https://arxiv.org/abs/2511.03942
"""

import logging
import time
import tempfile
import os
from typing import List, Dict, Any, Optional
from pathlib import Path

logger = logging.getLogger("midi_llm_service")

# ── Constants from MIDI-LLM ──────────────────────────────────────────────────
AMT_GPT2_BOS_ID = 55026
LLAMA_VOCAB_SIZE = 128256
MODEL_ID = "slseanwu/MIDI-LLM_Llama-3.2-1B"
SYSTEM_PROMPT = "You are a world-class composer. Please compose some music according to the following description: "

# ── Note name helper ──────────────────────────────────────────────────────────
NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

def midi_note_to_name(note_number: int) -> str:
    octave = (note_number // 12) - 1
    return f"{NOTE_NAMES[note_number % 12]}{octave}"


class MidiLLMService:
    """Singleton service for MIDI-LLM model management and generation."""

    def __init__(self):
        self._model = None
        self._tokenizer = None
        self._status = "idle"        # idle | loading | available | unavailable
        self._unavailable_reason = ""
        self._device = None

    @property
    def status(self) -> str:
        return self._status

    @property
    def unavailable_reason(self) -> str:
        return self._unavailable_reason

    def _check_dependencies(self) -> bool:
        """Check if all required packages are installed."""
        try:
            import torch
            if not torch.cuda.is_available():
                self._unavailable_reason = "CUDA GPU not available"
                return False
            import transformers
            import anticipation
            return True
        except ImportError as e:
            self._unavailable_reason = f"Missing dependency: {e.name}"
            return False

    def load_model(self):
        """Load the MIDI-LLM model with INT8 quantization. Call once."""
        if self._status in ("available", "loading"):
            return

        if not self._check_dependencies():
            self._status = "unavailable"
            logger.warning(f"MIDI-LLM unavailable: {self._unavailable_reason}")
            return

        self._status = "loading"
        logger.info("Loading MIDI-LLM model (INT4/NF4 quantization)...")

        # Try loading, retry with force_download if file is corrupted
        for attempt, force_dl in enumerate([False, True]):
            try:
                import torch
                from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

                quantization_config = BitsAndBytesConfig(
                    load_in_4bit=True,
                    bnb_4bit_compute_dtype=torch.float16,
                    bnb_4bit_quant_type="nf4",
                    bnb_4bit_use_double_quant=True,
                )

                if force_dl:
                    logger.info("Retrying with force_download=True (re-downloading model)...")

                self._tokenizer = AutoTokenizer.from_pretrained(
                    MODEL_ID,
                    pad_token="<|eot_id|>",
                    force_download=force_dl,
                )

                self._model = AutoModelForCausalLM.from_pretrained(
                    MODEL_ID,
                    quantization_config=quantization_config,
                    device_map="auto",
                    trust_remote_code=True,
                    force_download=force_dl,
                )
                self._model.eval()

                self._device = next(self._model.parameters()).device
                self._status = "available"
                logger.info(f"MIDI-LLM model loaded successfully on {self._device}")
                return  # Success, exit loop

            except Exception as e:
                error_msg = str(e).lower()
                # If it's a corrupted download, retry with force_download
                if attempt == 0 and ("consistency check" in error_msg or "file should be of size" in error_msg):
                    logger.warning(f"Corrupted download detected, will retry: {e}")
                    continue
                # Final failure
                self._status = "unavailable"
                self._unavailable_reason = str(e)
                logger.error(f"Failed to load MIDI-LLM model: {e}")

    def generate(
        self,
        prompt: str,
        temperature: float = 1.0,
        top_p: float = 0.98,
        max_tokens: int = 2046,
    ) -> Dict[str, Any]:
        """
        Generate MIDI from a text prompt.

        Returns dict with:
            - notes: list of {noteName, note, start, duration, velocity}
            - midi_bytes: raw .mid file content (bytes)
            - generation_time: float seconds
            - total_notes: int
        """
        if self._status != "available":
            raise RuntimeError(f"MIDI-LLM model not available: {self._unavailable_reason or self._status}")

        import torch
        from anticipation.convert import events_to_midi

        # ── Tokenize prompt ──────────────────────────────────────────────
        full_prompt = SYSTEM_PROMPT + prompt + " "
        llama_input = self._tokenizer(full_prompt, return_tensors="pt", padding=False)
        input_ids = llama_input["input_ids"]

        # Append MIDI BOS token
        midi_bos = torch.tensor([[AMT_GPT2_BOS_ID + LLAMA_VOCAB_SIZE]])
        input_ids = torch.cat([input_ids, midi_bos], dim=1).to(self._device)

        # ── Generate ─────────────────────────────────────────────────────
        start_time = time.time()

        with torch.no_grad():
            outputs = self._model.generate(
                input_ids=input_ids,
                do_sample=True,
                max_new_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                num_return_sequences=1,
                pad_token_id=self._tokenizer.pad_token_id,
            )

        generation_time = time.time() - start_time
        logger.info(f"MIDI-LLM generation took {generation_time:.2f}s")

        # ── Extract generated tokens ─────────────────────────────────────
        prompt_len = input_ids.shape[1]
        generated = outputs[0, prompt_len:]

        # Shift tokens back to MIDI vocab range
        midi_tokens = (generated - LLAMA_VOCAB_SIZE).cpu().tolist()

        # ── Validate ─────────────────────────────────────────────────────
        if self._has_excessive_notes(midi_tokens):
            raise RuntimeError("Generation failed validation (excessive simultaneous notes). Try again with a different prompt or lower temperature.")

        # ── Convert tokens → MIDI file ───────────────────────────────────
        midi_obj = events_to_midi(midi_tokens)

        # Save to temp file to read back as bytes
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mid") as tmp:
                tmp_path = tmp.name
            midi_obj.save(tmp_path)
            with open(tmp_path, "rb") as f:
                midi_bytes = f.read()
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

        # ── Parse MIDI file → note list ──────────────────────────────────
        notes = self._parse_midi_to_notes(midi_bytes)

        return {
            "notes": notes,
            "midi_bytes": midi_bytes,
            "generation_time": round(generation_time, 2),
            "total_notes": len(notes),
        }

    def _has_excessive_notes(self, tokens: list, max_per_time: int = 64) -> bool:
        """Check for degenerate output with too many simultaneous notes."""
        import torch
        t = torch.tensor(tokens)
        if len(t) < 3:
            return True  # Too few tokens = empty generation
        times = t[::3]
        counts = torch.bincount(times)
        return torch.any(counts > max_per_time).item()

    def _parse_midi_to_notes(self, midi_bytes: bytes) -> List[Dict[str, Any]]:
        """
        Parse a .mid file (bytes) into the note format the frontend expects:
        { noteName, note, start (beats), duration (beats), velocity (0-1) }
        """
        import mido

        mid = mido.MidiFile(file=__import__("io").BytesIO(midi_bytes))

        # Get tempo (microseconds per beat), default 120 BPM
        tempo = 500000  # default
        for track in mid.tracks:
            for msg in track:
                if msg.type == 'set_tempo':
                    tempo = msg.tempo
                    break

        ticks_per_beat = mid.ticks_per_beat or 480

        notes = []
        # Track active notes per channel: (channel, pitch) -> (start_tick, velocity)
        active = {}

        for track in mid.tracks:
            abs_tick = 0
            for msg in track:
                abs_tick += msg.time

                if msg.type == 'note_on' and msg.velocity > 0:
                    key = (msg.channel, msg.note)
                    active[key] = (abs_tick, msg.velocity)

                elif msg.type == 'note_off' or (msg.type == 'note_on' and msg.velocity == 0):
                    key = (msg.channel, msg.note)
                    if key in active:
                        start_tick, velocity = active.pop(key)
                        duration_ticks = abs_tick - start_tick
                        if duration_ticks > 0:
                            start_beats = start_tick / ticks_per_beat
                            duration_beats = duration_ticks / ticks_per_beat
                            notes.append({
                                "note": msg.note,
                                "noteName": midi_note_to_name(msg.note),
                                "start": round(start_beats, 4),
                                "duration": round(duration_beats, 4),
                                "velocity": round(min(velocity / 127.0, 1.0), 3),
                            })

        notes.sort(key=lambda n: (n["start"], n["note"]))
        return notes


# ── Module-level singleton ────────────────────────────────────────────────────
midi_llm_service = MidiLLMService()
