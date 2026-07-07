import type { FailureEvidence } from '../diagnosis/evidence.js';
import type { CoreAnalysisInput } from '../types/core.js';
import type { Error2FixPlugin } from '../types/plugin.js';
import {
  normalizeDiagnosticMessage,
  readAnalysisLogText,
  unique,
} from '../utils/text.js';
import {
  type RegexRule,
  firstRelatedSourceFile,
  lineNumberForIndex,
  matchRegexRules,
  snippetFromLine,
} from './rule-utils.js';

interface FrontendCompilerContext {
  configFiles: string[];
}

interface FrontendCompilerData {
  evidences: FailureEvidence[];
}

const TS_DIAGNOSTIC_PATTERN =
  /(?:(?<location>(?:\.{0,2}\/)?(?:[\w@%+=:,.-]+\/)*[\w@%+=,.-]+\.(?:ts|tsx|mts|cts|vue|svelte)(?::\d+:\d+|\(\d+,\d+\)))\s*(?:-|:)?\s*)?(?:error\s+)?(?<code>TS\d{3,5}):\s*(?<message>[^\n]+)/gi;

const FRONTEND_CONFIG_PATTERN =
  /^(tsconfig(?:\..+)?\.json|(?:vite|next|nuxt|vue|svelte|astro|vitest|jest|tailwind|postcss)\.config\.(ts|mts|cts|js|mjs|cjs))$/;

const COMPILER_RULES: RegexRule[] = [
  {
    id: 'vue.sfc.compile',
    source: 'compiler',
    category: 'sfc_compile',
    framework: 'vue',
    pattern:
      /(?:\[plugin:vite:vue\][^\n]*|@vue\/compiler-sfc[^\n]*|VueCompilerError:[^\n]*|<script setup>[^\n]*)/gi,
    priority: 86,
    confidence: 78,
    filePattern: /\.vue$/,
  },
  {
    id: 'vue.template.compile',
    source: 'compiler',
    category: 'template_compile',
    framework: 'vue',
    pattern:
      /(?:Template compilation error:[^\n]*|v-model cannot be used[^\n]*|Codegen node is missing[^\n]*|Failed to resolve component[^\n]*)/gi,
    priority: 82,
    confidence: 76,
    filePattern: /\.vue$/,
  },
  {
    id: 'svelte.compile',
    source: 'compiler',
    category: 'component_compile',
    framework: 'svelte',
    pattern:
      /(?:\[vite-plugin-svelte\][^\n]*|svelte(?:-check)?[^\n]*(?:error|failed)[^\n]*|CompileError:[^\n]*\.svelte[^\n]*)/gi,
    priority: 84,
    confidence: 74,
    filePattern: /\.svelte$/,
  },
  {
    id: 'vite.plugin.compile',
    source: 'compiler',
    category: 'build_wrapper',
    framework: 'vite',
    pattern:
      /(?:\[vite:[^\]]+\][^\n]*|Failed to parse source for import analysis[^\n]*|Transform failed with \d+ errors?[^\n]*)/gi,
    priority: 58,
    confidence: 58,
  },
  {
    id: 'jsx.compile',
    source: 'compiler',
    category: 'jsx_compile',
    pattern:
      /(?:Cannot use JSX[^\n]*|Adjacent JSX elements must be wrapped[^\n]*|React is not defined[^\n]*|jsx-runtime[^\n]*)/gi,
    priority: 76,
    confidence: 70,
    filePattern: /\.(tsx|jsx)$/,
  },
  {
    id: 'css.compile',
    source: 'compiler',
    category: 'style_compile',
    pattern:
      /(?:(?:postcss|tailwind|sass|scss)[^\n]*(?:error|failed)[^\n]*|Cannot apply unknown utility class[^\n]*)/gi,
    priority: 72,
    confidence: 66,
    filePattern: /\.(css|scss|sass)$/,
  },
];

function classifyTypeScriptDiagnostic(code: string, message: string): string {
  if (
    /Cannot find module|moduleResolution|corresponding type declarations/i.test(
      message,
    )
  ) {
    return 'module_resolution';
  }
  if (/not assignable|Argument of type|No overload matches/i.test(message)) {
    return 'type_assignability';
  }
  if (
    /Property .+ does not exist|is missing the following properties/i.test(
      message,
    )
  ) {
    return 'missing_property';
  }
  if (/Cannot find name/i.test(message)) {
    return 'missing_name';
  }
  if (/JSX|--jsx/i.test(message)) {
    return 'jsx_configuration';
  }
  if (/tsconfig|rootDir|project|composite|paths|baseUrl/i.test(message)) {
    return 'project_configuration';
  }
  if (/type definition file|@types\//i.test(message)) {
    return 'type_definition';
  }
  if (/implicitly has an .+ type|implicitly has type/i.test(message)) {
    return 'implicit_any';
  }

  switch (code) {
    case 'TS2307':
    case 'TS2792':
    case 'TS2834':
    case 'TS2835':
      return 'module_resolution';
    case 'TS2322':
    case 'TS2345':
    case 'TS2740':
    case 'TS2741':
    case 'TS2739':
      return 'type_assignability';
    case 'TS2339':
      return 'missing_property';
    case 'TS2304':
      return 'missing_name';
    case 'TS17004':
    case 'TS7026':
      return 'jsx_configuration';
    case 'TS6059':
    case 'TS6307':
    case 'TS18003':
      return 'project_configuration';
    case 'TS2688':
      return 'type_definition';
    case 'TS7006':
    case 'TS7031':
      return 'implicit_any';
    default:
      return 'typescript';
  }
}

function parseLocation(
  location: string | undefined,
): Pick<FailureEvidence, 'file' | 'line' | 'column'> {
  if (!location) {
    return {};
  }

  const colonMatch = location.match(
    /^(?<file>.+?):(?<line>\d+):(?<column>\d+)$/,
  );
  if (colonMatch?.groups) {
    return {
      file: colonMatch.groups.file,
      line: Number(colonMatch.groups.line),
      column: Number(colonMatch.groups.column),
    };
  }

  const parenMatch = location.match(
    /^(?<file>.+?)\((?<line>\d+),(?<column>\d+)\)$/,
  );
  if (parenMatch?.groups) {
    return {
      file: parenMatch.groups.file,
      line: Number(parenMatch.groups.line),
      column: Number(parenMatch.groups.column),
    };
  }

  return {};
}

function detectFramework(
  file: string | undefined,
  text: string,
): string | undefined {
  if (file?.endsWith('.vue') || /\bvue-tsc\b/i.test(text)) {
    return 'vue';
  }
  if (file?.endsWith('.svelte') || /\bsvelte-check\b/i.test(text)) {
    return 'svelte';
  }
  if (file?.endsWith('.tsx') || /\b(?:React|Next\.js|Next)\b/.test(text)) {
    return 'react';
  }
  return 'typescript';
}

function extractTypeScriptEvidence(
  input: CoreAnalysisInput,
): FailureEvidence[] {
  const text = readAnalysisLogText(input);
  const evidences: FailureEvidence[] = [];

  for (const match of text.matchAll(TS_DIAGNOSTIC_PATTERN)) {
    const code = match.groups?.code.toUpperCase();
    const message = normalizeDiagnosticMessage(match.groups?.message ?? '');
    if (!code || !message) {
      continue;
    }

    const location = parseLocation(match.groups?.location);
    const rawLine = lineNumberForIndex(text, match.index ?? 0);

    evidences.push({
      id: `typescript:${rawLine}:${evidences.length}`,
      ruleId: `typescript.${code.toLowerCase()}`,
      source: 'compiler',
      category: classifyTypeScriptDiagnostic(code, message),
      framework: detectFramework(location.file, text),
      message: `${code}: ${message}`,
      ...location,
      rawLine,
      confidence: 86,
      priority: 88,
      snippet: snippetFromLine(text, rawLine),
    });
  }

  return evidences;
}

function hasCompilerSignal(input: CoreAnalysisInput): boolean {
  const text = readAnalysisLogText(input);
  return (
    /\bTS\d{3,5}\b/.test(text) ||
    /\b(?:tsc|vue-tsc|svelte-check|vite|rollup|webpack|esbuild|postcss|tailwind)\b/i.test(
      text,
    ) ||
    input.signals.relatedFiles.some((file) =>
      /\.(ts|tsx|vue|svelte|astro|css|scss)$/.test(file),
    )
  );
}

export const frontendCompilerPlugin: Error2FixPlugin<
  FrontendCompilerContext,
  FrontendCompilerData
> = {
  meta: {
    name: 'frontend-compiler',
    displayName: 'Frontend Compiler Diagnostics',
  },
  detect(input) {
    return hasCompilerSignal(input);
  },
  collectContext(input) {
    return {
      configFiles: input.workspace.files.filter((file) =>
        FRONTEND_CONFIG_PATTERN.test(file),
      ),
    };
  },
  analyze(input, context) {
    const evidences = unique([
      ...extractTypeScriptEvidence(input),
      ...matchRegexRules(input, COMPILER_RULES),
    ]).slice(0, 12);
    const lead = evidences[0];

    return {
      plugin: 'frontend-compiler',
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
