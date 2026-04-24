#!/usr/bin/env node
import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import { getAllStatuses, ComponentStatus } from './hooks/useStatus.js';
import {
  getClaudeApiKey,
  setClaudeApiKey,
  resetClaudeApiKey,
  getEccPluginStatus,
  setFeishuCredentials,
  resetFeishuCredentials,
} from '../config/settings.js';
import { execa } from 'execa';
import { input, confirm } from '@inquirer/prompts';

// Status Panel Component
function StatusPanel({ statuses }: { statuses: Record<string, ComponentStatus> }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">Feishu Agent Setup</Text>
      <Text dimColor>{"=".repeat(30)}</Text>
      {Object.values(statuses).map((status) => (
        <Box key={status.name}>
          <Text color={status.configured ? 'green' : 'red'}>
            {status.configured ? '[+]' : '[x]'}
          </Text>
          <Text bold> {status.name}: </Text>
          <Text dimColor>{status.message}</Text>
        </Box>
      ))}
    </Box>
  );
}

// Main App
function App() {
  const { exit } = useApp();
  const [statuses, setStatuses] = useState<Record<string, ComponentStatus>>(getAllStatuses());
  const [screen, setScreen] = useState<'menu' | 'claude' | 'feishu' | 'github' | 'ecc'>('menu');
  const [message, setMessage] = useState<string>('');

  const refreshStatuses = () => {
    setStatuses(getAllStatuses());
  };

  const handleSelect = async (item: { value: string }) => {
    if (item.value === 'exit') {
      exit();
      return;
    }
    setScreen(item.value as typeof screen);
  };

  const handleClaudeConfig = async () => {
    const currentKey = getClaudeApiKey();
    console.log('\n');

    if (currentKey) {
      const action = await input({
        message: 'Action: [r]econfigure, [x]reset, [c]ancel',
        default: 'c',
      });

      if (action === 'r') {
        const newKey = await input({ message: 'Enter new ANTHROPIC_API_KEY' });
        if (newKey) {
          setClaudeApiKey(newKey);
          setMessage('✓ API key updated');
        }
      } else if (action === 'x') {
        const confirmed = await confirm({ message: 'Reset API key?', default: false });
        if (confirmed) {
          resetClaudeApiKey();
          setMessage('✓ API key removed');
        }
      }
    } else {
      const apiKey = await input({ message: 'Enter your ANTHROPIC_API_KEY' });
      if (apiKey) {
        setClaudeApiKey(apiKey);
        setMessage('✓ API key saved to ~/.claude/settings.json');
      }
    }

    refreshStatuses();
    setScreen('menu');
  };

  const handleFeishuConfig = async () => {
    const status = statuses.feishu;
    console.log('\n');

    if (status.configured) {
      const action = await input({
        message: 'Action: [r]econfigure, [x]reset, [c]ancel',
        default: 'c',
      });

      if (action === 'r') {
        const appId = await input({ message: 'FEISHU_APP_ID' });
        if (appId) {
          const appSecret = await input({ message: 'FEISHU_APP_SECRET' });
          if (appSecret) {
            setFeishuCredentials(appId, appSecret);
            setMessage('✓ Feishu credentials saved');
          }
        }
      } else if (action === 'x') {
        const confirmed = await confirm({ message: 'Reset Feishu credentials?', default: false });
        if (confirmed) {
          resetFeishuCredentials();
          setMessage('✓ Feishu credentials removed');
        }
      }
    } else {
      console.log('\nTip: Scan QR with "feishu-agent setup" to auto-create a bot\n');
      const appId = await input({ message: 'FEISHU_APP_ID' });
      if (appId) {
        const appSecret = await input({ message: 'FEISHU_APP_SECRET' });
        if (appSecret) {
          setFeishuCredentials(appId, appSecret);
          setMessage('✓ Feishu credentials saved to .env');
        }
      }
    }

    refreshStatuses();
    setScreen('menu');
  };

  const handleGitHubConfig = async () => {
    const status = statuses.github;
    console.log('\n');

    if (status.configured) {
      const action = await input({
        message: 'Action: [x]logout, [c]ancel',
        default: 'c',
      });

      if (action === 'x') {
        const confirmed = await confirm({ message: 'Logout from GitHub?', default: false });
        if (confirmed) {
          try {
            await execa('gh', ['auth', 'logout', '--hostname', 'github.com']);
            setMessage('✓ Logged out from GitHub');
          } catch {
            setMessage('✗ Failed to logout');
          }
        }
      }
    } else {
      console.log('\nThis will open a browser for GitHub OAuth login...\n');
      const confirmed = await confirm({ message: 'Continue?', default: true });
      if (confirmed) {
        try {
          await execa('gh', ['auth', 'login', '--git-protocol', 'https', '--web'], {
            stdio: 'inherit',
          });
          setMessage('✓ GitHub authenticated');
        } catch {
          setMessage('✗ Failed to authenticate');
        }
      }
    }

    refreshStatuses();
    setScreen('menu');
  };

  const handleEccConfig = async () => {
    const status = getEccPluginStatus();
    console.log('\n');

    if (status.installed) {
      const action = await input({
        message: 'Action: [u]pdate, [c]ancel',
        default: 'c',
      });

      if (action === 'u') {
        try {
          await execa('claude', ['plugins', 'update', 'everything-claude-code@everything-claude-code']);
          setMessage('✓ ECC plugin updated');
        } catch {
          setMessage('✗ Failed to update ECC plugin');
        }
      }
    } else {
      console.log('\nECC (Everything Claude Code) provides enhanced skills and agents.\n');
      const confirmed = await confirm({ message: 'Install ECC plugin?', default: true });
      if (confirmed) {
        try {
          await execa('claude', ['plugins', 'install', 'everything-claude-code@everything-claude-code']);
          setMessage('✓ ECC plugin installed');
        } catch {
          setMessage('✗ Failed to install ECC plugin');
        }
      }
    }

    refreshStatuses();
    setScreen('menu');
  };

  // Handle screen transitions
  useEffect(() => {
    if (screen === 'claude') {
      handleClaudeConfig();
    } else if (screen === 'feishu') {
      handleFeishuConfig();
    } else if (screen === 'github') {
      handleGitHubConfig();
    } else if (screen === 'ecc') {
      handleEccConfig();
    }
  }, [screen]);

  const menuItems = [
    { label: 'Claude Code', value: 'claude' },
    { label: 'Feishu', value: 'feishu' },
    { label: 'GitHub', value: 'github' },
    { label: 'ECC', value: 'ecc' },
    { label: 'Exit', value: 'exit' },
  ];

  if (screen !== 'menu') {
    return (
      <Box flexDirection="column">
        <Text dimColor>Loading...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <StatusPanel statuses={statuses} />

      {message && (
        <Box marginBottom={1}>
          <Text color="green">{message}</Text>
        </Box>
      )}

      <Box flexDirection="column">
        <Text dimColor>Select component:</Text>
        <SelectInput items={menuItems} onSelect={handleSelect} />
      </Box>
    </Box>
  );
}

// Run the app
render(<App />);
