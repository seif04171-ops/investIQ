"""
Shared Claude client for the AI analysis services (summarization, entity
extraction, opportunity scoring, tutor). Centralizes the "ask for strict
JSON back" pattern so every caller doesn't reimplement parsing/retry logic.
"""
import json
import logging

import anthropic

from app.core.config import settings

logger = logging.getLogger(__name__)

_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def ask_for_json(system_prompt: str, user_prompt: str, max_tokens: int = 1500) -> dict:
    """
    Calls Claude with a system prompt that demands JSON-only output,
    parses the response, and returns a dict. Raises ValueError if the
    model's output isn't valid JSON (caller decides how to handle that —
    log and skip is usually right for a background pipeline).
    """
    response = _client.messages.create(
        model=settings.AI_MODEL,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    text = "".join(
        block.text for block in response.content if block.type == "text"
    ).strip()

    # Strip markdown code fences if the model added them despite instructions
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:].strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        logger.error("Claude response was not valid JSON: %s", text[:500])
        raise ValueError(f"Non-JSON response from model: {exc}") from exc
