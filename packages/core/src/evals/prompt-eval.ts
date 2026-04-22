import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { buildDiagnosis } from '../prompt/generator.js';
import type {
  ErrorCategory,
  FailureSession,
  ProjectContext,
} from '../types.js';

const failureSessionSchema = z.object({
  id: z.string(),
  command: z.string(),
  exitCode: z.number().int(),
  cwd: z.string(),
  shell: z.enum(['zsh', 'bash', 'fish', 'unknown']),
  timestamp: z.string(),
  stdoutSnippet: z.string(),
  stderrSnippet: z.string(),
  projectType: z.string(),
  env: z.object({
    os: z.string(),
    nodeVersion: z.string(),
    packageManager: z.string(),
  }),
});

const projectContextSchema = z.object({
  cwd: z.string(),
  packageJson: z
    .object({
      name: z.string().optional(),
      private: z.boolean().optional(),
      packageManager: z.string().optional(),
      scripts: z.record(z.string(), z.string()),
      dependencies: z.array(z.string()),
      devDependencies: z.array(z.string()),
    })
    .nullable(),
  lockfiles: z.array(z.string()),
  tsconfig: z.object({
    exists: z.boolean(),
    compilerOptions: z.record(z.string(), z.unknown()),
  }),
  configFiles: z.array(z.string()),
  framework: z.string(),
  projectType: z.string(),
  gitBranch: z.string().nullable(),
});

const evalFixtureSchema = z.object({
  name: z.string(),
  parsed: z
    .object({
      category: z
        .enum([
          'dependency_install',
          'build_failure',
          'typescript_error',
          'test_failure',
          'runtime_error',
          'unknown',
        ])
        .optional(),
      summary: z.string().optional(),
      errorText: z.string().optional(),
    })
    .optional(),
  session: failureSessionSchema,
  context: projectContextSchema,
  expectedState: z.object({
    failureCategory: z
      .enum(['compile', 'runtime', 'test', 'dependency', 'config', 'unknown'])
      .optional(),
    mustIncludeFiles: z.array(z.string()).default([]),
    mustIncludeKeywords: z.array(z.string()).default([]),
    mustHaveSnippet: z.boolean().default(true),
  }),
  expectedPrompt: z.object({
    requiredSections: z.array(z.string()).default([]),
    requiredStrings: z.array(z.string()).default([]),
    requiredGoals: z.array(z.string()).default([]),
  }),
});

export type PromptEvalFixture = z.infer<typeof evalFixtureSchema>;

export interface CaseReport {
  name: string;
  stateScore: number;
  promptScore: number;
  overallScore: number;
  issues: string[];
  checks: Record<string, boolean | number>;
}

export interface EvalReport {
  generatedAt: string;
  summary: {
    cases: number;
    avgStateScore: number;
    avgPromptScore: number;
    avgOverallScore: number;
  };
  cases: CaseReport[];
}

function ratio(hit: number, total: number): number {
  if (total === 0) {
    return 1;
  }
  return hit / total;
}

function includesAll(text: string, values: string[]): boolean {
  return values.every((value) => text.includes(value));
}

export function evaluateFixture(fixture: PromptEvalFixture): CaseReport {
  const session = fixture.session as FailureSession;
  const context = fixture.context as ProjectContext;
  const diagnosis = buildDiagnosis(
    session,
    context,
    fixture.parsed?.category as ErrorCategory | undefined,
    fixture.parsed?.summary,
    fixture.parsed?.errorText ?? session.stderrSnippet ?? session.stdoutSnippet,
  );

  const issues: string[] = [];
  const snippetPresent = Boolean(diagnosis.promptState.error.snippet);
  const categoryCorrect = fixture.expectedState.failureCategory
    ? diagnosis.promptState.failure.category ===
      fixture.expectedState.failureCategory
    : true;
  const fileHits = fixture.expectedState.mustIncludeFiles.filter((file) =>
    diagnosis.promptState.error.files?.includes(file),
  ).length;
  const keywordHits = fixture.expectedState.mustIncludeKeywords.filter(
    (keyword) => diagnosis.promptState.error.keywords?.includes(keyword),
  ).length;
  const fileScore = ratio(
    fileHits,
    fixture.expectedState.mustIncludeFiles.length,
  );
  const keywordScore = ratio(
    keywordHits,
    fixture.expectedState.mustIncludeKeywords.length,
  );
  const requiredFieldsPresent = Boolean(
    diagnosis.promptState.command.raw &&
      diagnosis.promptState.command.cwd &&
      diagnosis.promptState.failure.exitCode >= 0 &&
      diagnosis.promptState.goal.ask.length > 0,
  );

  if (fixture.expectedState.mustHaveSnippet && !snippetPresent) {
    issues.push('missing error snippet');
  }
  if (!categoryCorrect) {
    issues.push('failure category mismatch');
  }
  if (fileScore < 1) {
    issues.push('missing related files');
  }
  if (keywordScore < 1) {
    issues.push('missing keywords');
  }

  const requiredSections = fixture.expectedPrompt.requiredSections;
  const sectionScore = ratio(
    requiredSections.filter((section) => diagnosis.prompt.includes(section))
      .length,
    requiredSections.length,
  );
  const requiredStringScore = ratio(
    fixture.expectedPrompt.requiredStrings.filter((value) =>
      diagnosis.prompt.includes(value),
    ).length,
    fixture.expectedPrompt.requiredStrings.length,
  );
  const requiredGoalScore = ratio(
    fixture.expectedPrompt.requiredGoals.filter((goal) =>
      diagnosis.prompt.includes(goal),
    ).length,
    fixture.expectedPrompt.requiredGoals.length,
  );
  const sectionOrderValid =
    diagnosis.prompt.indexOf('Command:') < diagnosis.prompt.indexOf('Host:') &&
    diagnosis.prompt.indexOf('Host:') < diagnosis.prompt.indexOf('Failure:') &&
    diagnosis.prompt.indexOf('Failure:') <
      diagnosis.prompt.indexOf('Error details:') &&
    diagnosis.prompt.indexOf('Error details:') <
      diagnosis.prompt.indexOf('Please provide:');

  if (sectionScore < 1) {
    issues.push('missing prompt sections');
  }
  if (requiredStringScore < 1) {
    issues.push('missing required prompt strings');
  }
  if (requiredGoalScore < 1) {
    issues.push('missing requested output goals');
  }
  if (!sectionOrderValid) {
    issues.push('invalid prompt section order');
  }

  const stateScore =
    [
      fixture.expectedState.mustHaveSnippet ? Number(snippetPresent) : 1,
      Number(categoryCorrect),
      fileScore,
      keywordScore,
      Number(requiredFieldsPresent),
    ].reduce((sum, value) => sum + value, 0) / 5;

  const promptScore =
    [
      sectionScore,
      requiredStringScore,
      requiredGoalScore,
      Number(sectionOrderValid),
      Number(includesAll(diagnosis.prompt, ['Command:', 'Error details:'])),
    ].reduce((sum, value) => sum + value, 0) / 5;

  return {
    name: fixture.name,
    stateScore,
    promptScore,
    overallScore: (stateScore + promptScore) / 2,
    issues,
    checks: {
      snippetPresent,
      categoryCorrect,
      fileScore,
      keywordScore,
      requiredFieldsPresent,
      sectionScore,
      requiredStringScore,
      requiredGoalScore,
      sectionOrderValid,
    },
  };
}

async function loadFixtures(fixturesDir: string): Promise<PromptEvalFixture[]> {
  const entries = await fs.readdir(fixturesDir);
  const fixtureFiles = entries
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  return Promise.all(
    fixtureFiles.map(async (entry) => {
      const filePath = path.join(fixturesDir, entry);
      const raw = await fs.readFile(filePath, 'utf8');
      return evalFixtureSchema.parse(JSON.parse(raw));
    }),
  );
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function runPromptEval(): Promise<EvalReport> {
  const repoRoot = process.cwd();
  const fixturesDir = path.join(repoRoot, 'evals', 'fixtures');
  const reportsDir = path.join(repoRoot, 'evals', 'reports');
  await fs.mkdir(reportsDir, { recursive: true });

  const fixtures = await loadFixtures(fixturesDir);
  const cases = fixtures.map((fixture) => evaluateFixture(fixture));
  const report: EvalReport = {
    generatedAt: new Date().toISOString(),
    summary: {
      cases: cases.length,
      avgStateScore: average(cases.map((item) => item.stateScore)),
      avgPromptScore: average(cases.map((item) => item.promptScore)),
      avgOverallScore: average(cases.map((item) => item.overallScore)),
    },
    cases,
  };

  const reportPath = path.join(reportsDir, 'report.prompt.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
  return report;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

async function main(): Promise<void> {
  const report = await runPromptEval();
  console.log(`Prompt eval cases: ${report.summary.cases}`);
  console.log(
    `Average state score: ${formatPercent(report.summary.avgStateScore)}`,
  );
  console.log(
    `Average prompt score: ${formatPercent(report.summary.avgPromptScore)}`,
  );
  console.log(
    `Average overall score: ${formatPercent(report.summary.avgOverallScore)}`,
  );

  for (const item of report.cases) {
    const suffix =
      item.issues.length > 0 ? ` issues=${item.issues.join(', ')}` : '';
    console.log(
      `- ${item.name}: overall=${formatPercent(item.overallScore)} state=${formatPercent(item.stateScore)} prompt=${formatPercent(item.promptScore)}${suffix}`,
    );
  }

  console.log('Report written to evals/reports/prompt-report.json');
}

if (process.argv[1]) {
  const entryUrl = pathToFileURL(process.argv[1]).href;
  if (import.meta.url === entryUrl) {
    await main();
  }
}
