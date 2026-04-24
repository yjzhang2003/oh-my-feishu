import logging
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

HookCallback = Callable[..., Any]


class HookManager:
    """Register and emit lifecycle hooks."""

    VALID_EVENTS = {
        "before_repair",
        "after_repair",
        "before_tool_call",
        "after_tool_call",
        "on_error",
        "on_startup",
        "on_shutdown",
    }

    def __init__(self) -> None:
        self._hooks: Dict[str, List[HookCallback]] = {event: [] for event in self.VALID_EVENTS}

    def register(self, event: str, callback: HookCallback) -> None:
        if event not in self.VALID_EVENTS:
            raise ValueError(f"Invalid hook event: {event}. Valid: {self.VALID_EVENTS}")
        self._hooks[event].append(callback)
        logger.debug("Registered hook for %s: %s", event, callback.__name__)

    def unregister(self, event: str, callback: HookCallback) -> None:
        if event in self._hooks and callback in self._hooks[event]:
            self._hooks[event].remove(callback)

    def emit(self, event: str, **kwargs: Any) -> List[Any]:
        """Emit event to all registered callbacks. Return list of results."""
        if event not in self.VALID_EVENTS:
            raise ValueError(f"Invalid hook event: {event}")

        results: List[Any] = []
        for callback in self._hooks[event]:
            try:
                result = callback(**kwargs)
                results.append(result)
            except Exception as exc:
                logger.error("Hook %s for event %s failed: %s", callback.__name__, event, exc)
        return results

    def clear(self, event: Optional[str] = None) -> None:
        if event:
            self._hooks[event] = []
        else:
            for key in self._hooks:
                self._hooks[key] = []
