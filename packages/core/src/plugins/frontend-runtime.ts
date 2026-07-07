import type { FailureEvidence } from '../diagnosis/evidence.js';
import type { CoreAnalysisInput } from '../types/core.js';
import type { Error2FixPlugin } from '../types/plugin.js';
import { readAnalysisLogText, unique } from '../utils/text.js';
import { type RegexRule, matchRegexRules } from './rule-utils.js';

interface FrontendRuntimeContext {
  frameworkHints: string[];
}

interface FrontendRuntimeData {
  evidences: FailureEvidence[];
}

const RUNTIME_RULES: RegexRule[] = [
  {
    id: 'react.invalid-hook-call',
    source: 'runtime',
    category: 'hook_rule',
    framework: 'react',
    pattern:
      /(?:Invalid hook call|Hooks can only be called inside[^.\n]*|React Hook [^\n]+(?:is called conditionally|has a missing dependency|cannot be called))/gi,
    priority: 90,
    confidence: 82,
    filePattern: /\.(tsx|jsx)$/,
  },
  {
    id: 'react.server-client-boundary',
    source: 'runtime',
    category: 'server_client_boundary',
    framework: 'react',
    pattern:
      /(?:(?:You're importing|You are importing)[^\n]+(?:useState|useEffect|useLayoutEffect|useReducer)[^\n]*|needs ["']use client["'][^\n]*|Event handlers cannot be passed to Client Component props[^\n]*|ReactServerComponentsError[^\n]*)/gi,
    priority: 88,
    confidence: 80,
    filePattern: /\.(tsx|jsx)$/,
  },
  {
    id: 'react.invalid-component',
    source: 'runtime',
    category: 'invalid_component',
    framework: 'react',
    pattern:
      /(?:Element type is invalid[^\n]*|Objects are not valid as a React child[^\n]*|Functions are not valid as a React child[^\n]*|Minified React error #\d+[^\n]*)/gi,
    priority: 84,
    confidence: 76,
    filePattern: /\.(tsx|jsx)$/,
  },
  {
    id: 'vue.runtime-warning',
    source: 'runtime',
    category: 'component_runtime',
    framework: 'vue',
    pattern:
      /(?:\[Vue warn\]:[^\n]*|Unhandled error during execution of[^\n]*|Maximum recursive updates exceeded[^\n]*|Property "[^"]+" was accessed during render[^\n]*)/gi,
    priority: 84,
    confidence: 76,
    filePattern: /\.vue$/,
  },
  {
    id: 'vue.router',
    source: 'runtime',
    category: 'router',
    framework: 'vue',
    pattern:
      /(?:\[Vue Router warn\]:[^\n]*|No match found for location[^\n]*|Missing required param[^\n]*|NavigationDuplicated[^\n]*|Cannot read properties of undefined \(reading ['"](?:push|replace|resolve)['"]\)[^\n]*)/gi,
    priority: 82,
    confidence: 74,
  },
  {
    id: 'vue.pinia',
    source: 'runtime',
    category: 'state_manager',
    framework: 'vue',
    pattern:
      /(?:getActivePinia\(\)[^\n]*|there was no active Pinia[^\n]*|Pinia instance has not been installed[^\n]*|\[🍍\][^\n]*)/giu,
    priority: 82,
    confidence: 74,
  },
  {
    id: 'nuxt.runtime-context',
    source: 'runtime',
    category: 'runtime_context',
    framework: 'nuxt',
    pattern:
      /(?:Nuxt Build Error[^\n]*|\[nuxt\][^\n]*|Cannot access ['"](?:useRuntimeConfig|useNuxtApp|navigateTo)['"][^\n]*|Nitro prerender[^\n]*)/gi,
    priority: 82,
    confidence: 74,
  },
  {
    id: 'frontend.hydration',
    source: 'runtime',
    category: 'hydration_mismatch',
    pattern:
      /(?:Hydration failed[^\n]*|hydration mismatch[^\n]*|Text content did not match[^\n]*|server rendered HTML didn't match[^\n]*|Hydration completed but contains mismatches[^\n]*|server rendered element contains fewer child nodes[^\n]*)/gi,
    priority: 86,
    confidence: 78,
    filePattern: /\.(tsx|jsx|vue|svelte)$/,
  },
  {
    id: 'svelte.runtime',
    source: 'runtime',
    category: 'component_runtime',
    framework: 'svelte',
    pattern: /(?:Svelte error:[^\n]*|svelte[^\n]*runtime[^\n]*error[^\n]*)/gi,
    priority: 78,
    confidence: 68,
    filePattern: /\.svelte$/,
  },
];

function hasRuntimeSignal(input: CoreAnalysisInput): boolean {
  const text = readAnalysisLogText(input);
  return (
    /\b(?:React|Next\.js|Vue|Nuxt|Svelte|Pinia|Vue Router|hydration|Hydration|hook|Hook|Server Component|Client Component)\b/.test(
      text,
    ) ||
    /ReactServerComponentsError|Invalid hook call|Objects are not valid as a React child|Element type is invalid|\[Vue warn\]|\[Vue Router warn\]|getActivePinia/i.test(
      text,
    )
  );
}

function buildFrameworkHints(input: CoreAnalysisInput): string[] {
  const text = readAnalysisLogText(input);
  return unique([
    /\b(?:React|Next\.js|ReactServerComponentsError)\b/.test(text)
      ? 'react'
      : '',
    /\b(?:Vue|Nuxt|Pinia|Vue Router|@vue\/)\b/i.test(text) ? 'vue' : '',
    /\bSvelte\b/i.test(text) ? 'svelte' : '',
  ]).filter(Boolean);
}

export const frontendRuntimePlugin: Error2FixPlugin<
  FrontendRuntimeContext,
  FrontendRuntimeData
> = {
  meta: {
    name: 'frontend-runtime',
    displayName: 'Frontend Runtime Diagnostics',
  },
  detect(input) {
    return hasRuntimeSignal(input);
  },
  collectContext(input) {
    return {
      frameworkHints: buildFrameworkHints(input),
    };
  },
  analyze(input, context) {
    const evidences = matchRegexRules(input, RUNTIME_RULES).slice(0, 12);
    const lead = evidences[0];

    return {
      plugin: 'frontend-runtime',
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
