import { getDefaultPluginRegistry } from '../plugin/registry.js';
import { runPlugins } from '../plugin/run.js';
import { buildPrompt } from '../prompt/generator.js';
import { promptStateSchema } from '../prompt/state.js';
import { buildSession } from '../session/capture.js';
import type { LatestRawCapture, ProjectContext } from '../types.js';
import type { Diagnosis, ErrorCategory, FailureSession } from '../types.js';
import type { CoreAnalysis, CoreAnalysisInput } from '../types/core.js';
import type { PluginRegistry } from '../types/plugin.js';
import { aggregateCoreAnalysis } from './aggregate.js';
import { buildCoreAnalysisInput } from './build-input.js';

function inferLegacyCategory(analysis: CoreAnalysis): ErrorCategory {
  if (
    analysis.pluginResults.some(
      (result) => result.matched && result.plugin === 'builtin-typescript',
    )
  ) {
    return 'typescript_error';
  }

  const snippet = analysis.keySnippet ?? '';
  if (/\btest\b/i.test(snippet)) {
    return 'test_failure';
  }
  if (/\b(build|compile|bundl)/i.test(snippet)) {
    return 'build_failure';
  }
  if (/\b(install|lockfile|registry|package manager)\b/i.test(snippet)) {
    return 'dependency_install';
  }
  if (snippet.length > 0) {
    return 'runtime_error';
  }

  return 'unknown';
}

function buildCompatPromptState(
  session: FailureSession,
  input: CoreAnalysisInput,
  context: ProjectContext,
  analysis: CoreAnalysis,
) {
  const runtime = [context.packageJson?.packageManager].filter(
    (value): value is string => Boolean(value),
  );
  const keywords = [
    ...input.signals.keywords,
    ...analysis.pluginResults.flatMap((result) => {
      const data = result.data;
      if (!data || typeof data !== 'object') {
        return [];
      }
      return Object.values(data)
        .filter((value): value is string[] => Array.isArray(value))
        .flat()
        .filter((value): value is string => typeof value === 'string');
    }),
  ].slice(0, 10);

  return promptStateSchema.parse({
    command: {
      raw: session.command,
      cwd: session.cwd,
      shell: session.shell,
      timestamp: session.timestamp,
    },
    host: {
      os: session.env.os,
      runtime,
    },
    failure: {
      exitCode: session.exitCode,
      category: undefined,
      summary: analysis.summary,
    },
    error: {
      snippet: analysis.keySnippet,
      stack: input.signals.stackLines,
      files: analysis.relatedFiles,
      keywords,
    },
    goal: {
      ask: ['root_cause', 'explanation', 'fix_steps', 'files_to_inspect'],
    },
  });
}

export interface DiagnosedFailure {
  session: FailureSession;
  context: ProjectContext;
  input: CoreAnalysisInput;
  analysis: CoreAnalysis;
  diagnosis: Diagnosis;
}

export async function diagnoseCapture(
  capture: LatestRawCapture,
  context: ProjectContext,
  registry: PluginRegistry = getDefaultPluginRegistry(),
): Promise<DiagnosedFailure> {
  const session = buildSession({
    command: capture.metadata.command,
    exitCode: capture.metadata.exitCode,
    cwd: capture.metadata.cwd,
    shell: capture.metadata.shell,
    timestamp: capture.metadata.timestamp,
    stdoutLogFile: capture.stdoutLogFile,
    stderrLogFile: capture.stderrLogFile,
    projectType: context.projectType,
  });

  const input = buildCoreAnalysisInput(capture, context);
  const pluginResults = await runPlugins(input, registry);
  const analysis = aggregateCoreAnalysis(input, pluginResults);
  const promptState = buildCompatPromptState(session, input, context, analysis);
  const diagnosis: Diagnosis = {
    category: inferLegacyCategory(analysis),
    summary: analysis.summary,
    likelyCauses: analysis.likelyCauses,
    suggestedNextSteps: analysis.nextSteps,
    keyErrorSnippet: analysis.keySnippet ?? '',
    promptState,
    prompt: buildPrompt(promptState),
  };

  session.projectType = context.projectType;
  session.stdoutSnippet = '';
  session.stderrSnippet = '';

  return {
    session,
    context,
    input,
    analysis,
    diagnosis,
  };
}
