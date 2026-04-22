import fs from 'node:fs/promises';
import path from 'node:path';
import { readJsonFile } from '../utils/fs.js';
import { type E2FPaths, getE2FPaths } from '../utils/paths.js';
import { type FailureSessionRecord, failureSessionSchema } from './schema.js';

export async function ensureE2FDirs(paths = getE2FPaths()): Promise<E2FPaths> {
  await fs.mkdir(paths.homeDir, { recursive: true });
  await fs.mkdir(paths.sessionsDir, { recursive: true });
  await fs.mkdir(paths.logsDir, { recursive: true });
  await fs.mkdir(paths.cacheDir, { recursive: true });
  return paths;
}

export async function saveSession(
  session: FailureSessionRecord,
  paths = getE2FPaths(),
): Promise<{ filePath: string; latestPath: string }> {
  await ensureE2FDirs(paths);
  const filePath = path.join(paths.sessionsDir, `${session.id}.json`);
  const json = JSON.stringify(session, null, 2);
  await fs.writeFile(filePath, json, 'utf8');
  await fs.writeFile(paths.latestSessionFile, json, 'utf8');
  return { filePath, latestPath: paths.latestSessionFile };
}

export async function loadLatestSession(
  paths = getE2FPaths(),
): Promise<FailureSessionRecord | null> {
  const raw = await readJsonFile<unknown>(paths.latestSessionFile);
  const parsed = failureSessionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function listSessions(
  limit = 10,
  paths = getE2FPaths(),
): Promise<FailureSessionRecord[]> {
  try {
    const entries = await fs.readdir(paths.sessionsDir);
    const sessionFiles = entries.filter(
      (entry) => entry.endsWith('.json') && entry !== 'latest.json',
    );
    const loaded = await Promise.all(
      sessionFiles.map(async (entry) => {
        const raw = await readJsonFile<unknown>(
          path.join(paths.sessionsDir, entry),
        );
        const parsed = failureSessionSchema.safeParse(raw);
        return parsed.success ? parsed.data : null;
      }),
    );
    return loaded
      .filter((entry): entry is FailureSessionRecord => entry !== null)
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
      .slice(0, limit);
  } catch {
    return [];
  }
}
