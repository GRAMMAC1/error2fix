import { getDefaultPluginRegistry } from '../plugin/registry.js';
import { runPlugins } from '../plugin/run.js';
import { buildPrompt } from '../prompt/generator.js';
import { buildPromptState } from '../prompt/state.js';
import { buildSession } from '../session/capture.js';
import type {
  ExplainResult,
  FailureSession,
  LatestRawCapture,
  ProjectContext,
} from '../types.js';
import type { PluginRegistry } from '../types/plugin.js';
import { aggregateCoreAnalysis } from './aggregate.js';
import { buildCoreAnalysisInput } from './build-input.js';

export async function diagnoseCapture(
  capture: LatestRawCapture,
  context: ProjectContext,
  registry: PluginRegistry = getDefaultPluginRegistry(),
): Promise<ExplainResult> {
  const session: FailureSession = buildSession({
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
  const promptState = buildPromptState(input, analysis);
  const prompt = buildPrompt(promptState);

  session.projectType = context.projectType;
  session.stdoutSnippet = input.capture.stdout;
  session.stderrSnippet = input.capture.stderr;

  return {
    session,
    context,
    input,
    analysis,
    promptState,
    prompt,
  };
}
