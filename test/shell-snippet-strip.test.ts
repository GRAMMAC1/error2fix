import { describe, expect, it } from 'vitest';
import {
  hasManagedSnippet,
  stripManagedSnippet,
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
});
