import type { NormalizedLog, RawLogInput } from './types.js';

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequences intentionally contain control characters.
const ANSI_PATTERN = /\u001b(?:[@-Z\\-_]|\[[0-?]*[ -\/]*[@-~])/g;
// biome-ignore lint/suspicious/noControlCharactersInRegex: Backspace-overwrite cleanup intentionally matches the backspace control character.
const BACKSPACE_PATTERN = /.\u0008/g;

function stripAnsi(text: string): string {
  return text.replaceAll(ANSI_PATTERN, '');
}

function stripBackspaces(text: string): string {
  let current = text;
  while (BACKSPACE_PATTERN.test(current)) {
    current = current.replaceAll(BACKSPACE_PATTERN, '');
  }
  return current;
}

function normalizeLineEndings(text: string): string {
  return text.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
}

function isNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return false;
  }

  if (/^[⠁-⣿◐◓◑◒●○◌◍◔◕▪▫■□▲△▶▷▼▽◆◇★☆]+$/.test(trimmed)) {
    return true;
  }

  if (/^\[[=\-#>\s]{6,}\]\s*\d+%?$/.test(trimmed)) {
    return true;
  }

  if (/^\d+%(\s+\|.*)?$/.test(trimmed)) {
    return true;
  }

  if (
    /^(?:downloading|fetching|resolving|building|bundling)\b.+\.{2,}$/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  return false;
}

function compactBlankLines(lines: string[]): string[] {
  const compacted: string[] = [];

  for (const line of lines) {
    if (line.trim().length === 0) {
      if (compacted[compacted.length - 1] === '') {
        continue;
      }
      compacted.push('');
      continue;
    }

    compacted.push(line);
  }

  while (compacted[0] === '') {
    compacted.shift();
  }

  while (compacted[compacted.length - 1] === '') {
    compacted.pop();
  }

  return compacted;
}

function normalizeStream(text: string): {
  text: string;
  lines: string[];
} {
  const cleaned = compactBlankLines(
    normalizeLineEndings(stripBackspaces(stripAnsi(text)))
      .split('\n')
      .map((line) => line.replace(/\t/g, '  ').trimEnd())
      .filter((line) => !isNoiseLine(line)),
  );

  return {
    text: cleaned.join('\n'),
    lines: cleaned,
  };
}

export function normalizeLogs(input: RawLogInput): NormalizedLog {
  const stdout = normalizeStream(input.stdout);
  const stderr = normalizeStream(input.stderr);
  const combinedLines = compactBlankLines([
    ...stderr.lines,
    ...(stderr.lines.length > 0 && stdout.lines.length > 0 ? [''] : []),
    ...stdout.lines,
  ]);

  return {
    stdout: stdout.text,
    stderr: stderr.text,
    combined: combinedLines.join('\n'),
    stdoutLines: stdout.lines,
    stderrLines: stderr.lines,
    combinedLines,
  };
}
