import json
import logging
import os

from dotenv import load_dotenv
from fastapi import HTTPException
from openai import OpenAI

load_dotenv()

logger = logging.getLogger(__name__)

# All LLM config comes from env vars — swap provider by changing .env, no code change needed
MODEL = os.getenv("LLM_MODEL", "gpt-4o")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://models.inference.ai.azure.com")

# Cached client — created once, reused on every request
_client: OpenAI | None = None


def _get_client() -> OpenAI:
    """Return a cached OpenAI-compatible client (created once at first call).

    Works with any provider that exposes an OpenAI-compatible API:
    - Azure AI: base_url=https://models.inference.ai.azure.com
    - OpenAI:   base_url=https://api.openai.com/v1
    - Groq:     base_url=https://api.groq.com/openai/v1
    - Mistral:  base_url=https://api.mistral.ai/v1
    - Ollama:   base_url=http://localhost:11434/v1
    """
    global _client
    if _client is None:
        _client = OpenAI(
            api_key=os.getenv("OPENAI_API_KEY"),
            base_url=LLM_BASE_URL,
        )
    return _client

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

REQUIRED_KEYS = {"one_liner", "mechanism", "when_to_use", "tradeoffs", "interview", "related", "diagram"}


def generate_research(topic_name: str) -> dict:
    """Call the OpenAI chat completions API and return a parsed research dict.

    Returns a dict with exactly seven keys: one_liner, mechanism, when_to_use,
    tradeoffs, interview, related, diagram.

    Raises:
        HTTPException(500): if the LLM response cannot be parsed as valid JSON
            or is missing required keys.
    """
    messages = [
        {"role": "system", "content": RESEARCH_SYSTEM_PROMPT},
        {"role": "user", "content": RESEARCH_USER_TEMPLATE.format(topic_name=topic_name)},
    ]

    response = _get_client().chat.completions.create(
        model=MODEL,
        messages=messages,
    )

    raw_content = response.choices[0].message.content

    # Strip markdown code fences e.g. ```json ... ``` or ``` ... ```
    import re
    stripped = re.sub(r"^```[a-zA-Z]*\n?", "", raw_content.strip())
    stripped = re.sub(r"\n?```$", "", stripped).strip()

    try:
        data = json.loads(stripped, strict=False)
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error("Failed to parse LLM research response: %s — content: %s", exc, stripped)
        raise HTTPException(status_code=500, detail="Research generation failed")

    missing = REQUIRED_KEYS - set(data.keys())
    if missing:
        logger.error("LLM research response missing keys: %s — content: %s", missing, raw_content)
        raise HTTPException(status_code=500, detail="Research generation failed")

    return {key: data[key] for key in REQUIRED_KEYS}

CHAT_SYSTEM_TEMPLATE = (
    'You are a knowledgeable tutor. The user is learning about "{topic_name}". '
    "Answer what is asked concisely."
)


def build_chat_messages(topic_name: str, history: list) -> list:
    """Build the messages list for a chat completion request.

    Prepends the system prompt (with the topic name interpolated) and trims
    the conversation history to the last 10 messages, keeping the total
    context within ~4 000 tokens.

    Args:
        topic_name: The name of the topic the user is learning about.
        history: A list of ``{"role": ..., "content": ...}`` dicts representing
            the conversation so far (in chronological order).

    Returns:
        A list of message dicts ready to pass to the OpenAI chat completions
        API: ``[system_message, *last_10_history_messages]``.
    """
    system_message = {
        "role": "system",
        "content": CHAT_SYSTEM_TEMPLATE.format(topic_name=topic_name),
    }
    trimmed_history = history[-10:]
    return [system_message] + trimmed_history


def generate_chat_reply(topic_name: str, history: list) -> str:
    """Call the OpenAI chat completions API and return the assistant reply.

    Builds the messages list via ``build_chat_messages``, sends it to the
    model, and returns the assistant's reply as a plain string.

    Args:
        topic_name: The name of the topic the user is learning about.
        history: A list of ``{"role": ..., "content": ...}`` dicts representing
            the conversation so far (the last 10 are used).

    Returns:
        The assistant reply string.

    Raises:
        HTTPException(500): if the OpenAI call raises any exception.
    """
    messages = build_chat_messages(topic_name, history)
    try:
        response = _get_client().chat.completions.create(model=MODEL, messages=messages)
        return response.choices[0].message.content
    except Exception as exc:
        logger.error("Chat LLM call failed: %s", exc)
        raise HTTPException(status_code=500, detail="Chat failed")
