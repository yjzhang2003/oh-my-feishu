import React from 'react';
import { Box, Text } from 'ink';

interface FooterProps {
  hints: string[];
}

export function Footer({ hints }: FooterProps) {
  return (
    <Box marginTop={1}>
      <Text dimColor>{hints.join('  |  ')}</Text>
    </Box>
  );
}
