import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { Header } from './Header.js';
import { Footer } from './Footer.js';
import {
  initRegistration,
  beginRegistration,
  pollOnce,
  generateQrString,
  RegisterResult,
} from '../../feishu/qr-register.js';

const SUCCESS_DELAY_MS = 1500;
const DEFAULT_POLL_INTERVAL_MS = 3000;

interface QrScreenProps {
  onSuccess: (result: RegisterResult) => void;
  onCancel: () => void;
}

export function QrScreen({ onSuccess, onCancel }: QrScreenProps) {
  const [phase, setPhase] = useState<'connecting' | 'waiting' | 'success' | 'denied' | 'expired' | 'timeout' | 'error'>('connecting');
  const [message, setMessage] = useState('Connecting to Feishu...');
  const [qrString, setQrString] = useState<string>('');
  const [qrUrl, setQrUrl] = useState<string>('');
  const [deviceCode, setDeviceCode] = useState<string>('');
  const [domain, setDomain] = useState<string>('feishu');
  const [dots, setDots] = useState('');
  const [pollInterval, setPollInterval] = useState(DEFAULT_POLL_INTERVAL_MS);

  // Track mounted state to prevent updates after unmount
  const mountedRef = useRef(true);

  // Initialize QR registration
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await initRegistration('feishu');
        if (cancelled || !mountedRef.current) return;

        const begin = await beginRegistration('feishu');
        if (cancelled || !mountedRef.current) return;

        const qr = await generateQrString(begin.qr_url);
        if (cancelled || !mountedRef.current) return;

        setDeviceCode(begin.device_code);
        setQrString(qr);
        setQrUrl(begin.qr_url);
        setPollInterval((begin.interval || 5) * 1000);
        setPhase('waiting');
        setMessage('Scan the QR code with Feishu / Lark');
      } catch (err) {
        if (cancelled || !mountedRef.current) return;
        setPhase('error');
        setMessage(`Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  // Polling
  useEffect(() => {
    if (phase !== 'waiting' || !deviceCode) return;

    let cancelled = false;
    let pollTimeoutId: ReturnType<typeof setTimeout>;
    let successTimeoutId: ReturnType<typeof setTimeout>;

    async function poll() {
      const result = await pollOnce(deviceCode, domain);

      if (cancelled || !mountedRef.current) return;

      if (result.newDomain && result.newDomain !== domain) {
        setDomain(result.newDomain);
      }

      if (result.status === 'success' && result.result) {
        setPhase('success');
        setMessage('Bot created successfully!');
        successTimeoutId = setTimeout(() => {
          if (mountedRef.current && result.result) {
            onSuccess(result.result);
          }
        }, SUCCESS_DELAY_MS);
      } else if (result.status === 'denied') {
        setPhase('denied');
        setMessage('Registration denied by user');
      } else if (result.status === 'expired') {
        setPhase('expired');
        setMessage('QR code expired. Please try again.');
      } else {
        // Continue polling
        pollTimeoutId = setTimeout(poll, pollInterval);
        setDots((d) => (d.length >= 3 ? '' : d + '.'));
      }
    }

    poll();

    return () => {
      cancelled = true;
      clearTimeout(pollTimeoutId);
      clearTimeout(successTimeoutId);
    };
  }, [phase, deviceCode, domain, pollInterval, onSuccess]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Header title="Scan QR to Create Bot" />
      
      {phase === 'connecting' && (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>{message}</Text>
        </Box>
      )}

      {phase === 'waiting' && (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>{message}{dots}</Text>
          {qrString && (
            <Box marginTop={1}>
              <Text color="cyan">{qrString}</Text>
            </Box>
          )}
          {qrUrl && (
            <Box marginTop={1}>
              <Text dimColor>Or open: </Text>
              <Text color="blue">{qrUrl.slice(0, 50)}...</Text>
            </Box>
          )}
        </Box>
      )}

      {(phase === 'success' || phase === 'denied' || phase === 'expired' || phase === 'error') && (
        <Box marginTop={1} flexDirection="column">
          <Text color={phase === 'success' ? 'green' : 'red'}>{message}</Text>
        </Box>
      )}

      <Footer hints={phase === 'waiting' ? ['ESC Cancel', 'Waiting for scan...'] : ['ESC Back']} />
    </Box>
  );
}
