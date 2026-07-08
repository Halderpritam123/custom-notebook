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

REQUIRED_KEYS = {"one_liner", "mechanism", "when_to_use", "tradeoffs", "interview", "related", "diagram"}

RESEARCH_SYSTEM_PROMPT = "You are a subject matter expert. Always respond in valid JSON only."

RESEARCH_USER_TEMPLATE = """Research the following topic and return a JSON object with exactly these keys:
Topic: {topic_name}
{{
  "one_liner": "plain English explanation",
  "mechanism": "how it works internally",
  "when_to_use": "real-world scenarios",
  "tradeoffs": "Pros:\\n- ...\\nCons:\\n- ...",
  "interview": "2-3 crisp sentences",
  "related": "comma separated related concepts",
  "diagram": "ASCII diagram or empty string"
}}"""

CHAT_SYSTEM_TEMPLATE = (
    'You are a knowledgeable tutor. The user is learning about "{topic_name}". '
    "Answer what is asked concisely."
)


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=OPENAI_API_KEY, base_url=LLM_BASE_URL)
    return _client


def generate_research(topic_name: str) -> dict:
    messages = [
        {"role": "system", "content": RESEARCH_SYSTEM_PROMPT},
        {"role": "user", "content": RESEARCH_USER_TEMPLATE.format(topic_name=topic_name)},
    ]
    response = _get_client().chat.completions.create(model=LLM_MODEL, messages=messages)
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


def generate_chat_reply(topic_name: str, history: list) -> str:
    messages = [
        {"role": "system", "content": CHAT_SYSTEM_TEMPLATE.format(topic_name=topic_name)},
        *history[-10:],
    ]
    try:
        response = _get_client().chat.completions.create(model=LLM_MODEL, messages=messages)
        return response.choices[0].message.content
    except Exception as exc:
        logger.error("Chat LLM call failed: %s", exc)
        raise HTTPException(status_code=500, detail="Chat failed")
