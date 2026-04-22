import type { ErrorCategory } from '../types.js';

export interface ParsedLog {
  category: ErrorCategory;
  keySnippet: string;
  summary: string;
}

const patterns: Array<{
  category: ErrorCategory;
  regex: RegExp;
  summary: string;
}> = [
  {
    category: 'typescript_error',
    regex: /TS\d{3,5}|Type '.*' is not assignable/i,
    summary: 'TypeScript compiler errors were detected in the log.',
  },
  {
    category: 'dependency_install',
    regex: /ERR_PNPM_|npm ERR!|yarn error|No matching version found/i,
    summary: 'Dependency installation problems were detected in the log.',
  },
  {
    category: 'test_failure',
    regex: /FAIL\s|failing|expected.*received|AssertionError/i,
    summary: 'Test failures were detected in the log.',
  },
  {
    category: 'build_failure',
    regex:
      /build failed|compilation failed|error during build|vite v.*building/i,
    summary: 'Build-time failures were detected in the log.',
  },
  {
    category: 'runtime_error',
    regex:
      /ReferenceError|TypeError|SyntaxError|UnhandledPromiseRejection|Cannot find module/i,
    summary: 'Runtime-style errors were detected in the log.',
  },
];

function extractSnippet(log: string): string {
  const lines = log
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const interesting = lines.find((line) =>
    /error|failed|exception|ERR_|TS\d{3,5}/i.test(line),
  );
  return interesting ?? lines.slice(0, 5).join('\n');
}

export function parseLogContent(log: string): ParsedLog {
  const keySnippet = extractSnippet(log);
  const match = patterns.find((entry) => entry.regex.test(log));
  if (!match) {
    return {
      category: 'unknown',
      keySnippet,
      summary:
        'The log contains an error, but it did not match a known failure pattern.',
    };
  }
  return {
    category: match.category,
    keySnippet,
    summary: match.summary,
  };
}
