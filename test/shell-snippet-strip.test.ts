import { describe, expect, it } from 'vitest';
import {
  getShellSnippet,
  hasManagedSnippet,
  stripManagedSnippet,
  upsertManagedSnippet,
} from '../packages/cli/src/shell/snippets.js';

describe('stripManagedSnippet', () => {
  it('removes the managed snippet block', () => {
    const content = [
      'export PATH=$PATH:$HOME/bin',
      '',
      '# >>> e2f init >>>',
      'autoload -Uz add-zsh-hook',
      '# <<< e2f init <<<',
      '',
      "alias ll='ls -la'",
      '',
    ].join('\n');

    expect(hasManagedSnippet(content)).toBe(true);
    const result = stripManagedSnippet(content);
    expect(result.removed).toBe(true);
    expect(result.content).toContain('export PATH=$PATH:$HOME/bin');
    expect(result.content).toContain("alias ll='ls -la'");
    expect(result.content).not.toContain('# >>> e2f init >>>');
  });

  it('includes raw stdout and stderr log capture in zsh and bash snippets', () => {
    const zshSnippet = getShellSnippet('zsh');
    const bashSnippet = getShellSnippet('bash');

    expect(zshSnippet).toContain('--stdout-log "$E2F_CAPTURE_STDOUT"');
    expect(zshSnippet).toContain('--stderr-log "$E2F_CAPTURE_STDERR"');
    expect(bashSnippet).toContain('--stdout-log "$__E2F_CAPTURE_STDOUT"');
    expect(bashSnippet).toContain('--stderr-log "$__E2F_CAPTURE_STDERR"');
  });

  it('replaces an existing managed snippet when the generated snippet changes', () => {
    const oldContent = [
      'export PATH=$PATH:$HOME/bin',
      '',
      '# >>> e2f init >>>',
      'autoload -Uz add-zsh-hook',
      'typeset -g E2F_LAST_COMMAND=""',
      '# <<< e2f init <<<',
      '',
    ].join('\n');

    const snippet = getShellSnippet('zsh');
    const result = upsertManagedSnippet(oldContent, snippet);

    expect(result.changed).toBe(true);
    expect(result.replaced).toBe(true);
    expect(result.content).toContain('export PATH=$PATH:$HOME/bin');
    expect(result.content).toContain('--stdout-log "$E2F_CAPTURE_STDOUT"');
    expect(result.content).toContain('--stderr-log "$E2F_CAPTURE_STDERR"');
  });
});
