"""
Lyria RealTime Music Generation WebSocket Proxy
================================================
Proxies between the frontend WebSocket and Google's Lyria RealTime model
via the Gemini API. No API keys are exposed to the frontend.

Protocol (Frontend ↔ Backend):
  → Client sends: { "prompt": str, "bpm": int, "temperature": float }
  ← Server sends: { "type": "audio", "data": "<base64 PCM>" }
  ← Server sends: { "type": "status", "status": "connecting"|"generating"|"playing"|"stopped" }
  ← Server sends: { "type": "error", "message": str }
  → Client sends: { "type": "stop" } or closes connection
"""

import os
import json
import base64
import asyncio
import logging
import time
import uuid
import wave
from typing import List
from pydantic import BaseModel
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException

router = APIRouter()
logger = logging.getLogger("lyria_music")
logging.basicConfig(level=logging.INFO)


def _get_gemini_client():
    """Create a Gemini client using the GEMINI_API_KEY env var."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError(
            "GEMINI_API_KEY environment variable is not set. "
            "Set it before starting the backend."
        )
    try:
        from google import genai
        return genai.Client(api_key=api_key, http_options={"api_version": "v1alpha"})
    except ImportError:
        logger.error("google-genai library not found. Please run: pip install google-genai")
        raise ValueError("Backend missing 'google-genai' dependency.")


async def _send_json(ws: WebSocket, data: dict):
    """Send a JSON message to the frontend WebSocket."""
    try:
        await ws.send_text(json.dumps(data))
    except Exception:
        pass  # Client may have disconnected


async def _run_lyria_session(ws: WebSocket, prompt: str, bpm: int, temperature: float):
    """
    Open a Lyria session inside a proper async context manager,
    stream audio chunks to the frontend WebSocket, and listen for stop.
    """
    try:
        from google.genai import types
    except ImportError:
        await _send_json(ws, {"type": "error", "message": "Backend missing 'google-genai' dependency."})
        return

    client = _get_gemini_client()
    stop_event = asyncio.Event()
    chunks_sent = 0
    accumulated_pcm = []

    try:
        async with client.aio.live.music.connect(model="models/lyria-realtime-exp") as session:
            logger.info("Lyria session connected")

            # Set prompts
            await session.set_weighted_prompts(
                prompts=[types.WeightedPrompt(text=prompt, weight=1.0)]
            )

            # Set config
            await session.set_music_generation_config(
                config=types.LiveMusicGenerationConfig(
                    bpm=bpm,
                    temperature=temperature,
                )
            )

            # Start playback
            await session.play()
            await _send_json(ws, {"type": "status", "status": "playing"})
            logger.info("Lyria playback started")

            # Background: receive audio from Lyria → forward to frontend
            async def stream_audio():
                nonlocal chunks_sent
                try:
                    while not stop_event.is_set():
                        try:
                            async for message in session.receive():
                                if stop_event.is_set():
                                    break
                                try:
                                    audio_data = message.server_content.audio_chunks[0].data
                                    accumulated_pcm.append(audio_data)
                                    b64_chunk = base64.b64encode(audio_data).decode("utf-8")
                                    await _send_json(ws, {
                                        "type": "audio",
                                        "data": b64_chunk,
                                    })
                                    chunks_sent += 1
                                    if chunks_sent % 50 == 1:
                                        logger.info(f"Audio chunks sent: {chunks_sent}")
                                except (AttributeError, IndexError):
                                    # Not an audio chunk message, skip
                                    continue
                        except Exception as recv_err:
                            err_str = str(recv_err)
                            # Normal close codes — session ended gracefully
                            if any(code in err_str for code in ["1000", "1001"]):
                                logger.info(f"Lyria session ended normally ({err_str[:60]})")
                                break
                            else:
                                logger.error(f"Lyria receive error: {recv_err}")
                                await _send_json(ws, {
                                    "type": "error",
                                    "message": f"Streaming error: {str(recv_err)[:100]}"
                                })
                                break
                        await asyncio.sleep(1e-6)
                except asyncio.CancelledError:
                    pass

                logger.info(f"Audio streaming ended. Total chunks sent: {chunks_sent}")

            # Background: listen for stop commands from the client
            async def listen_for_stop():
                try:
                    while not stop_event.is_set():
                        raw_msg = await ws.receive_text()
                        try:
                            msg = json.loads(raw_msg)
                            if msg.get("type") == "stop":
                                logger.info("Client requested stop")
                                stop_event.set()
                                return
                        except json.JSONDecodeError:
                            continue
                except WebSocketDisconnect:
                    logger.info("Client disconnected")
                    stop_event.set()
                except Exception:
                    stop_event.set()

            # Run both tasks concurrently; when either finishes, cancel the other
            audio_task = asyncio.create_task(stream_audio())
            stop_task = asyncio.create_task(listen_for_stop())

            done, pending = await asyncio.wait(
                [audio_task, stop_task],
                return_when=asyncio.FIRST_COMPLETED,
            )

            stop_event.set()
            for task in pending:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

            # Session closes automatically via `async with` exit
            logger.info("Lyria session closing via context manager")

            # ── Save History ───────────────────────────────────────────────────
            if chunks_sent > 0:
                history_dir = os.path.join(os.path.dirname(__file__), '..', 'lyria_history')
                os.makedirs(history_dir, exist_ok=True)
                
                fid = f"lyria_{uuid.uuid4().hex[:8]}"
                wav_path = os.path.join(history_dir, f"{fid}.wav")
                json_path = os.path.join(history_dir, f"{fid}.json")

                # Merge PCM chunks
                full_pcm = b"".join(accumulated_pcm)
                
                # Save WAV
                with wave.open(wav_path, 'wb') as wf:
                    wf.setnchannels(2)
                    wf.setsampwidth(2) # 16-bit
                    wf.setframerate(48000)
                    wf.writeframes(full_pcm)

                # Save JSON metadata
                with open(json_path, 'w') as f:
                    json.dump({
                        "prompt": prompt,
                        "bpm": bpm,
                        "temperature": temperature,
                        "timestamp": time.time(),
                        "filename": f"{fid}.wav"
                    }, f)
                
                logger.info(f"Lyria generation saved to history: {fid}")

    except Exception as e:
        logger.error(f"Lyria session error: {e}")
        await _send_json(ws, {"type": "error", "message": f"Connection error: {str(e)}"})


@router.websocket("/ws/music")
async def lyria_music_stream(ws: WebSocket):
    """
    WebSocket endpoint for real-time music generation via Lyria RealTime.
    """
    await ws.accept()
    logger.info("Music WebSocket client connected")

    try:
        await _send_json(ws, {"type": "status", "status": "idle"})

        # Wait for generation config
        raw = await ws.receive_text()
        config = json.loads(raw)

        prompt = config.get("prompt", "").strip()
        if not prompt:
            await _send_json(ws, {"type": "error", "message": "Prompt is required"})
            await ws.close()
            return

        # Validate prompt is a meaningful music description
        from services.prompt_validator import validate_music_prompt
        is_valid, error_msg = validate_music_prompt(prompt)
        if not is_valid:
            await _send_json(ws, {"type": "error", "message": error_msg})
            await ws.close()
            return

        bpm = max(60, min(200, int(config.get("bpm", 90))))
        temperature = max(0.5, min(2.0, float(config.get("temperature", 1.0))))

        logger.info(f"Generation request: prompt='{prompt}', bpm={bpm}, temp={temperature}")

        await _send_json(ws, {"type": "status", "status": "connecting"})

        # Run the Lyria session (uses proper async with)
        await _run_lyria_session(ws, prompt, bpm, temperature)

    except WebSocketDisconnect:
        logger.info("Client disconnected during setup")
    except ValueError as e:
        logger.error(f"Config error: {e}")
        await _send_json(ws, {"type": "error", "message": str(e)})
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        await _send_json(ws, {
            "type": "error",
            "message": f"Server error: {str(e)}"
        })
    finally:
        await _send_json(ws, {"type": "status", "status": "stopped"})
        try:
            await ws.close()
        except Exception:
            pass
        logger.info("Music WebSocket cleanup complete")


# ── History endpoints ─────────────────────────────────────────────────────────

@router.get("/lyria-history")
async def get_lyria_history():
    history_dir = os.path.join(os.path.dirname(__file__), '..', 'lyria_history')
    if not os.path.exists(history_dir):
        return {"files": []}
    files = []
    for fn in os.listdir(history_dir):
        if fn.endswith(".wav"):
            path = os.path.join(history_dir, fn)
            js_path = path.replace(".wav", ".json")
            meta = {}
            if os.path.exists(js_path):
                with open(js_path) as f:
                    meta = json.load(f)
            files.append({
                "filename": fn,
                "timestamp": os.path.getmtime(path),
                "prompt": meta.get("prompt", ""),
                "bpm": meta.get("bpm", 90)
            })
    files.sort(key=lambda x: x["timestamp"], reverse=True)
    return {"files": files}


@router.get("/lyria-history/{filename}")
async def get_lyria_history_item(filename: str):
    if not filename.endswith(".wav") or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    history_dir = os.path.join(os.path.dirname(__file__), '..', 'lyria_history')
    path = os.path.join(history_dir, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")

    with open(path, 'rb') as f:
        audio_bytes = f.read()

    b64_data = base64.b64encode(audio_bytes).decode('utf-8')
    
    js_path = path.replace(".wav", ".json")
    meta = {}
    if os.path.exists(js_path):
        with open(js_path) as f:
            meta = json.load(f)

    return {
        "audio_base64": b64_data,
        "meta": meta
    }
