import fs from 'node:fs/promises';
import { type E2FPaths, getE2FPaths } from '../utils/paths.js';

export async function ensureE2FDirs(paths = getE2FPaths()): Promise<E2FPaths> {
  await fs.mkdir(paths.homeDir, { recursive: true });
  await fs.mkdir(paths.logsDir, { recursive: true });
  await fs.mkdir(paths.cacheDir, { recursive: true });
  return paths;
}
