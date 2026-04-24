from unittest.mock import MagicMock

from hooks.built_in import log_after_repair, log_before_repair, log_on_error, register_default_hooks
from hooks.manager import HookManager


def test_log_on_error():
    # Should not raise
    log_on_error(error="something broke")


def test_log_before_repair():
    log_before_repair(context="demo")


def test_log_after_repair():
    log_after_repair(result="ok")


def test_register_default_hooks():
    manager = HookManager()
    register_default_hooks(manager)
    assert len(manager._hooks["on_error"]) >= 1
    assert len(manager._hooks["before_repair"]) >= 1
    assert len(manager._hooks["after_repair"]) >= 1
