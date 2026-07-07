import type { CoreAnalysisInput } from '../types/core.js';
import type { Error2FixPlugin } from '../types/plugin.js';
import {
  normalizeDiagnosticMessage,
  readAnalysisLogText,
  unique,
} from '../utils/text.js';

type VueFailureKind =
  | 'sfc_compile'
  | 'template_compile'
  | 'vue_runtime'
  | 'vue_router'
  | 'pinia_runtime'
  | 'nuxt_runtime'
  | 'hydration_mismatch'
  | 'vite_plugin_vue';

interface VueDiagnostic {
  kind: VueFailureKind;
  message: string;
  file?: string;
}

interface VueContext {
  framework: 'vue' | 'nuxt' | 'unknown';
  configFiles: string[];
  componentFiles: string[];
}

interface VueData {
  diagnostics: VueDiagnostic[];
  failureKinds: VueFailureKind[];
}

const VUE_FILE_PATTERN = /\.vue$/;
const FRONTEND_SOURCE_PATTERN = /\.(vue|ts|tsx|js|jsx|mjs|cjs)$/;
const VUE_CONFIG_PATTERN =
  /^(vite|nuxt|vue|vitest|jest|tailwind|postcss)\.config\.(ts|mts|cts|js|mjs|cjs)$/;

function isProjectSourceFile(file: string): boolean {
  return (
    FRONTEND_SOURCE_PATTERN.test(file) &&
    !/node_modules|\.nuxt|dist|build/.test(file)
  );
}

function hasVueSignal(input: CoreAnalysisInput): boolean {
  const text = readAnalysisLogText(input);
  return (
    /\b(?:Vue|Nuxt|Pinia|Vue Router|vue-router|vue-tsc)\b/i.test(text) ||
    /@vue\/(?:compiler-sfc|compiler-dom|runtime-core)|@vitejs\/plugin-vue|\[plugin:vite:vue\]/i.test(
      text,
    ) ||
    /\[Vue warn\]|\[Vue Router warn\]|getActivePinia|Hydration completed but contains mismatches/i.test(
      text,
    ) ||
    (input.signals.relatedFiles.some((file) => VUE_FILE_PATTERN.test(file)) &&
      /\b(?:component|template|script setup|compiler|render|hydration)\b/i.test(
        text,
      )) ||
    input.workspace.files.some(
      (file) =>
        file.startsWith('nuxt.config.') || file.startsWith('vue.config.'),
    )
  );
}

function detectFramework(input: CoreAnalysisInput): VueContext['framework'] {
  const text = readAnalysisLogText(input);
  if (
    /\b(?:Nuxt|Nitro|\.nuxt|nuxt\/|#app|#imports)\b/i.test(text) ||
    input.workspace.files.some((file) => file.startsWith('nuxt.config.'))
  ) {
    return 'nuxt';
  }
  if (
    /\b(?:Vue|Pinia|Vue Router|vue-router|@vue\/|@vitejs\/plugin-vue)\b/i.test(
      text,
    ) ||
    input.signals.relatedFiles.some((file) => VUE_FILE_PATTERN.test(file))
  ) {
    return 'vue';
  }
  return 'unknown';
}

function firstRelatedSourceFile(input: CoreAnalysisInput): string | undefined {
  return (
    input.signals.relatedFiles.find((file) => VUE_FILE_PATTERN.test(file)) ??
    input.signals.relatedFiles.find(isProjectSourceFile)
  );
}

function addDiagnostic(
  diagnostics: VueDiagnostic[],
  input: CoreAnalysisInput,
  kind: VueFailureKind,
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

function extractDiagnostics(input: CoreAnalysisInput): VueDiagnostic[] {
  const diagnostics: VueDiagnostic[] = [];

  addDiagnostic(
    diagnostics,
    input,
    'sfc_compile',
    /(?:\[plugin:vite:vue\][^\n]*|@vue\/compiler-sfc[^\n]*|VueCompilerError:[^\n]*|<script setup>[^\n]*)/i,
  );
  addDiagnostic(
    diagnostics,
    input,
    'template_compile',
    /(?:Template compilation error:[^\n]*|v-model cannot be used[^\n]*|Codegen node is missing[^\n]*|Failed to resolve component[^\n]*)/i,
  );
  addDiagnostic(
    diagnostics,
    input,
    'vue_runtime',
    /(?:\[Vue warn\]:[^\n]*|Unhandled error during execution of[^\n]*|Maximum recursive updates exceeded[^\n]*|Property "[^"]+" was accessed during render[^\n]*)/i,
  );
  addDiagnostic(
    diagnostics,
    input,
    'vue_router',
    /(?:\[Vue Router warn\]:[^\n]*|No match found for location[^\n]*|Missing required param[^\n]*|NavigationDuplicated[^\n]*|Cannot read properties of undefined \(reading ['"](?:push|replace|resolve)['"]\)[^\n]*)/i,
  );
  addDiagnostic(
    diagnostics,
    input,
    'pinia_runtime',
    /(?:getActivePinia\(\)[^\n]*|there was no active Pinia[^\n]*|Pinia instance has not been installed[^\n]*|\[🍍\][^\n]*)/i,
  );
  addDiagnostic(
    diagnostics,
    input,
    'nuxt_runtime',
    /(?:Nuxt Build Error[^\n]*|\[nuxt\][^\n]*|Cannot access ['"](?:useRuntimeConfig|useNuxtApp|navigateTo)['"][^\n]*|Nitro prerender[^\n]*)/i,
  );
  addDiagnostic(
    diagnostics,
    input,
    'hydration_mismatch',
    /(?:Hydration completed but contains mismatches[^\n]*|hydration mismatch[^\n]*|server rendered element contains fewer child nodes[^\n]*)/i,
  );
  addDiagnostic(
    diagnostics,
    input,
    'vite_plugin_vue',
    /(?:@vitejs\/plugin-vue[^\n]*|\[vite:vue\][^\n]*|Failed to parse source for import analysis[^\n]*\.vue[^\n]*)/i,
  );

  if (diagnostics.length === 0 && hasVueSignal(input)) {
    const fallbackLine = readAnalysisLogText(input)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) =>
        /\b(?:Vue|Nuxt|Pinia|Vue Router|vue-router|component|template|hydration)\b/i.test(
          line,
        ),
      );
    diagnostics.push({
      kind: 'vue_runtime',
      message: normalizeDiagnosticMessage(
        fallbackLine ?? 'Vue-related failure detected.',
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
    .map((diagnostic) => JSON.parse(diagnostic) as VueDiagnostic)
    .slice(0, 5);
}

function formatDiagnostic(diagnostic: VueDiagnostic): string {
  const location = diagnostic.file ? ` in ${diagnostic.file}` : '';
  return `Vue ${diagnostic.kind.replaceAll('_', ' ')}${location}: ${diagnostic.message}`;
}

function buildKeySnippet(
  input: CoreAnalysisInput,
  diagnostics: VueDiagnostic[],
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

function buildSuggestions(diagnostics: VueDiagnostic[]): string[] {
  const suggestions = diagnostics.map((diagnostic) => {
    switch (diagnostic.kind) {
      case 'sfc_compile':
        return 'Inspect the referenced Vue SFC block first, especially <script setup>, macro usage, imports, and compiler-only syntax constraints.';
      case 'template_compile':
        return 'Check the Vue template expression, directive usage, component registration, and whether the referenced value exists in setup scope.';
      case 'vue_runtime':
        return 'Start from the first application component frame and inspect reactive state, render-time property access, and component lifecycle timing.';
      case 'vue_router':
        return 'Check route names, required params, router installation, and whether navigation runs after the app/router is ready.';
      case 'pinia_runtime':
        return 'Verify Pinia is installed on the Vue app before stores are used, especially in tests, plugins, and module-level code.';
      case 'nuxt_runtime':
        return 'Inspect the referenced Nuxt page/plugin/server route and confirm the API is being used in the correct Nuxt runtime context.';
      case 'hydration_mismatch':
        return 'Compare server and client render output, especially browser-only state, dates, randomness, locale formatting, and conditional markup.';
      case 'vite_plugin_vue':
        return 'Check the Vue Vite plugin configuration and the referenced .vue file before chasing downstream bundler stack frames.';
      default:
        return 'Open the first referenced Vue component and inspect the component setup, template, and runtime boundary.';
    }
  });

  return unique([
    ...suggestions,
    'Prefer the first application .vue file over Vue, Vite, or Nuxt internals.',
  ]).slice(0, 5);
}

export const vuePlugin: Error2FixPlugin<VueContext, VueData> = {
  meta: {
    name: 'builtin-vue',
    displayName: 'Vue',
  },
  detect(input) {
    return hasVueSignal(input);
  },
  collectContext(input) {
    return {
      framework: detectFramework(input),
      configFiles: input.workspace.files.filter((file) =>
        VUE_CONFIG_PATTERN.test(file),
      ),
      componentFiles: input.signals.relatedFiles
        .filter((file) => VUE_FILE_PATTERN.test(file))
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
      plugin: 'builtin-vue',
      matched: true,
      summary: diagnostics[0]
        ? formatDiagnostic(diagnostics[0])
        : 'Vue-related failure detected from frontend log evidence.',
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
