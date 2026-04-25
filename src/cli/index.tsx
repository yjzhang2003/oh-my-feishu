#!/usr/bin/env node
import React, { useState, useEffect, useCallback } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { resolve } from 'path';
import chalk from 'chalk';
import { SelectList } from './components/SelectList.js';
import { Header } from './components/Header.js';
import { Footer } from './components/Footer.js';
import { QrScreen } from './components/QrScreen.js';
import { getAllStatuses, ComponentStatus } from './hooks/useStatus.js';
import {
  setFeishuCredentials,
  resetFeishuCredentials,
} from '../config/settings.js';
import { RegisterResult } from '../feishu/qr-register.js';
import { execa } from 'execa';

type Screen = 'main' | 'claude' | 'feishu' | 'github' | 'lark' | 'gateway' | 'qr';

const components = ['claude', 'feishu', 'github', 'lark', 'gateway'] as const;
const componentNames = ['Claude Code', 'Feishu', 'GitHub', 'Lark CLI', 'Gateway'];

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

  const [subIndex, setSubIndex] = useState(0);
  const [inputMode, setInputMode] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [tempAppId, setTempAppId] = useState('');

  useInput(async (input, key) => {
    if (screen === 'main' || screen === 'qr') return;

    if (inputMode) {
      if (key.return) {
        if (inputMode === 'feishu-appid') {
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

    if (key.escape) {
      setScreen('main');
      setSelectedIndex(components.indexOf(screen));
      setMessage('');
      return;
    }

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
    const installed = statuses.claude?.configured;
    return {
      status: statuses.claude?.message,
      options: installed
        ? [
            { key: 'open', label: 'Open Claude Code', description: 'Launch in workspace directory' },
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ]
        : [
            { key: 'install', label: 'Install', description: 'Install Claude Code CLI globally' },
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
    const installed = statuses.github?.configured;
    return {
      status: statuses.github?.message,
      options: installed
        ? [
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ]
        : [
            { key: 'install', label: 'Install gh CLI', description: 'Visit GitHub CLI website' },
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ],
    };
  }

  if (screen === 'lark') {
    const installed = statuses.lark?.configured;
    return {
      status: statuses.lark?.message,
      options: installed
        ? [
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ]
        : [
            { key: 'install', label: 'Install lark-cli', description: 'Visit larksuite/cli GitHub' },
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ],
    };
  }

  if (screen === 'gateway') {
    const running = statuses.gateway?.configured;
    return {
      status: statuses.gateway?.message,
      options: running
        ? [
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ]
        : [
            { key: 'start', label: 'Start', description: 'Show start command' },
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
    if (option.key === 'install') {
      setMessage(chalk.cyan('Installing Claude Code CLI...'));
      try {
        await execa('npm', ['install', '-g', '@anthropic-ai/claude-code'], { stdio: 'inherit' });
        setMessage(chalk.green('✓ Claude Code installed successfully'));
        refreshStatuses();
      } catch (error) {
        setMessage(chalk.red(`✗ Installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    } else if (option.key === 'open') {
      const workspacePath = resolve(process.cwd(), 'workspace');
      setMessage(chalk.cyan(`cd ${workspacePath} && claude`));
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
    if (option.key === 'install') {
      setMessage(chalk.cyan('Open: https://cli.github.com/ to install GitHub CLI'));
    }
  }

  // Lark CLI actions
  if (screen === 'lark') {
    if (option.key === 'install') {
      setMessage(chalk.cyan('Open: https://github.com/larksuite/cli to install lark-cli'));
    }
  }

  // Gateway actions
  if (screen === 'gateway') {
    if (option.key === 'start') {
      const projectRoot = process.cwd();
      setMessage(chalk.cyan(`cd ${projectRoot} && npm run gateway`));
    }
  }
}

render(<App />);
