import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildProjectContext } from '../packages/core/src/context/project.js';

describe('buildProjectContext', () => {
  const cleanup: string[] = [];

  afterEach(async () => {
    await Promise.all(
      cleanup
        .splice(0)
        .map((entry) => fs.rm(entry, { recursive: true, force: true })),
    );
  });

  it('detects nextjs project context', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'e2f-next-'));
    cleanup.push(cwd);
    await fs.writeFile(
      path.join(cwd, 'package.json'),
      JSON.stringify(
        {
          name: 'demo',
          scripts: { build: 'next build' },
          dependencies: { next: '15.0.0', react: '19.0.0' },
        },
        null,
        2,
      ),
    );
    await fs.writeFile(
      path.join(cwd, 'next.config.js'),
      'module.exports = {};\n',
    );
    await fs.writeFile(
      path.join(cwd, 'tsconfig.json'),
      JSON.stringify(
        { compilerOptions: { jsx: 'preserve', strict: true } },
        null,
        2,
      ),
    );
    const context = await buildProjectContext(cwd);
    expect(context.framework).toBe('nextjs');
    expect(context.projectType).toBe('nextjs');
    expect(context.packageJson?.scripts.build).toBe('next build');
  });
});
