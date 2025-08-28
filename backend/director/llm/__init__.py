import os

from director.constants import LLMType

from director.llm.openai import OpenAI
from director.llm.anthropic import AnthropicAI
from director.llm.googleai import GoogleAI
from director.llm.videodb_proxy import VideoDBProxy


def get_default_llm():
    """Select the default LLM based on env configuration.

    Priority: explicit `DEFAULT_LLM` value -> available API keys -> VideoDB proxy.
    """

    openai = True if os.getenv("OPENAI_API_KEY") else False
    anthropic = True if os.getenv("ANTHROPIC_API_KEY") else False
    googleai = True if os.getenv("GOOGLEAI_API_KEY") else False

    default_llm = (os.getenv("DEFAULT_LLM") or "").strip().lower()

    if default_llm in (str(LLMType.OPENAI), "openai"):
        return OpenAI()
    if default_llm in (str(LLMType.ANTHROPIC), "anthropic"):
        return AnthropicAI()
    if default_llm in (str(LLMType.GOOGLEAI), "googleai", "gemini"):
        return GoogleAI()

    if openai:
        return OpenAI()
    if anthropic:
        return AnthropicAI()
    if googleai:
        return GoogleAI()

    return VideoDBProxy()
