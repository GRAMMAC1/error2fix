import type { CoreAnalysisInput } from '../types/core.js';
import type { Error2FixPlugin } from '../types/plugin.js';
import {
  normalizeDiagnosticMessage,
  readAnalysisLogText,
  unique,
} from '../utils/text.js';

type ReactFailureKind =
  | 'hook_rule'
  | 'hydration_mismatch'
  | 'server_client_boundary'
  | 'invalid_component'
  | 'jsx_runtime'
  | 'next_runtime'
  | 'react_runtime';

interface ReactDiagnostic {
  kind: ReactFailureKind;
  message: string;
  file?: string;
}

interface ReactContext {
  framework: 'react' | 'next' | 'unknown';
  configFiles: string[];
  componentFiles: string[];
}

interface ReactData {
  diagnostics: ReactDiagnostic[];
  failureKinds: ReactFailureKind[];
}

const REACT_FILE_PATTERN = /\.(tsx|jsx)$/;
const FRONTEND_SOURCE_PATTERN = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const REACT_CONFIG_PATTERN =
  /^(next|vite|vitest|jest|tailwind|postcss)\.config\.(ts|mts|cts|js|mjs|cjs)$/;

function isProjectSourceFile(file: string): boolean {
  return (
    FRONTEND_SOURCE_PATTERN.test(file) &&
    !/node_modules|\.next|dist|build/.test(file)
  );
}

function hasReactSignal(input: CoreAnalysisInput): boolean {
  const text = readAnalysisLogText(input);
  return (
    /\b(?:React|Next\.js|Next|JSX|hydration|Hydration|hook|Hook|Server Component|Client Component)\b/.test(
      text,
    ) ||
    /ReactServerComponentsError|Invalid hook call|Objects are not valid as a React child|Element type is invalid/.test(
      text,
    ) ||
    (input.signals.relatedFiles.some((file) => REACT_FILE_PATTERN.test(file)) &&
      /\b(?:render|component|props|hook|hydration|jsx)\b/i.test(text)) ||
    input.workspace.files.some((file) => file.startsWith('next.config.'))
  );
}

function detectFramework(input: CoreAnalysisInput): ReactContext['framework'] {
  const text = readAnalysisLogText(input);
  if (
    /\b(?:Next\.js|next\/|ReactServerComponentsError|Server Component|Client Component)\b/.test(
      text,
    ) ||
    input.workspace.files.some((file) => file.startsWith('next.config.'))
  ) {
    return 'next';
  }
  if (/\bReact\b/.test(text)) {
    return 'react';
  }
  return 'unknown';
}

function firstRelatedSourceFile(input: CoreAnalysisInput): string | undefined {
  return (
    input.signals.relatedFiles.find((file) => REACT_FILE_PATTERN.test(file)) ??
    input.signals.relatedFiles.find(isProjectSourceFile)
  );
}

function addDiagnostic(
  diagnostics: ReactDiagnostic[],
  input: CoreAnalysisInput,
  kind: ReactFailureKind,
  pattern: RegExp,
): void {
  const text = readAnalysisLogText(input);
  const match = text.match(pattern);
  if (!match) {
    return;
  }

  diagnostics.push({
    kind,
    message: normalizeDiagnosticMessage(match[0]),
    file: firstRelatedSourceFile(input),
  });
}

function extractDiagnostics(input: CoreAnalysisInput): ReactDiagnostic[] {
  const diagnostics: ReactDiagnostic[] = [];

  addDiagnostic(
    diagnostics,
    input,
    'hook_rule',
    /(?:Invalid hook call|Hooks can only be called inside[^.\n]*|React Hook [^\n]+(?:is called conditionally|has a missing dependency|cannot be called))/i,
  );
  addDiagnostic(
    diagnostics,
    input,
    'hydration_mismatch',
    /(?:Hydration failed[^\n]*|hydration mismatch[^\n]*|Text content did not match[^\n]*|server rendered HTML didn't match[^\n]*)/i,
  );
  addDiagnostic(
    diagnostics,
    input,
    'server_client_boundary',
    /(?:(?:You're importing|You are importing)[^\n]+(?:useState|useEffect|useLayoutEffect|useReducer)[^\n]*|needs ["']use client["'][^\n]*|Event handlers cannot be passed to Client Component props[^\n]*|ReactServerComponentsError[^\n]*)/i,
  );
  addDiagnostic(
    diagnostics,
    input,
    'invalid_component',
    /(?:Element type is invalid[^\n]*|Objects are not valid as a React child[^\n]*|Functions are not valid as a React child[^\n]*|Minified React error #\d+[^\n]*)/i,
  );
  addDiagnostic(
    diagnostics,
    input,
    'jsx_runtime',
    /(?:React is not defined[^\n]*|jsx-runtime[^\n]*|Cannot use JSX[^\n]*|Adjacent JSX elements must be wrapped[^\n]*)/i,
  );
  addDiagnostic(
    diagnostics,
    input,
    'next_runtime',
    /(?:next\/(?:font|image|navigation|headers)[^\n]*|Failed to compile[^\n]*Next[^\n]*|Error occurred prerendering page[^\n]*)/i,
  );

  if (diagnostics.length === 0 && hasReactSignal(input)) {
    const fallbackLine = readAnalysisLogText(input)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) =>
        /\b(?:React|Next|JSX|component|render|hydration|hook)\b/i.test(line),
      );
    diagnostics.push({
      kind: 'react_runtime',
      message: normalizeDiagnosticMessage(
        fallbackLine ?? 'React-related failure detected.',
      ),
      file: firstRelatedSourceFile(input),
    });
  }

  return unique(
    diagnostics.map((diagnostic) =>
      JSON.stringify({
        kind: diagnostic.kind,
        message: diagnostic.message,
        file: diagnostic.file,
      }),
    ),
  )
    .map((diagnostic) => JSON.parse(diagnostic) as ReactDiagnostic)
    .slice(0, 5);
}

function formatDiagnostic(diagnostic: ReactDiagnostic): string {
  const location = diagnostic.file ? ` in ${diagnostic.file}` : '';
  return `React ${diagnostic.kind.replaceAll('_', ' ')}${location}: ${diagnostic.message}`;
}

function buildKeySnippet(
  input: CoreAnalysisInput,
  diagnostics: ReactDiagnostic[],
): string | undefined {
  const first = diagnostics[0];
  if (!first) {
    return input.signals.snippet;
  }

  const lines = readAnalysisLogText(input).split(/\r?\n/);
  const diagnosticIndex = lines.findIndex((line) =>
    line.toLowerCase().includes(first.message.toLowerCase().slice(0, 48)),
  );
  if (diagnosticIndex === -1) {
    return input.signals.snippet;
  }

  return lines
    .slice(diagnosticIndex, diagnosticIndex + 4)
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

function buildSuggestions(diagnostics: ReactDiagnostic[]): string[] {
  const suggestions = diagnostics.map((diagnostic) => {
    switch (diagnostic.kind) {
      case 'hook_rule':
        return 'Check that hooks run unconditionally inside React function components or custom hooks, not inside callbacks, branches, or module scope.';
      case 'hydration_mismatch':
        return 'Compare server-rendered and client-rendered output, especially browser-only state, dates, randomness, locale formatting, and conditional markup.';
      case 'server_client_boundary':
        return 'Move interactive React code behind a client component boundary or add the required "use client" directive at the correct component entry.';
      case 'invalid_component':
        return 'Check component imports/exports and rendered children; this often comes from default/named import mismatches or rendering plain objects.';
      case 'jsx_runtime':
        return 'Check JSX runtime configuration, React import expectations, and framework compiler settings.';
      case 'next_runtime':
        return 'Inspect the referenced Next.js route, app/page component, or Next-specific API usage before chasing framework stack frames.';
      default:
        return 'Open the first referenced React component and inspect the component boundary, props, and render path.';
    }
  });

  return unique([
    ...suggestions,
    'Prefer the first application component frame over React or Next.js internals.',
  ]).slice(0, 5);
}

export const reactPlugin: Error2FixPlugin<ReactContext, ReactData> = {
  meta: {
    name: 'builtin-react',
    displayName: 'React',
  },
  detect(input) {
    return hasReactSignal(input);
  },
  collectContext(input) {
    return {
      framework: detectFramework(input),
      configFiles: input.workspace.files.filter((file) =>
        REACT_CONFIG_PATTERN.test(file),
      ),
      componentFiles: input.signals.relatedFiles
        .filter((file) => REACT_FILE_PATTERN.test(file))
        .slice(0, 8),
    };
  },
  analyze(input, context) {
    const diagnostics = extractDiagnostics(input);
    const relatedFiles = unique([
      ...diagnostics.flatMap((diagnostic) =>
        diagnostic.file ? [diagnostic.file] : [],
      ),
      ...input.signals.relatedFiles.filter(isProjectSourceFile),
    ]).slice(0, 8);

    return {
      plugin: 'builtin-react',
      matched: true,
      summary: diagnostics[0]
        ? formatDiagnostic(diagnostics[0])
        : 'React-related failure detected from frontend log evidence.',
      keySnippet: buildKeySnippet(input, diagnostics),
      relatedFiles,
      context,
      data: {
        diagnostics,
        failureKinds: unique(diagnostics.map((diagnostic) => diagnostic.kind)),
      },
      suggestions: buildSuggestions(diagnostics),
    };
  },
};
