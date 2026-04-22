import os from 'node:os';
import path from 'node:path';

export interface E2FPaths {
  homeDir: string;
  configFile: string;
  sessionsDir: string;
  latestSessionFile: string;
  logsDir: string;
  cacheDir: string;
}

export function getE2FPaths(
  baseDir = path.join(os.homedir(), '.e2f'),
): E2FPaths {
  return {
    homeDir: baseDir,
    configFile: path.join(baseDir, 'config.json'),
    sessionsDir: path.join(baseDir, 'sessions'),
    latestSessionFile: path.join(baseDir, 'sessions', 'latest.json'),
    logsDir: path.join(baseDir, 'logs'),
    cacheDir: path.join(baseDir, 'cache'),
  };
}
