export type SupportedShell = 'zsh' | 'bash' | 'fish' | 'unknown';

export type ErrorCategory =
  | 'dependency_install'
  | 'build_failure'
  | 'typescript_error'
  | 'test_failure'
  | 'runtime_error'
  | 'unknown';

export interface CliFlags {
  json?: boolean;
  color?: boolean;
  debug?: boolean;
}

export interface FailureSession {
  id: string;
  command: string;
  exitCode: number;
  cwd: string;
  shell: SupportedShell;
  timestamp: string;
  stdoutSnippet: string;
  stderrSnippet: string;
  projectType: string;
  env: {
    os: string;
    nodeVersion: string;
    packageManager: string;
  };
}

export interface ProjectContext {
  cwd: string;
  packageJson: {
    name?: string;
    private?: boolean;
    packageManager?: string;
    scripts: Record<string, string>;
    dependencies: string[];
    devDependencies: string[];
  } | null;
  lockfiles: string[];
  tsconfig: {
    exists: boolean;
    compilerOptions: Record<string, unknown>;
  };
  configFiles: string[];
  framework: string;
  projectType: string;
  gitBranch: string | null;
}

export interface Diagnosis {
  category: ErrorCategory;
  summary: string;
  likelyCauses: string[];
  suggestedNextSteps: string[];
  keyErrorSnippet: string;
  promptState: import('./prompt/state.js').PromptState;
  prompt: string;
}

export interface ExplainResult {
  session: FailureSession;
  context: ProjectContext;
  diagnosis: Diagnosis;
}
