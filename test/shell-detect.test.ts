import { describe, expect, it } from 'vitest';
import { detectShell } from '../packages/cli/src/shell/detect.js';

describe('detectShell', () => {
  it('detects zsh', () => {
    expect(detectShell('/bin/zsh')).toBe('zsh');
  });

  it('detects bash', () => {
    expect(detectShell('/usr/local/bin/bash')).toBe('bash');
  });

  it('detects fish', () => {
    expect(detectShell('/opt/homebrew/bin/fish')).toBe('fish');
  });

  it('returns unknown for unsupported shells', () => {
    expect(detectShell('/bin/sh')).toBe('unknown');
  });
});
