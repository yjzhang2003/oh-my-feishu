import React from 'react';
import { Box, Text } from 'ink';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const width = Math.max(title.length + 4, 30);
  const topBorder = '┌' + '─'.repeat(width - 2) + '┐';
  const bottomBorder = '└' + '─'.repeat(width - 2) + '┘';
  const padding = Math.floor((width - title.length - 2) / 2);
  const titleLine = '│' + ' '.repeat(padding) + title + ' '.repeat(width - title.length - padding - 2) + '│';

  return (
    <Box flexDirection="column">
      <Text color="cyan">{topBorder}</Text>
      <Text color="cyan" bold>{titleLine}</Text>
      <Text color="cyan">{bottomBorder}</Text>
    </Box>
  );
}
