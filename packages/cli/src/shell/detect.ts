import path from 'node:path';
import type { SupportedShell } from '@error2fix/core';

export function detectShell(explicitShell?: string): SupportedShell {
  const raw = explicitShell ?? process.env.SHELL ?? process.env.E2F_SHELL ?? '';
  const base = path.basename(raw).toLowerCase();
  if (base.includes('zsh')) {
    return 'zsh';
  }
  if (base.includes('bash')) {
    return 'bash';
  }
  if (base.includes('fish')) {
    return 'fish';
  }
  return 'unknown';
}
