import logging
from typing import Any

from hooks.manager import HookManager

logger = logging.getLogger(__name__)


def log_on_error(**kwargs: Any) -> None:
    error = kwargs.get("error")
    if error:
        logger.error("Agent error: %s", error)


def log_before_repair(**kwargs: Any) -> None:
    logger.info("Starting repair flow for context: %s", kwargs.get("context"))


def log_after_repair(**kwargs: Any) -> None:
    logger.info("Repair flow completed with result: %s", kwargs.get("result"))


def register_default_hooks(manager: HookManager) -> None:
    manager.register("on_error", log_on_error)
    manager.register("before_repair", log_before_repair)
    manager.register("after_repair", log_after_repair)
