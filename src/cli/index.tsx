#!/usr/bin/env node
import React, { useState, useEffect, useCallback } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { resolve } from 'path';
import chalk from 'chalk';
import { SelectList } from './components/SelectList.js';
import { Header } from './components/Header.js';
import { Footer } from './components/Footer.js';
import { getAllStatuses, ComponentStatus } from './hooks/useStatus.js';
import { initLarkConfig, removeLarkConfig } from '../feishu/lark-auth.js';
import { execa } from 'execa';

type Screen = 'main' | 'claude' | 'feishu' | 'github' | 'init';

const components = ['claude', 'feishu', 'github'] as const;
const componentNames = ['Claude Code', 'Feishu (Lark)', 'GitHub'];

function App() {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>('main');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [statuses, setStatuses] = useState<Record<string, ComponentStatus>>({});
  const [message, setMessage] = useState('');
  const [initOutput, setInitOutput] = useState<string[]>([]);

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

  useInput(async (input, key) => {
    if (screen === 'main') return;

    if (key.escape) {
      const componentIndex = components.indexOf(screen as typeof components[number]);
      setScreen('main');
      setSelectedIndex(componentIndex >= 0 ? componentIndex : 1); // Default to feishu if coming from init
      setMessage('');
      setInitOutput([]); // Clear init output when returning
      return;
    }

    if (screen === 'init') return; // No input handling during init

    if (key.upArrow || input === 'k') {
      const maxIndex = getMaxIndex(screen, statuses);
      setSubIndex((prev) => (prev - 1 + maxIndex) % maxIndex);
    } else if (key.downArrow || input === 'j') {
      const maxIndex = getMaxIndex(screen, statuses);
      setSubIndex((prev) => (prev + 1) % maxIndex);
    } else if (key.return) {
      await executeAction(screen, subIndex, statuses, {
        setMessage,
        refreshStatuses,
        setScreen,
        setInitOutput,
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

  if (screen === 'init') {
    return (
      <Box flexDirection="column" padding={1}>
        <Header title="Lark CLI Auth" />
        <Box marginTop={1} flexDirection="column">
          {initOutput.map((line, i) => (
            <Text key={i}>{line}</Text>
          ))}
        </Box>
        {message && (
          <Box marginTop={1}>
            <Text>{message}</Text>
          </Box>
        )}
        <Footer hints={['Complete auth in browser...', 'ESC Cancel']} />
      </Box>
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
            { key: 'reconfigure', label: 'Re-auth', description: 'Re-authenticate with lark-cli' },
            { key: 'reset', label: 'Reset', description: 'Remove lark-cli config' },
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ]
        : [
            { key: 'init', label: 'Auth with lark-cli', description: 'Browser-based authentication', status: '★', statusColor: 'yellow' as const },
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

  return { status: '', options: [{ key: 'back', label: 'Back', description: 'Return to main menu' }] };
}

async function executeAction(
  screen: Screen,
  index: number,
  statuses: Record<string, ComponentStatus>,
  handlers: {
    setMessage: (msg: string) => void;
    refreshStatuses: () => void;
    setScreen: (s: Screen) => void;
    setInitOutput: React.Dispatch<React.SetStateAction<string[]>>;
  }
) {
  const { setMessage, refreshStatuses, setScreen, setInitOutput } = handlers;
  const config = getScreenConfig(screen, statuses);
  const option = config.options[index];

  if (!option || option.key === 'back') {
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
      setMessage(chalk.cyan(`claude ${workspacePath}`));
    }
  }

  // Feishu actions
  if (screen === 'feishu') {
    if (option.key === 'init' || option.key === 'reconfigure') {
      setScreen('init');
      setInitOutput(['Starting lark-cli config init...', '']);
      setMessage('');

      const result = await initLarkConfig((line) => {
        setInitOutput((prev) => [...prev, line]);
      });

      if (result.success) {
        setMessage(chalk.green('✓ Lark CLI configured successfully'));
        setScreen('feishu');
        refreshStatuses();
      } else {
        setMessage(chalk.red(`✗ ${result.error || 'Configuration failed'}`));
        setScreen('feishu');
      }
    } else if (option.key === 'reset') {
      const result = await removeLarkConfig();
      if (result.success) {
        setMessage(chalk.green('✓ Lark CLI config removed'));
      } else {
        setMessage(chalk.red(`✗ ${result.error || 'Failed to remove config'}`));
      }
      refreshStatuses();
    }
  }

  // GitHub actions
  if (screen === 'github') {
    if (option.key === 'install') {
      setMessage(chalk.cyan('Run: brew install gh  OR  visit https://cli.github.com/'));
    }
  }
}

render(<App />);
