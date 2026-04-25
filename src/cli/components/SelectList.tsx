import React from 'react';
import { Box, Text } from 'ink';

interface SelectItem {
  key: string;
  label: string;
  description?: string;
  status?: string;
  statusColor?: 'green' | 'red' | 'yellow' | 'blue' | 'cyan' | 'magenta' | 'gray';
}

interface SelectListProps {
  items: SelectItem[];
  selectedIndex: number;
}

export function SelectList({ items, selectedIndex }: SelectListProps) {
  return (
    <Box flexDirection="column">
      {items.map((item, index) => {
        const isSelected = index === selectedIndex;
        const prefix = isSelected ? '❯ ' : '  ';
        
        return (
          <Box key={item.key}>
            <Text color={isSelected ? 'cyan' : undefined}>{prefix}</Text>
            <Text color={isSelected ? 'white' : 'gray'} bold={isSelected}>
              {item.label}
            </Text>
            {item.description && (
              <Text dimColor>  {item.description}</Text>
            )}
            {item.status !== undefined && (
              <Box marginLeft={1}>
                <Text color={item.statusColor || 'gray'} dimColor={!isSelected}>
                  [{item.status}]
                </Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
