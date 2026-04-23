import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

export async function detectGitBranch(cwd: string): Promise<string | null> {
  try {
    const result = await execFile(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      {
        cwd,
      },
    );
    return result.stdout.trim() || null;
  } catch {
    return null;
  }
}
