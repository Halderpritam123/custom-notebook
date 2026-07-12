"""
llm.py — OpenAI-compatible LLM client for research generation and chat.
"""
import json
import logging
import re

from fastapi import HTTPException
from openai import OpenAI

from app.config import LLM_BASE_URL, LLM_MODEL, OPENAI_API_KEY

logger = logging.getLogger(__name__)

_client: OpenAI | None = None

REQUIRED_KEYS = {
    "summary", "key_concepts", "background_context", "how_it_works",
    "real_world_applications", "common_misconceptions", "related_topics", "open_questions",
}

RESEARCH_SYSTEM_PROMPT = "You are a subject matter expert. Always respond in valid JSON only."

RESEARCH_USER_TEMPLATE = """Research the following topic and return a JSON object with exactly these keys:
Topic: {topic_name}{category_line}
{{
  "summary": "2-3 sentence overview of what this topic is",
  "key_concepts": "the 5-7 core ideas or pillars needed to understand this topic (markdown list)",
  "background_context": "origin, history, or why this topic exists and matters",
  "how_it_works": "the mechanics or inner logic — internals for tech, cause-effect for history, reasoning for theories",
  "real_world_applications": "concrete examples of where this shows up in practice (markdown list)",
  "common_misconceptions": "things people often get wrong about this topic (markdown list)",
  "related_topics": "comma separated related topics worth exploring",
  "open_questions": "debated, unresolved, or interesting questions worth exploring further (markdown list)"
}}
Research this topic specifically in the context of the domain/category above if provided."""

CHAT_SYSTEM_TEMPLATE = (
    'You are a knowledgeable tutor. The user is learning about "{topic_name}"{category_part}. '
    "Answer what is asked concisely."
)


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=OPENAI_API_KEY, base_url=LLM_BASE_URL)
    return _client


def generate_research(topic_name: str, category_name: str | None = None) -> dict:
    category_line = f"\nCategory/Domain: {category_name}" if category_name else ""
    messages = [
        {"role": "system", "content": RESEARCH_SYSTEM_PROMPT},
        {"role": "user", "content": RESEARCH_USER_TEMPLATE.format(topic_name=topic_name, category_line=category_line)},
    ]
    response = _get_client().chat.completions.create(model=LLM_MODEL, messages=messages, timeout=30)
    raw = response.choices[0].message.content

    stripped = re.sub(r"^```[a-zA-Z]*\n?", "", raw.strip())
    stripped = re.sub(r"\n?```$", "", stripped).strip()

    try:
        data = json.loads(stripped, strict=False)
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error("Failed to parse LLM research response: %s", exc)
        raise HTTPException(status_code=500, detail="Research generation failed")

    missing = REQUIRED_KEYS - set(data.keys())
    if missing:
        logger.error("LLM research response missing keys: %s", missing)
        raise HTTPException(status_code=500, detail="Research generation failed")

    return {key: data[key] for key in REQUIRED_KEYS}


def generate_chat_reply(topic_name: str, history: list, category_name: str | None = None) -> str:
    category_part = f" in the context of {category_name}" if category_name else ""
    messages = [
        {"role": "system", "content": CHAT_SYSTEM_TEMPLATE.format(topic_name=topic_name, category_part=category_part)},
        *history[-10:],
    ]
    try:
        response = _get_client().chat.completions.create(model=LLM_MODEL, messages=messages, timeout=30)
        return response.choices[0].message.content
    except Exception as exc:
        logger.error("Chat LLM call failed: %s", exc)
        raise HTTPException(status_code=500, detail="Chat failed")
