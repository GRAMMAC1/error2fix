import type { FailureEvidence } from '../diagnosis/evidence.js';
import type { CoreAnalysisInput } from '../types/core.js';
import type { Error2FixPlugin } from '../types/plugin.js';
import { readAnalysisLogText, unique } from '../utils/text.js';
import { type RegexRule, matchRegexRules } from './rule-utils.js';

interface DependencyResolutionContext {
  packageManagerFiles: string[];
}

interface DependencyResolutionData {
  evidences: FailureEvidence[];
}

const PACKAGE_MANAGER_FILES = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
]);

const DEPENDENCY_RULES: RegexRule[] = [
  {
    id: 'dependency.module-not-found',
    source: 'dependency',
    category: 'module_resolution',
    pattern:
      /(?:Cannot find module ['"][^'"]+['"][^\n]*|Module not found: Error: Can't resolve ['"][^'"]+['"][^\n]*|Could not resolve ['"][^'"]+['"][^\n]*)/gi,
    priority: 92,
    confidence: 84,
  },
  {
    id: 'dependency.missing-type-declaration',
    source: 'dependency',
    category: 'type_declaration',
    pattern:
      /(?:Could not find a declaration file for module ['"][^'"]+['"][^\n]*|Cannot find type definition file for ['"][^'"]+['"][^\n]*|or its corresponding type declarations[^\n]*)/gi,
    priority: 88,
    confidence: 80,
  },
  {
    id: 'dependency.package-exports',
    source: 'dependency',
    category: 'package_exports',
    pattern:
      /(?:Package subpath ['"][^'"]+['"] is not defined by "exports"[^\n]*|No "exports" main defined[^\n]*|ERR_PACKAGE_PATH_NOT_EXPORTED[^\n]*)/gi,
    priority: 90,
    confidence: 82,
  },
  {
    id: 'dependency.esm-cjs',
    source: 'dependency',
    category: 'module_format',
    pattern:
      /(?:ERR_REQUIRE_ESM[^\n]*|require\(\) of ES Module[^\n]*|Cannot use import statement outside a module[^\n]*|Named export ['"][^'"]+['"] not found[^\n]*)/gi,
    priority: 86,
    confidence: 78,
  },
  {
    id: 'dependency.peer-deps',
    source: 'dependency',
    category: 'peer_dependency',
    pattern:
      /(?:unmet peer dependency[^\n]*|ERESOLVE unable to resolve dependency tree[^\n]*|Conflicting peer dependency[^\n]*|peer [^\n]* missing[^\n]*)/gi,
    priority: 84,
    confidence: 74,
  },
  {
    id: 'dependency.workspace-path',
    source: 'dependency',
    category: 'workspace_resolution',
    pattern:
      /(?:workspace:[^\n]*(?:not found|cannot|failed)[^\n]*|No matching version found for [^\n]*workspace[^\n]*|Cannot find package ['"][^'"]+['"][^\n]*)/gi,
    priority: 82,
    confidence: 72,
  },
];

function hasDependencySignal(input: CoreAnalysisInput): boolean {
  const text = readAnalysisLogText(input);
  return /(?:Cannot find module|Module not found|Could not resolve|ERR_PACKAGE_PATH_NOT_EXPORTED|ERR_REQUIRE_ESM|peer dependency|ERESOLVE|workspace:)/i.test(
    text,
  );
}

export const dependencyResolutionPlugin: Error2FixPlugin<
  DependencyResolutionContext,
  DependencyResolutionData
> = {
  meta: {
    name: 'dependency-resolution',
    displayName: 'Dependency Resolution Diagnostics',
  },
  detect(input) {
    return hasDependencySignal(input);
  },
  collectContext(input) {
    return {
      packageManagerFiles: input.workspace.files.filter((file) =>
        PACKAGE_MANAGER_FILES.has(file),
      ),
    };
  },
  analyze(input, context) {
    const evidences = matchRegexRules(input, DEPENDENCY_RULES).slice(0, 10);
    const lead = evidences[0];

    return {
      plugin: 'dependency-resolution',
      matched: evidences.length > 0,
      summary: lead?.message,
      keySnippet: lead?.snippet ?? input.signals.snippet,
      relatedFiles: unique([
        ...evidences.flatMap((evidence) =>
          evidence.file ? [evidence.file] : [],
        ),
        ...input.signals.relatedFiles,
      ]).slice(0, 8),
      context,
      data: {
        evidences,
      },
    };
  },
};
