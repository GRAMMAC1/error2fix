import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type PromptEvalFixture,
  evaluateFixture,
  runPromptEval,
} from '../packages/core/src/evals/prompt-eval.js';

describe('prompt eval', () => {
  it('scores a fixture with complete signal extraction and prompt structure', async () => {
    const fixturePath = path.join(
      process.cwd(),
      'evals',
      'fixtures',
      'typescript-build-error.json',
    );
    const raw = await fs.readFile(fixturePath, 'utf8');
    const fixture = JSON.parse(raw) as PromptEvalFixture;

    const result = evaluateFixture(fixture);
    expect(result.stateScore).toBeGreaterThan(0.9);
    expect(result.promptScore).toBeGreaterThan(0.9);
    expect(result.issues).toEqual([]);
  });

  it('writes a prompt eval report for all fixtures', async () => {
    const report = await runPromptEval();
    expect(report.summary.cases).toBeGreaterThanOrEqual(5);
    expect(report.summary.avgStateScore).toBeGreaterThan(0.8);
    expect(report.summary.avgPromptScore).toBeGreaterThan(0.8);
  });
});
