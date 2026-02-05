"""
AudioPack Router - API endpoints for audio pack sample generation
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import os

from services.audiopack_service import (
    generate_and_cache_sample,
    get_cached_sample,
    parse_duration,
    list_cached_samples,
    clear_cache,
    CACHE_DIR
)

router = APIRouter(prefix="/audiopack", tags=["audiopack"])


class GenerateSampleRequest(BaseModel):
    sample_id: str
    pack_type: str
    duration: str = "2s"
    bpm: int = 120


class BatchGenerateRequest(BaseModel):
    samples: list[dict]  # List of {sample_id, pack_type, duration}
    bpm: int = 120


@router.post("/generate")
async def generate_sample(request: GenerateSampleRequest):
    """
    Generate an audio pack sample and return the file path.
    The sample is cached for future requests.
    """
    try:
        duration_seconds = parse_duration(request.duration, request.bpm)
        
        filepath = generate_and_cache_sample(
            request.sample_id,
            request.pack_type,
            duration_seconds,
            request.bpm
        )
        
        return {
            "success": True,
            "sample_id": request.sample_id,
            "pack_type": request.pack_type,
            "duration": duration_seconds,
            "filepath": filepath,
            "filename": os.path.basename(filepath)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sample/{filename}")
async def get_sample_file(filename: str):
    """
    Retrieve a cached sample file by filename.
    Returns the WAV file directly.
    """
    filepath = os.path.join(CACHE_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Sample not found")
    
    return FileResponse(
        filepath,
        media_type="audio/wav",
        filename=filename
    )


@router.get("/fetch")
async def fetch_sample(
    sample_id: str = Query(..., description="Sample ID (e.g., 'riser-white')"),
    pack_type: str = Query(..., description="Pack type (e.g., 'risers')"),
    duration: str = Query("2s", description="Duration (e.g., '2s', '1 bar', '4 beats')"),
    bpm: int = Query(120, description="BPM for duration calculation")
):
    """
    Generate (if needed) and return a sample file.
    This is a convenience endpoint that generates and returns the file in one request.
    """
    try:
        duration_seconds = parse_duration(duration, bpm)
        
        filepath = generate_and_cache_sample(
            sample_id,
            pack_type,
            duration_seconds,
            bpm
        )
        
        return FileResponse(
            filepath,
            media_type="audio/wav",
            filename=f"{sample_id}.wav",
            headers={
                "X-Sample-Id": sample_id,
                "X-Pack-Type": pack_type,
                "X-Duration": str(duration_seconds),
                "X-BPM": str(bpm)
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch")
async def batch_generate(request: BatchGenerateRequest):
    """
    Generate multiple samples in a batch.
    Useful for pre-warming the cache.
    """
    results = []
    errors = []
    
    for sample in request.samples:
        try:
            sample_id = sample.get('sample_id', sample.get('id'))
            pack_type = sample.get('pack_type', sample.get('packId'))
            duration = sample.get('duration', '2s')
            
            if not sample_id or not pack_type:
                errors.append({"sample": sample, "error": "Missing sample_id or pack_type"})
                continue
            
            duration_seconds = parse_duration(duration, request.bpm)
            filepath = generate_and_cache_sample(sample_id, pack_type, duration_seconds, request.bpm)
            
            results.append({
                "sample_id": sample_id,
                "pack_type": pack_type,
                "duration": duration_seconds,
                "filename": os.path.basename(filepath),
                "success": True
            })
        except Exception as e:
            errors.append({"sample": sample, "error": str(e)})
    
    return {
        "success": len(errors) == 0,
        "generated": len(results),
        "failed": len(errors),
        "results": results,
        "errors": errors
    }


@router.get("/cache")
async def list_cache():
    """
    List all cached samples.
    """
    samples = list_cached_samples()
    total_size = sum(s['size'] for s in samples)
    
    return {
        "count": len(samples),
        "total_size_bytes": total_size,
        "total_size_mb": round(total_size / (1024 * 1024), 2),
        "samples": samples
    }


@router.delete("/cache")
async def clear_sample_cache():
    """
    Clear all cached samples.
    """
    count = clear_cache()
    return {
        "success": True,
        "deleted_count": count
    }


@router.get("/check")
async def check_sample(
    sample_id: str = Query(...),
    pack_type: str = Query(...),
    duration: str = Query("2s"),
    bpm: int = Query(120)
):
    """
    Check if a sample is cached without generating it.
    """
    duration_seconds = parse_duration(duration, bpm)
    cached = get_cached_sample(sample_id, pack_type, duration_seconds, bpm)
    
    return {
        "sample_id": sample_id,
        "pack_type": pack_type,
        "duration": duration_seconds,
        "cached": cached is not None,
        "filepath": cached
    }
