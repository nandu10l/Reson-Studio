"""
Prompt Validator — Validates text prompts for AI music generation endpoints.

Ensures that user-provided prompts are meaningful music descriptions rather
than random gibberish, symbols, or empty strings. Used by both the Lyria
music generator and the MIDI-LLM text-to-MIDI generator.
"""

import re


def validate_music_prompt(prompt: str) -> tuple:
    """
    Validate that a music generation prompt is a meaningful description.

    Returns:
        (is_valid: bool, error_message: str)
        If valid, error_message is an empty string.
    """
    if not prompt or not prompt.strip():
        return False, "Prompt cannot be empty. Please describe the music you want to generate."

    prompt = prompt.strip()

    # ── Minimum length ────────────────────────────────────────────────────
    if len(prompt) < 10:
        return (
            False,
            "Prompt is too short. Please describe the music you want "
            "(e.g., 'a calm piano melody in C minor with soft dynamics')."
        )

    # ── Must contain real words (2+ letter sequences) ─────────────────────
    words = re.findall(r'[a-zA-Z]{2,}', prompt)
    if len(words) < 2:
        return (
            False,
            "Please enter a valid music description with at least two words "
            "(e.g., 'upbeat jazz piano', 'dark electronic synths')."
        )

    # ── Gibberish detection: words should contain vowels ──────────────────
    # Real English/music terms contain vowels: piano, bass, drum, rock, jazz, etc.
    vowel_re = re.compile(r'[aeiouAEIOU]')
    words_with_vowels = [w for w in words if vowel_re.search(w)]
    if len(words_with_vowels) < 1:
        return (
            False,
            "Your input doesn't appear to be a valid music description. "
            "Please describe the style, mood, or instruments you want "
            "(e.g., 'energetic rock with guitar and drums')."
        )

    # ── Excessive character repetition (e.g., "aaaa bbbb cccc") ───────────
    unique_chars = set(prompt.lower().replace(' ', ''))
    if len(unique_chars) < 4:
        return (
            False,
            "Please enter a meaningful music description instead of "
            "repeated characters."
        )

    # ── Mostly symbols/numbers (> 50% non-alpha) ─────────────────────────
    alpha_count = sum(1 for c in prompt if c.isalpha())
    if alpha_count / len(prompt) < 0.4:
        return (
            False,
            "Your prompt contains too many numbers or symbols. "
            "Please describe the music you want in words "
            "(e.g., 'a mellow funk groove with bass and keys')."
        )

    # ── Detect keyboard-mash patterns ─────────────────────────────────────
    # Consecutive consonant-only chunks of 5+ chars suggest random typing
    consonant_runs = re.findall(r'[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]{5,}', prompt)
    if len(consonant_runs) >= 2:
        return (
            False,
            "Your input looks like random text. Please enter a real music "
            "description (e.g., 'smooth jazz with piano and saxophone')."
        )

    return True, ""
