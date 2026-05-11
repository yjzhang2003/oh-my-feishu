import { execFileSync } from 'node:child_process';

const trackedDocs = execFileSync('git', ['ls-files', 'docs/'], { encoding: 'utf8' })
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

if (trackedDocs.length > 0) {
  console.error('Root docs/ is private and must not be tracked:');
  for (const file of trackedDocs) {
    console.error(`- ${file}`);
  }
  console.error('Move public docs to showcase/src/content/docs/ instead.');
  process.exit(1);
}

console.log('No root docs/ files are tracked.');
