import os from 'node:os';
import path from 'node:path';

export interface E2FPaths {
  homeDir: string;
  configFile: string;
  logsDir: string;
  latestStdoutLogFile: string;
  latestStderrLogFile: string;
  cacheDir: string;
}

export function getE2FPaths(
  baseDir = path.join(os.homedir(), '.e2f'),
): E2FPaths {
  return {
    homeDir: baseDir,
    configFile: path.join(baseDir, 'config.json'),
    logsDir: path.join(baseDir, 'logs'),
    latestStdoutLogFile: path.join(baseDir, 'logs', 'latest.stdout.log'),
    latestStderrLogFile: path.join(baseDir, 'logs', 'latest.stderr.log'),
    cacheDir: path.join(baseDir, 'cache'),
  };
}
