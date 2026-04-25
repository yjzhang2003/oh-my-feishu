#!/usr/bin/env node
import React, { useState, useEffect, useCallback } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { resolve } from 'path';
import chalk from 'chalk';
import { SelectList } from './components/SelectList.js';
import { Header } from './components/Header.js';
import { Footer } from './components/Footer.js';
import { getAllStatuses, ComponentStatus, checkService, ServiceStatus } from './hooks/useStatus.js';
import { initLarkConfig, removeLarkConfig } from '../feishu/lark-auth.js';
import { execa } from 'execa';
import {
  beginRegistration,
  continueQRPolling,
  renderQRAscii,
  type QRBeginResult,
} from '../feishu/qr-onboarding.js';

type Screen = 'main' | 'claude' | 'feishu' | 'github' | 'service' | 'logs' | 'init' | 'qr';

const components = ['claude', 'feishu', 'github', 'service'] as const;
const componentNames = ['Claude Code', 'Feishu (Lark)', 'GitHub', 'Service'];

function App() {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>('main');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [statuses, setStatuses] = useState<Record<string, ComponentStatus>>({});
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [message, setMessage] = useState('');
  const [initOutput, setInitOutput] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [logsErr, setLogsErr] = useState<string[]>([]);
  const [logsOffset, setLogsOffset] = useState(0);
  const [logType, setLogType] = useState<'out' | 'err'>('out');

  // QR Auth state
  const [qrLines, setQrLines] = useState<string[]>([]);
  const [qrUrl, setQrUrl] = useState('');
  const [qrUserCode, setQrUserCode] = useState('');
  const [qrStatus, setQrStatus] = useState('Waiting for scan...');
  const [qrDeviceCode, setQrDeviceCode] = useState('');

  useEffect(() => {
    setStatuses(getAllStatuses());
    setServiceStatus(checkService());
  }, []);

  const refreshStatuses = useCallback(() => {
    setStatuses(getAllStatuses());
    setServiceStatus(checkService());
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
      if (screen === 'logs') {
        setScreen('service');
        setLogs([]);
        setLogsOffset(0);
      } else {
        const componentIndex = components.indexOf(screen as typeof components[number]);
        setScreen('main');
        setSelectedIndex(componentIndex >= 0 ? componentIndex : 1); // Default to feishu if coming from init
      }
      setMessage('');
      setInitOutput([]); // Clear init output when returning
      return;
    }

    // Logs screen navigation
    if (screen === 'logs') {
      const currentLogs = logType === 'out' ? logs : logsErr;
      const maxOffset = Math.max(0, currentLogs.length - 15);
      if (key.upArrow || input === 'k') {
        setLogsOffset((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow || input === 'j') {
        setLogsOffset((prev) => Math.min(maxOffset, prev + 1));
      } else if (input === 't') {
        setLogType((prev) => (prev === 'out' ? 'err' : 'out'));
        setLogsOffset(0);
      }
      return;
    }

    if (screen === 'init') return; // No input handling during init

    if (key.upArrow || input === 'k') {
      const maxIndex = getMaxIndex(screen, statuses, serviceStatus);
      setSubIndex((prev) => (prev - 1 + maxIndex) % maxIndex);
    } else if (key.downArrow || input === 'j') {
      const maxIndex = getMaxIndex(screen, statuses, serviceStatus);
      setSubIndex((prev) => (prev + 1) % maxIndex);
    } else if (key.return) {
      await executeAction(screen, subIndex, statuses, serviceStatus, {
        setMessage,
        refreshStatuses,
        setScreen,
        setInitOutput,
        setLogs,
        setLogsErr,
        setLogsOffset,
        setLogType,
        setQrLines,
        setQrUrl,
        setQrUserCode,
        setQrStatus,
        setQrDeviceCode,
      });
    }
  });

  if (screen === 'main') {
    const items = components.map((key, index) => {
      let status: string;
      let statusColor: 'green' | 'red' | 'yellow';

      if (key === 'service') {
        status = serviceStatus?.running ? '●' : '○';
        statusColor = serviceStatus?.running ? 'green' : 'red';
      } else {
        status = statuses[key]?.configured ? '✓' : '✗';
        statusColor = statuses[key]?.configured ? 'green' : 'red';
      }

      return {
        key,
        label: componentNames[index],
        status,
        statusColor,
      };
    });

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

  if (screen === 'logs') {
    const currentLogs = logType === 'out' ? logs : logsErr;
    const visibleLogs = currentLogs.slice(logsOffset, logsOffset + 15);
    const logTitle = logType === 'out' ? 'Service Logs (stdout)' : 'Service Logs (stderr)';

    return (
      <Box flexDirection="column" padding={1}>
        <Header title={logTitle} />
        <Box marginTop={1} flexDirection="column">
          {visibleLogs.length === 0 ? (
            <Text dimColor>No logs available</Text>
          ) : (
            visibleLogs.map((line, i) => (
              <Text key={i} color={logType === 'err' ? 'red' : 'white'}>{line}</Text>
            ))
          )}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Lines {logsOffset + 1}-{Math.min(logsOffset + 15, currentLogs.length)} of {currentLogs.length}</Text>
        </Box>
        <Footer hints={['↑↓ Scroll', 't Toggle stdout/stderr', 'ESC Back']} />
      </Box>
    );
  }

  // QR Auth screen
  if (screen === 'qr') {
    return (
      <Box flexDirection="column" padding={1}>
        <Header title="Feishu QR Auth" />
        <Box marginTop={1} flexDirection="column" alignItems="center">
          {qrLines.length > 0 ? (
            qrLines.map((line, i) => (
              <Text key={i} color="cyan">{line}</Text>
            ))
          ) : (
            <Text dimColor>Generating QR code...</Text>
          )}
        </Box>
        {qrUrl && (
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>Or open URL in browser:</Text>
            <Text color="blue">{qrUrl}</Text>
            {qrUserCode && <Text dimColor>User code: {qrUserCode}</Text>}
          </Box>
        )}
        <Box marginTop={1}>
          <Text color="yellow">{qrStatus}</Text>
        </Box>
        <Footer hints={['Scan with Feishu App...', 'ESC Cancel']} />
      </Box>
    );
  }

  const { options, status } = getScreenConfig(screen, statuses, serviceStatus);

  return (
    <Box flexDirection="column" padding={1}>
      <Header title={`${componentNames[components.indexOf(screen)]} Config`} />
      {status && (
        <Box marginTop={1}>
          <Text dimColor>Status: </Text>
          <Text color={screen === 'service' ? (serviceStatus?.running ? 'green' : 'yellow') : (statuses[screen]?.configured ? 'green' : 'yellow')}>{status}</Text>
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

function getMaxIndex(screen: Screen, statuses: Record<string, ComponentStatus>, serviceStatus?: ServiceStatus | null): number {
  const config = getScreenConfig(screen, statuses, serviceStatus);
  return config.options.length;
}

function getScreenConfig(screen: Screen, statuses: Record<string, ComponentStatus>, serviceStatus?: ServiceStatus | null) {
  if (screen === 'service') {
    const running = serviceStatus?.running;
    const statusText = running
      ? `Running | Uptime: ${serviceStatus.uptime || 'N/A'} | Memory: ${serviceStatus.memory || 'N/A'} | CPU: ${serviceStatus.cpu || 'N/A'}`
      : serviceStatus?.status || 'Not started';

    return {
      status: statusText,
      options: running
        ? [
            { key: 'stop', label: 'Stop Service', description: 'Stop the feishu-agent background service' },
            { key: 'restart', label: 'Restart Service', description: 'Restart the feishu-agent service' },
            { key: 'logs', label: 'View Logs', description: 'Open PM2 logs viewer' },
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ]
        : [
            { key: 'start', label: 'Start Service', description: 'Start feishu-agent as background service', status: '★', statusColor: 'yellow' as const },
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ],
    };
  }

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
            { key: 'reconfigure', label: 'Re-auth with QR', description: 'Scan QR code to re-authenticate' },
            { key: 'reset', label: 'Reset', description: 'Remove lark-cli config' },
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ]
        : [
            { key: 'qr', label: 'Auth with QR Code', description: 'Scan QR code with Feishu App (Recommended)', status: '★', statusColor: 'yellow' as const },
            { key: 'init', label: 'Auth with lark-cli', description: 'Browser-based authentication (legacy)' },
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
  serviceStatus: ServiceStatus | null,
  handlers: {
    setMessage: (msg: string) => void;
    refreshStatuses: () => void;
    setScreen: (s: Screen) => void;
    setInitOutput: React.Dispatch<React.SetStateAction<string[]>>;
    setLogs: React.Dispatch<React.SetStateAction<string[]>>;
    setLogsErr: React.Dispatch<React.SetStateAction<string[]>>;
    setLogsOffset: React.Dispatch<React.SetStateAction<number>>;
    setLogType: React.Dispatch<React.SetStateAction<'out' | 'err'>>;
    setQrLines: React.Dispatch<React.SetStateAction<string[]>>;
    setQrUrl: React.Dispatch<React.SetStateAction<string>>;
    setQrUserCode: React.Dispatch<React.SetStateAction<string>>;
    setQrStatus: React.Dispatch<React.SetStateAction<string>>;
    setQrDeviceCode: React.Dispatch<React.SetStateAction<string>>;
  }
) {
  const { setMessage, refreshStatuses, setScreen, setInitOutput, setLogs, setLogsErr, setLogsOffset, setLogType, setQrLines, setQrUrl, setQrUserCode, setQrStatus, setQrDeviceCode } = handlers;
  const config = getScreenConfig(screen, statuses, serviceStatus);
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
    if (option.key === 'qr' || option.key === 'reconfigure') {
      // QR Code authentication
      setScreen('qr');
      setQrLines([]);
      setQrUrl('');
      setQrUserCode('');
      setQrStatus('Connecting to Feishu...');
      setQrDeviceCode('');

      try {
        // Begin QR registration
        const begin = await beginRegistration('feishu');
        setQrDeviceCode(begin.deviceCode);
        setQrUrl(begin.qrUrl);
        setQrUserCode(begin.userCode);

        // Render QR code as ASCII
        if (begin.qrUrl) {
          const lines = await renderQRAscii(begin.qrUrl);
          setQrLines(lines);
        }

        setQrStatus('Waiting for scan...');

        // Start polling in background
        const result = await continueQRPolling(
          begin.deviceCode,
          'feishu',
          begin.interval,
          begin.expireIn,
          (attempt) => {
            setQrStatus(`Waiting for scan... (attempt ${attempt})`);
          }
        );

        if (result.success) {
          setQrStatus(chalk.green('✓ Authentication successful!'));
          setTimeout(() => {
            setScreen('feishu');
            refreshStatuses();
          }, 1500);
        } else if (result.error === 'expired') {
          setQrStatus(chalk.red('✗ QR code expired. Please try again.'));
        } else if (result.error === 'denied') {
          setQrStatus(chalk.red('✗ Authentication denied.'));
        } else {
          setQrStatus(chalk.red(`✗ ${result.error || 'Authentication failed'}`));
        }
      } catch (error) {
        setQrStatus(chalk.red(`✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    } else if (option.key === 'init') {
      // Legacy lark-cli authentication
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

  // Service actions
  if (screen === 'service') {
    if (option.key === 'start') {
      setMessage(chalk.cyan('Starting feishu-agent service...'));
      try {
        await execa('pm2', ['start', 'ecosystem.config.cjs']);
        setMessage(chalk.green('✓ Service started'));
        refreshStatuses();
      } catch (error) {
        setMessage(chalk.red(`✗ Failed to start: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    } else if (option.key === 'stop') {
      setMessage(chalk.cyan('Stopping feishu-agent service...'));
      try {
        await execa('pm2', ['stop', 'feishu-agent']);
        setMessage(chalk.green('✓ Service stopped'));
        refreshStatuses();
      } catch (error) {
        setMessage(chalk.red(`✗ Failed to stop: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    } else if (option.key === 'restart') {
      setMessage(chalk.cyan('Restarting feishu-agent service...'));
      try {
        await execa('pm2', ['restart', 'feishu-agent']);
        setMessage(chalk.green('✓ Service restarted'));
        refreshStatuses();
      } catch (error) {
        setMessage(chalk.red(`✗ Failed to restart: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    } else if (option.key === 'logs') {
      // Load logs from PM2 log files
      const { readFileSync, existsSync } = await import('fs');
      const logPath = './logs/pm2-out.log';
      const errLogPath = './logs/pm2-error.log';

      // Load stdout logs
      let logContent = '';
      try {
        if (existsSync(logPath)) {
          logContent = readFileSync(logPath, 'utf-8');
        }
      } catch {
        // Ignore read errors
      }

      // Load stderr logs
      let errLogContent = '';
      try {
        if (existsSync(errLogPath)) {
          errLogContent = readFileSync(errLogPath, 'utf-8');
        }
      } catch {
        // Ignore read errors
      }

      const logLines = logContent.trim().split('\n').filter(Boolean);
      const errLogLines = errLogContent.trim().split('\n').filter(Boolean);

      setLogs(logLines);
      setLogsErr(errLogLines);
      setLogsOffset(0);
      setLogType('out');
      setScreen('logs');
    }
  }
}

render(<App />);
