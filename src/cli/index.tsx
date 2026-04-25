#!/usr/bin/env node
import React, { useState, useEffect, useCallback } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import chalk from 'chalk';
import { SelectList } from './components/SelectList.js';
import { Header } from './components/Header.js';
import { Footer } from './components/Footer.js';
import { QrScreen } from './components/QrScreen.js';
import { GitHubScreen } from './components/GitHubScreen.js';
import { getAllStatuses, ComponentStatus } from './hooks/useStatus.js';
import {
  getClaudeApiKey,
  setClaudeApiKey,
  resetClaudeApiKey,
  getEccPluginStatus,
  enableEccPlugin,
  disableEccPlugin,
  setFeishuCredentials,
  resetFeishuCredentials,
} from '../config/settings.js';
import { RegisterResult } from '../feishu/qr-register.js';
import { execa } from 'execa';

type Screen = 'main' | 'claude' | 'feishu' | 'github' | 'ecc' | 'qr' | 'github-auth';

const components = ['claude', 'feishu', 'github', 'ecc'] as const;
const componentNames = ['Claude Code', 'Feishu', 'GitHub', 'ECC'];

function App() {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>('main');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [statuses, setStatuses] = useState<Record<string, ComponentStatus>>({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    setStatuses(getAllStatuses());
  }, []);

  const refreshStatuses = useCallback(() => {
    setStatuses(getAllStatuses());
  }, []);

  // 主界面键盘监听
  useInput((input, key) => {
    if (screen !== 'main') return;

    if (key.upArrow || input === 'k') {
      setSelectedIndex((prev) => (prev - 1 + components.length) % components.length);
    } else if (key.downArrow || input === 'j') {
      setSelectedIndex((prev) => (prev + 1) % components.length);
    } else if (key.return) {
      setScreen(components[selectedIndex]);
      setSelectedIndex(0);
      setMessage('');
    } else if (input === 'q') {
      exit();
    }
  });

  // 子页面配置
  const [subIndex, setSubIndex] = useState(0);
  const [inputMode, setInputMode] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [tempAppId, setTempAppId] = useState('');

  // 子页面键盘监听
  useInput(async (input, key) => {
    if (screen === 'main' || screen === 'qr' || screen === 'github-auth') return;

    // 输入模式
    if (inputMode) {
      if (key.return) {
        if (inputMode === 'claude-key') {
          setClaudeApiKey(inputValue);
          setMessage(chalk.green('✓ API key saved'));
          setInputMode(null);
          setInputValue('');
          refreshStatuses();
        } else if (inputMode === 'feishu-appid') {
          setTempAppId(inputValue);
          setInputMode('feishu-secret');
          setInputValue('');
          setMessage('Enter FEISHU_APP_SECRET:');
        } else if (inputMode === 'feishu-secret') {
          setFeishuCredentials(tempAppId, inputValue);
          setMessage(chalk.green('✓ Feishu credentials saved'));
          setInputMode(null);
          setInputValue('');
          setTempAppId('');
          refreshStatuses();
        }
      } else if (key.escape) {
        setInputMode(null);
        setInputValue('');
        setTempAppId('');
        setMessage('');
      } else if (key.backspace || key.delete) {
        setInputValue((prev) => prev.slice(0, -1));
      } else if (input && input.length === 1) {
        setInputValue((prev) => prev + input);
      }
      return;
    }

    // ESC 返回主菜单 (不刷新状态，避免卡顿)
    if (key.escape) {
      setScreen('main');
      setSelectedIndex(components.indexOf(screen));
      setMessage('');
      return;
    }

    // 列表导航
    if (key.upArrow || input === 'k') {
      const maxIndex = getMaxIndex(screen, statuses);
      setSubIndex((prev) => (prev - 1 + maxIndex) % maxIndex);
    } else if (key.downArrow || input === 'j') {
      const maxIndex = getMaxIndex(screen, statuses);
      setSubIndex((prev) => (prev + 1) % maxIndex);
    } else if (key.return) {
      await executeAction(screen, subIndex, statuses, {
        setMessage,
        setInputMode,
        setInputValue,
        setTempAppId,
        refreshStatuses,
        setScreen,
      });
    }
  });

  // 渲染主界面
  if (screen === 'main') {
    const items = components.map((key, index) => ({
      key,
      label: componentNames[index],
      status: statuses[key]?.configured ? '✓' : '✗',
      statusColor: (statuses[key]?.configured ? 'green' : 'red') as 'green' | 'red',
    }));

    return (
      <Box flexDirection="column" padding={1}>
        <Header title="Feishu Agent Setup" />
        <Box marginTop={1}>
          <SelectList items={items} selectedIndex={selectedIndex} />
        </Box>
        <Footer hints={['↑↓ Navigate', 'Enter Configure', 'q Quit']} />
      </Box>
    );
  }

  // 渲染 QR 扫码页面
  if (screen === 'qr') {
    return (
      <QrScreen
        onSuccess={(result: RegisterResult) => {
          setFeishuCredentials(result.app_id, result.app_secret);
          setMessage(chalk.green('✓ Feishu credentials saved'));
          setScreen('feishu');
          refreshStatuses();
        }}
        onCancel={() => {
          setScreen('feishu');
        }}
      />
    );
  }

  // 渲染 GitHub OAuth 页面
  if (screen === 'github-auth') {
    return (
      <GitHubScreen
        onSuccess={() => {
          setMessage(chalk.green('✓ GitHub authenticated'));
          setScreen('github');
          refreshStatuses();
        }}
        onCancel={() => {
          setScreen('github');
        }}
      />
    );
  }

  // 渲染子页面
  const { options, status } = getScreenConfig(screen, statuses);

  return (
    <Box flexDirection="column" padding={1}>
      <Header title={`${componentNames[components.indexOf(screen)]} Config`} />
      {status && (
        <Box marginTop={1}>
          <Text dimColor>Status: </Text>
          <Text color={statuses[screen]?.configured ? 'green' : 'yellow'}>{status}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <SelectList items={options} selectedIndex={subIndex} />
      </Box>
      {message && (
        <Box marginTop={1}>
          <Text>{message}</Text>
          {inputMode && <Text color="cyan"> {inputValue}</Text>}
        </Box>
      )}
      <Footer hints={['↑↓ Navigate', 'Enter Select', 'ESC Back']} />
    </Box>
  );
}

function getMaxIndex(screen: Screen, statuses: Record<string, ComponentStatus>): number {
  const config = getScreenConfig(screen, statuses);
  return config.options.length;
}

function getScreenConfig(screen: Screen, statuses: Record<string, ComponentStatus>) {
  if (screen === 'claude') {
    const configured = !!getClaudeApiKey();
    return {
      status: statuses.claude?.message,
      options: configured
        ? [
            { key: 'reconfigure', label: 'Reconfigure', description: 'Enter new API key' },
            { key: 'reset', label: 'Reset', description: 'Remove API key' },
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ]
        : [
            { key: 'enter', label: 'Enter API Key', description: 'Input ANTHROPIC_API_KEY' },
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ],
    };
  }

  if (screen === 'feishu') {
    const configured = statuses.feishu?.configured;
    return {
      status: statuses.feishu?.message,
      options: configured
        ? [
            { key: 'reconfigure', label: 'Reconfigure', description: 'Enter credentials manually' },
            { key: 'scan', label: 'Scan QR', description: 'Create bot via QR code' },
            { key: 'reset', label: 'Reset', description: 'Remove credentials' },
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ]
        : [
            { key: 'manual', label: 'Enter Credentials', description: 'Input APP_ID and SECRET' },
            { key: 'scan', label: 'Scan QR', description: 'Recommended', status: '★', statusColor: 'yellow' as const },
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ],
    };
  }

  if (screen === 'github') {
    const configured = statuses.github?.configured;
    return {
      status: statuses.github?.message,
      options: configured
        ? [
            { key: 'logout', label: 'Logout', description: 'Sign out from GitHub' },
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ]
        : [
            { key: 'login', label: 'Login', description: 'OAuth with GitHub' },
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ],
    };
  }

  if (screen === 'ecc') {
    const eccStatus = getEccPluginStatus();
    return {
      status: eccStatus.installed ? (eccStatus.version || 'Enabled') : 'Not enabled',
      options: eccStatus.installed
        ? [
            { key: 'disable', label: 'Disable', description: 'Disable ECC for this project' },
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ]
        : [
            { key: 'enable', label: 'Enable', description: 'Enable ECC for this project' },
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ],
    };
  }

  return { status: '', options: [{ key: 'back', label: 'Back', description: 'Return to main menu' }] };
}

async function executeAction(
  screen: Screen,
  index: number,
  statuses: Record<string, ComponentStatus>,
  handlers: {
    setMessage: (msg: string) => void;
    setInputMode: (mode: string | null) => void;
    setInputValue: (val: string) => void;
    setTempAppId: (id: string) => void;
    refreshStatuses: () => void;
    setScreen: (s: Screen) => void;
  }
) {
  const { setMessage, setInputMode, setInputValue, setTempAppId, refreshStatuses, setScreen } = handlers;
  const config = getScreenConfig(screen, statuses);
  const option = config.options[index];

  if (option.key === 'back') {
    setScreen('main');
    return;
  }

  // Claude actions
  if (screen === 'claude') {
    if (option.key === 'enter' || option.key === 'reconfigure') {
      setInputMode('claude-key');
      setMessage('Enter ANTHROPIC_API_KEY:');
      setInputValue('');
    } else if (option.key === 'reset') {
      resetClaudeApiKey();
      setMessage(chalk.green('✓ API key removed'));
      refreshStatuses();
    }
  }

  // Feishu actions
  if (screen === 'feishu') {
    if (option.key === 'manual' || option.key === 'reconfigure') {
      setInputMode('feishu-appid');
      setMessage('Enter FEISHU_APP_ID:');
      setInputValue('');
    } else if (option.key === 'scan') {
      setScreen('qr');
    } else if (option.key === 'reset') {
      resetFeishuCredentials();
      setMessage(chalk.green('✓ Feishu credentials removed'));
      refreshStatuses();
    }
  }

  // GitHub actions
  if (screen === 'github') {
    if (option.key === 'login') {
      setScreen('github-auth');
    } else if (option.key === 'logout') {
      try {
        await execa('gh', ['auth', 'logout', '--hostname', 'github.com']);
        setMessage(chalk.green('✓ Logged out'));
        refreshStatuses();
      } catch (error) {
        setMessage(chalk.red(`✗ Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    }
  }

  // ECC actions - enable/disable in project settings
  if (screen === 'ecc') {
    if (option.key === 'enable') {
      enableEccPlugin();
      setMessage(chalk.green('✓ ECC plugin enabled for this project'));
      refreshStatuses();
    } else if (option.key === 'disable') {
      disableEccPlugin();
      setMessage(chalk.green('✓ ECC plugin disabled for this project'));
      refreshStatuses();
    }
  }
}

render(<App />);
