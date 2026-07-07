import type { CoreAnalysisInput } from '../types/core.js';
import type { Error2FixPlugin } from '../types/plugin.js';

type TypeScriptFailureKind =
  | 'module_resolution'
  | 'type_assignability'
  | 'missing_property'
  | 'missing_name'
  | 'jsx_configuration'
  | 'project_configuration'
  | 'type_definition'
  | 'implicit_any'
  | 'compiler_error';

interface TypeScriptDiagnostic {
  code: string;
  message: string;
  kind: TypeScriptFailureKind;
  file?: string;
  line?: number;
  column?: number;
}

interface TypeScriptContext {
  configFiles: string[];
  frontendConfigFiles: string[];
}

interface TypeScriptData {
  errorCodes: string[];
  diagnostics: TypeScriptDiagnostic[];
  failureKinds: TypeScriptFailureKind[];
}

const TS_FILE_PATTERN = /\.(ts|tsx|mts|cts|vue)$/;
const TS_CODE_PATTERN = /\bTS\d{3,5}\b/;
const FRONTEND_TS_CONFIG_PATTERN =
  /^(vite|next|nuxt|vitest|jest|tailwind|postcss)\.config\.(ts|mts|cts|js|mjs|cjs)$/;

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function readLogText(input: CoreAnalysisInput): string {
  return [input.capture.stderr, input.capture.stdout, input.signals.snippet]
    .filter(Boolean)
    .join('\n');
}

function hasTypeScriptSignal(input: CoreAnalysisInput): boolean {
  const text = readLogText(input);
  return (
    TS_CODE_PATTERN.test(text) ||
    /\b(?:tsc|vue-tsc|tsserver|typescript)\b/i.test(text) ||
    input.signals.keywords.some((keyword) => /^TS\d{3,5}$/.test(keyword)) ||
    input.signals.relatedFiles.some((file) => TS_FILE_PATTERN.test(file)) ||
    input.workspace.files.some((file) => file === 'tsconfig.json')
  );
}

function normalizeMessage(message: string): string {
  return message
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.;\s]+$/g, '.');
}

function classifyDiagnostic(
  code: string,
  message: string,
): TypeScriptFailureKind {
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
  if (
    /tsconfig|rootDir|project|composite|paths|baseUrl|included because/i.test(
      message,
    )
  ) {
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
      return 'compiler_error';
  }
}

function parseLocation(
  location: string | undefined,
): Pick<TypeScriptDiagnostic, 'file' | 'line' | 'column'> {
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

function extractDiagnostics(input: CoreAnalysisInput): TypeScriptDiagnostic[] {
  const text = readLogText(input);
  const diagnostics: TypeScriptDiagnostic[] = [];
  const seen = new Set<string>();
  const diagnosticPattern =
    /(?:(?<location>(?:\.{0,2}\/)?(?:[\w@%+=:,.-]+\/)*[\w@%+=,.-]+\.(?:ts|tsx|mts|cts|vue)(?::\d+:\d+|\(\d+,\d+\)))\s*(?:-|:)?\s*)?(?:error\s+)?(?<code>TS\d{3,5}):\s*(?<message>[^\n]+)/gi;

  for (const match of text.matchAll(diagnosticPattern)) {
    const code = match.groups?.code.toUpperCase();
    const message = normalizeMessage(match.groups?.message ?? '');
    if (!code || !message) {
      continue;
    }

    const location = parseLocation(match.groups?.location);
    const key = [
      location.file ?? '',
      location.line ?? '',
      location.column ?? '',
      code,
      message,
    ].join('|');
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    diagnostics.push({
      ...location,
      code,
      message,
      kind: classifyDiagnostic(code, message),
    });
  }

  return diagnostics.slice(0, 8);
}

function formatLocation(diagnostic: TypeScriptDiagnostic): string | undefined {
  if (!diagnostic.file) {
    return undefined;
  }
  if (diagnostic.line && diagnostic.column) {
    return `${diagnostic.file}:${diagnostic.line}:${diagnostic.column}`;
  }
  return diagnostic.file;
}

function buildSummary(diagnostics: TypeScriptDiagnostic[]): string {
  if (diagnostics.length === 0) {
    return 'TypeScript-related failure detected from log evidence.';
  }

  const first = diagnostics[0];
  const location = formatLocation(first);
  const prefix = location
    ? `TypeScript ${first.code} in ${location}`
    : `TypeScript ${first.code}`;
  const suffix =
    diagnostics.length > 1
      ? ` (${diagnostics.length} diagnostics detected)`
      : '';

  return `${prefix}: ${first.message}${suffix}`;
}

function buildKeySnippet(
  input: CoreAnalysisInput,
  diagnostics: TypeScriptDiagnostic[],
): string | undefined {
  const text = readLogText(input);
  const first = diagnostics[0];
  if (!first) {
    return input.signals.snippet;
  }

  const lines = text.split(/\r?\n/);
  const codeLineIndex = lines.findIndex((line) => line.includes(first.code));
  if (codeLineIndex === -1) {
    return input.signals.snippet;
  }

  return lines
    .slice(codeLineIndex, codeLineIndex + 3)
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

function buildSuggestions(
  diagnostics: TypeScriptDiagnostic[],
  relatedFiles: string[],
): string[] {
  const firstFile = relatedFiles[0];
  const suggestions = diagnostics.map((diagnostic) => {
    switch (diagnostic.kind) {
      case 'module_resolution':
        return 'Check the import path, package installation, exports field, and tsconfig moduleResolution/paths settings.';
      case 'type_assignability':
        return 'Compare the actual value type with the target annotation or component prop/interface contract.';
      case 'missing_property':
        return 'Inspect the referenced object, component props, or inferred generic type for the missing property.';
      case 'missing_name':
        return 'Verify the symbol is imported, declared in scope, or provided by the expected framework/runtime types.';
      case 'jsx_configuration':
        return 'Check JSX runtime settings, React/Vue JSX types, and tsconfig jsx options.';
      case 'project_configuration':
        return 'Inspect tsconfig include/files/references, rootDir, paths, and project-reference boundaries.';
      case 'type_definition':
        return 'Check missing @types packages, typeRoots/types settings, and dependency-provided declarations.';
      case 'implicit_any':
        return 'Add an explicit type annotation or let the value be inferred from a typed call site.';
      default:
        return 'Open the first TypeScript diagnostic and fix the earliest compiler error before chasing cascades.';
    }
  });

  return unique([
    firstFile
      ? `Start with ${firstFile}; it is the first TypeScript-related project file in the diagnosis.`
      : '',
    ...suggestions,
    'Fix the first TypeScript diagnostic before chasing later cascade errors.',
  ])
    .filter(Boolean)
    .slice(0, 5);
}

export const typescriptPlugin: Error2FixPlugin<
  TypeScriptContext,
  TypeScriptData
> = {
  meta: {
    name: 'builtin-typescript',
    displayName: 'TypeScript',
  },
  detect(input) {
    return hasTypeScriptSignal(input);
  },
  collectContext(input) {
    return {
      configFiles: input.workspace.files.filter(
        (file) => file === 'tsconfig.json' || file.startsWith('tsconfig.'),
      ),
      frontendConfigFiles: input.workspace.files.filter((file) =>
        FRONTEND_TS_CONFIG_PATTERN.test(file),
      ),
    };
  },
  analyze(input, context) {
    const diagnostics = extractDiagnostics(input);
    const errorCodes = unique([
      ...diagnostics.map((diagnostic) => diagnostic.code),
      ...input.signals.keywords.filter((keyword) =>
        /^TS\d{3,5}$/.test(keyword),
      ),
    ]);
    const relatedFiles = unique([
      ...diagnostics.flatMap((diagnostic) =>
        diagnostic.file ? [diagnostic.file] : [],
      ),
      ...input.signals.relatedFiles.filter((file) =>
        TS_FILE_PATTERN.test(file),
      ),
    ]).slice(0, 8);
    const failureKinds = unique(
      diagnostics.map((diagnostic) => diagnostic.kind),
    );

    return {
      plugin: 'builtin-typescript',
      matched: true,
      summary: buildSummary(diagnostics),
      keySnippet: buildKeySnippet(input, diagnostics),
      relatedFiles,
      context,
      data: {
        errorCodes,
        diagnostics,
        failureKinds,
      },
      suggestions: buildSuggestions(diagnostics, relatedFiles),
    };
  },
};
