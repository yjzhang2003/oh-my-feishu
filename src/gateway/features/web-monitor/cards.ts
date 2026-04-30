export function formatWebMonitorResultMessage(input: {
  success: boolean;
  stdout: string;
  stderr: string;
}): string {
  if (input.success) {
    return input.stdout.trim() || 'Web monitor task completed.';
  }

  return `Web monitor task failed:\n${input.stderr || input.stdout || 'Unknown error'}`;
}
