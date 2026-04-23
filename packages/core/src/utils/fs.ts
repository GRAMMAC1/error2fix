import fs from 'node:fs/promises';

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function readFileIfPresent(filePath?: string): Promise<string> {
  if (!filePath) {
    return '';
  }

  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

export async function removeIfPresent(filePath?: string): Promise<void> {
  if (!filePath) {
    return;
  }

  try {
    await fs.rm(filePath, { force: true });
  } catch {
    // Ignore cleanup failures for transient shell hook files.
  }
}
