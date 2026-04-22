import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const sourceReadme = path.join(repoRoot, 'README.md');
const cliPackageDir = path.join(repoRoot, 'packages', 'cli');
const targetReadme = path.join(cliPackageDir, 'README.md');

await fs.copyFile(sourceReadme, targetReadme);
console.log(`Synced README to ${targetReadme}`);
