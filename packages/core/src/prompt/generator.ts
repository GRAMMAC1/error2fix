import { categorizeFromCommand } from '../parsers/category.js';
import type { Diagnosis, FailureSession, ProjectContext } from '../types.js';
import { type PromptState, buildPromptState } from './state.js';

function makeLikelyCauses(
  category: Diagnosis['category'],
  framework: string,
): string[] {
  switch (category) {
    case 'dependency_install':
      return [
        'Lockfile drift or stale package metadata',
        'Registry/auth issue',
        'Version conflict in dependency graph',
      ];
    case 'build_failure':
      return [
        `${framework} config mismatch`,
        'Missing dependency or import',
        'Compile-time configuration regression',
      ];
    case 'typescript_error':
      return [
        'Incorrect type usage',
        'Type definition drift after dependency change',
        'tsconfig option mismatch',
      ];
    case 'test_failure':
      return [
        'Behavior regression',
        'Broken test fixture or environment setup',
        'Assertion expecting outdated output',
      ];
    case 'runtime_error':
      return [
        'Unexpected null/undefined path',
        'Missing file/module at runtime',
        'Incorrect environment assumptions',
      ];
    default:
      return [
        'The command itself may need a closer log review',
        'The failure may depend on project-specific configuration',
      ];
  }
}

function makeNextSteps(category: Diagnosis['category']): string[] {
  switch (category) {
    case 'dependency_install':
      return [
        'Check package manager and lockfile consistency',
        'Inspect the first package resolution error',
        'Verify registry/auth configuration if private packages are involved',
      ];
    case 'build_failure':
      return [
        'Inspect the first compile/build error',
        'Review recent config and dependency changes',
        'Validate referenced files and imports exist',
      ];
    case 'typescript_error':
      return [
        'Open the first TypeScript error location',
        'Compare the offending types with expected interfaces',
        'Review tsconfig compiler options that affect resolution and JSX',
      ];
    case 'test_failure':
      return [
        'Open the first failing test',
        'Compare expected output with current behavior',
        'Check fixtures, mocks, and environment setup',
      ];
    case 'runtime_error':
      return [
        'Inspect the top stack frame or first runtime error line',
        'Validate environment variables and file paths',
        'Trace the code path that produced the thrown value',
      ];
    default:
      return [
        'Inspect the original command output if available',
        'Reproduce with verbose logging if safe',
        'Review project config and the most likely failing script',
      ];
  }
}

function formatGoal(
  goal: PromptState['goal']['ask'][number],
  index: number,
): string {
  const labels: Record<PromptState['goal']['ask'][number], string> = {
    root_cause: 'Root cause',
    explanation: 'Explanation',
    fix_steps: 'Concrete fix steps',
    files_to_inspect: 'Files to inspect',
  };
  return `${index + 1}. ${labels[goal]}`;
}

export function buildDiagnosis(
  session: FailureSession,
  context: ProjectContext,
  parsedCategory?: Diagnosis['category'],
  parsedSummary?: string,
  analysisText = '',
): Diagnosis {
  const category = parsedCategory ?? categorizeFromCommand(session.command);
  const summary =
    parsedSummary ??
    `Command "${session.command}" exited with code ${session.exitCode} in a ${context.projectType} project.`;
  const likelyCauses = makeLikelyCauses(category, context.framework);
  const suggestedNextSteps = makeNextSteps(category);
  const keyErrorSnippet = analysisText.trim()
    ? analysisText.trim().slice(-2000)
    : '';
  const promptState = buildPromptState(session, context, {
    category,
    summary,
    errorText: analysisText,
    displaySnippet: keyErrorSnippet,
  });
  const prompt = buildPrompt(promptState);

  return {
    category,
    summary,
    likelyCauses,
    suggestedNextSteps,
    keyErrorSnippet,
    promptState,
    prompt,
  };
}

export function buildPrompt(state: PromptState): string {
  const runtimeSummary = state.host?.runtime?.join(', ') ?? 'unknown';
  const stackLines = state.error.stack?.length
    ? state.error.stack.map((line) => `  ${line}`).join('\n')
    : '  None extracted';
  const relatedFiles = state.error.files?.length
    ? state.error.files.map((file) => `  ${file}`).join('\n')
    : '  None extracted';
  const keywords = state.error.keywords?.length
    ? state.error.keywords.join(', ')
    : 'none';

  return [
    'You are diagnosing a failed developer terminal command.',
    '',
    'Command:',
    `- Raw command: ${state.command.raw}`,
    `- Working directory: ${state.command.cwd}`,
    `- Shell: ${state.command.shell ?? 'unknown'}`,
    `- Timestamp: ${state.command.timestamp}`,
    '',
    'Host:',
    `- OS: ${state.host?.os ?? 'unknown'}`,
    `- Runtime/tools: ${runtimeSummary}`,
    '',
    'Failure:',
    `- Exit code: ${state.failure.exitCode}`,
    `- Signal: ${state.failure.signal ?? 'none'}`,
    `- Category: ${state.failure.category ?? 'unknown'}`,
    `- Summary: ${state.failure.summary ?? 'No summary available'}`,
    '',
    'Error details:',
    `- Key snippet: ${state.error.snippet ?? 'No log snippet captured in this session.'}`,
    '- Stack lines:',
    stackLines,
    '- Related files:',
    relatedFiles,
    `- Keywords: ${keywords}`,
    '',
    'Please provide:',
    ...state.goal.ask.map((goal, index) => formatGoal(goal, index)),
  ].join('\n');
}
