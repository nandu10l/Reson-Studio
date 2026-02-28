"""
MIDI-LLM Router — REST API for text-to-MIDI generation.

Endpoints:
    GET  /midi-llm/health       → model status
    POST /midi-llm/generate     → generate MIDI notes from text
    POST /midi-llm/generate-file → generate and download .mid file

This file is completely self-contained. To remove the MIDI-LLM feature,
simply delete this file and the corresponding service.
"""

import logging
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

logger = logging.getLogger("midi_llm")
router = APIRouter(prefix="/midi-llm", tags=["midi-llm"])


# ── Request / Response models ────────────────────────────────────────────────
class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=1000)
    temperature: float = Field(1.0, ge=0.1, le=2.0)
    top_p: float = Field(0.98, ge=0.5, le=1.0)
    max_tokens: int = Field(2046, ge=128, le=4096)


# ── Health check ─────────────────────────────────────────────────────────────
@router.get("/health")
async def midi_llm_health():
    """Return model availability status."""
    from services.midi_llm_service import midi_llm_service

    status = midi_llm_service.status
    result = {"status": status, "service": "midi-llm", "model": "MIDI-LLM_Llama-3.2-1B"}

    if status == "unavailable":
        result["reason"] = midi_llm_service.unavailable_reason
    elif status == "idle":
        result["status"] = "available"
        result["note"] = "Model will load on first generation request"

    return result


# ── Generate MIDI notes ─────────────────────────────────────────────────────
@router.post("/generate")
async def generate_midi(req: GenerateRequest):
    """Generate MIDI notes from a text prompt. Returns JSON with notes array."""
    from services.midi_llm_service import midi_llm_service

    # Lazy-load model on first request
    if midi_llm_service.status == "idle":
        midi_llm_service.load_model()

    if midi_llm_service.status != "available":
        raise HTTPException(
            status_code=503,
            detail=f"MIDI-LLM not available: {midi_llm_service.unavailable_reason}"
        )

    try:
        result = midi_llm_service.generate(
            prompt=req.prompt,
            temperature=req.temperature,
            top_p=req.top_p,
            max_tokens=req.max_tokens,
        )

        return {
            "success": True,
            "notes": result["notes"],
            "total_notes": result["total_notes"],
            "generation_time_seconds": result["generation_time"],
        }

    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"MIDI-LLM generation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


# ── Generate and download .mid file ─────────────────────────────────────────
@router.post("/generate-file")
async def generate_midi_file(req: GenerateRequest):
    """Generate MIDI from text and return as downloadable .mid file."""
    from services.midi_llm_service import midi_llm_service

    # Lazy-load model on first request
    if midi_llm_service.status == "idle":
        midi_llm_service.load_model()

    if midi_llm_service.status != "available":
        raise HTTPException(
            status_code=503,
            detail=f"MIDI-LLM not available: {midi_llm_service.unavailable_reason}"
        )

    try:
        result = midi_llm_service.generate(
            prompt=req.prompt,
            temperature=req.temperature,
            top_p=req.top_p,
            max_tokens=req.max_tokens,
        )

        return Response(
            content=result["midi_bytes"],
            media_type="audio/midi",
            headers={"Content-Disposition": "attachment; filename=midi_llm_output.mid"}
        )

    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"MIDI-LLM file generation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")
