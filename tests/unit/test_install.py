import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "scripts"))

import install


class TestCheckClaudeCli:
    @patch("install.run")
    def test_found(self, mock_run):
        mock_run.return_value = MagicMock(returncode=0, stdout="2.1.0\n")
        assert install.check_claude_cli() is True

    @patch("install.run")
    def test_not_found(self, mock_run):
        mock_run.return_value = MagicMock(returncode=127, stdout="", stderr="not found")
        assert install.check_claude_cli() is False


class TestPrompt:
    @patch("install.input", return_value="hello")
    def test_returns_input(self, mock_input):
        assert install.prompt("Name") == "hello"

    @patch("install.input", return_value="")
    def test_returns_default(self, mock_input):
        assert install.prompt("Name", default="world") == "world"


class TestPromptBool:
    @patch("install.input", return_value="y")
    def test_yes(self, mock_input):
        assert install.prompt_bool("Continue?") is True

    @patch("install.input", return_value="n")
    def test_no(self, mock_input):
        assert install.prompt_bool("Continue?") is False

    @patch("install.input", return_value="")
    def test_default_true(self, mock_input):
        assert install.prompt_bool("Continue?", default=True) is True


class TestDeployAssets:
    def test_deploys_to_empty_dir(self, tmp_path):
        with patch("install.ASSETS_DIR", tmp_path / "assets"):
            src_claude = tmp_path / "assets" / "claude"
            src_claude.mkdir(parents=True)
            (src_claude / "settings.json.tmpl").write_text("{}")
            (src_claude / "skills").mkdir()

            target = tmp_path / "target"
            install.deploy_assets(target)

            assert (target / ".claude" / "settings.json").exists()
            assert (target / ".claude" / "skills").exists()


class TestGenerateEnv:
    def test_creates_env_file(self, tmp_path):
        target = tmp_path / "target"
        target.mkdir()
        inputs = iter([
            "app_id", "secret", "", "", "mon_key",
            "gh_token", "owner", "repo", str(target),
        ])
        with patch("install.input", side_effect=lambda *_: next(inputs)):
            install.generate_env(target)

        env = (target / ".env").read_text()
        assert "FEISHU_APP_ID=app_id" in env
        assert "GITHUB_TOKEN=gh_token" in env
        assert "REPO_ROOT=" in env


class TestCheckEccPlugin:
    @patch("install.CLAUdecode_PLUGINS_JSON")
    def test_plugin_found(self, mock_path):
        mock_path.exists.return_value = True
        mock_path.read_text.return_value = '{"plugins": {"oh-my-claudecode@omc": []}}'
        assert install.check_ecc_plugin() is True

    @patch("install.CLAUdecode_PLUGINS_JSON")
    def test_plugin_missing(self, mock_path):
        mock_path.exists.return_value = True
        mock_path.read_text.return_value = '{"plugins": {}}'
        assert install.check_ecc_plugin() is False

    @patch("install.CLAUdecode_PLUGINS_JSON")
    def test_registry_missing(self, mock_path):
        mock_path.exists.return_value = False
        assert install.check_ecc_plugin() is False
