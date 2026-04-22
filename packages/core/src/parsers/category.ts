import type { ErrorCategory } from '../types.js';

export function categorizeFromCommand(command: string): ErrorCategory {
  const normalized = command.toLowerCase();
  if (/\b(npm|pnpm|yarn)\s+(install|add|update)\b/.test(normalized)) {
    return 'dependency_install';
  }
  if (/\b(test|vitest|jest|cypress|playwright)\b/.test(normalized)) {
    return 'test_failure';
  }
  if (/\b(tsc|typecheck)\b/.test(normalized)) {
    return 'typescript_error';
  }
  if (/\b(build|vite build|next build|turbo build)\b/.test(normalized)) {
    return 'build_failure';
  }
  if (/\b(node|tsx|ts-node|python|ruby|go run)\b/.test(normalized)) {
    return 'runtime_error';
  }
  return 'unknown';
}
