import { execFile as execFileCallback } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { ProjectContext } from '../types.js';
import { fileExists, readJsonFile } from '../utils/fs.js';

const execFile = promisify(execFileCallback);

interface PackageJsonShape {
  name?: string;
  private?: boolean;
  packageManager?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

async function summarizeTsConfig(cwd: string) {
  const tsconfigPath = path.join(cwd, 'tsconfig.json');
  if (!(await fileExists(tsconfigPath))) {
    return {
      exists: false,
      compilerOptions: {},
    };
  }

  const data = await readJsonFile<{
    compilerOptions?: Record<string, unknown>;
  }>(tsconfigPath);
  const compilerOptions = data?.compilerOptions ?? {};
  const keepKeys = [
    'target',
    'module',
    'moduleResolution',
    'jsx',
    'strict',
    'baseUrl',
    'paths',
  ];
  const filtered = Object.fromEntries(
    Object.entries(compilerOptions).filter(([key]) => keepKeys.includes(key)),
  );
  return {
    exists: true,
    compilerOptions: filtered,
  };
}

async function detectGitBranch(cwd: string): Promise<string | null> {
  try {
    const result = await execFile(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      {
        cwd,
      },
    );
    return result.stdout.trim() || null;
  } catch {
    return null;
  }
}

function detectFramework(
  packageJson: PackageJsonShape | null,
  configFiles: string[],
  lockfiles: string[],
): { framework: string; projectType: string } {
  const deps = new Set([
    ...Object.keys(packageJson?.dependencies ?? {}),
    ...Object.keys(packageJson?.devDependencies ?? {}),
  ]);

  if (configFiles.includes('turbo.json') || deps.has('turbo')) {
    return { framework: 'monorepo', projectType: 'monorepo' };
  }
  if (
    configFiles.includes('next.config.js') ||
    configFiles.includes('next.config.mjs') ||
    deps.has('next')
  ) {
    return { framework: 'nextjs', projectType: 'nextjs' };
  }
  if (
    configFiles.includes('vite.config.ts') ||
    configFiles.includes('vite.config.js') ||
    deps.has('vite')
  ) {
    return { framework: 'vite', projectType: 'vite' };
  }
  if (deps.has('react')) {
    return { framework: 'react', projectType: 'react' };
  }
  if (packageJson || lockfiles.length > 0) {
    return { framework: 'node', projectType: 'node' };
  }
  return { framework: 'unknown', projectType: 'unknown' };
}

export async function buildProjectContext(
  cwd: string,
): Promise<ProjectContext> {
  const packageJsonPath = path.join(cwd, 'package.json');
  const packageJson =
    (await readJsonFile<PackageJsonShape>(packageJsonPath)) ?? null;

  const candidateConfigs = [
    'tsconfig.json',
    'vite.config.ts',
    'vite.config.js',
    'next.config.js',
    'next.config.mjs',
    'turbo.json',
  ];
  const candidateLockfiles = [
    'pnpm-lock.yaml',
    'package-lock.json',
    'yarn.lock',
  ];

  const [configFiles, lockfiles, tsconfig, gitBranch] = await Promise.all([
    Promise.all(
      candidateConfigs.map(async (file) =>
        (await fileExists(path.join(cwd, file))) ? file : null,
      ),
    ).then((items) => items.filter((item): item is string => item !== null)),
    Promise.all(
      candidateLockfiles.map(async (file) =>
        (await fileExists(path.join(cwd, file))) ? file : null,
      ),
    ).then((items) => items.filter((item): item is string => item !== null)),
    summarizeTsConfig(cwd),
    detectGitBranch(cwd),
  ]);

  const framework = detectFramework(packageJson, configFiles, lockfiles);
  return {
    cwd,
    packageJson: packageJson
      ? {
          name: packageJson.name,
          private: packageJson.private,
          packageManager: packageJson.packageManager,
          scripts: packageJson.scripts ?? {},
          dependencies: Object.keys(packageJson.dependencies ?? {}),
          devDependencies: Object.keys(packageJson.devDependencies ?? {}),
        }
      : null,
    lockfiles,
    tsconfig,
    configFiles,
    framework: framework.framework,
    projectType: framework.projectType,
    gitBranch,
  };
}

export async function readLogFile(logFile: string): Promise<string> {
  return fs.readFile(logFile, 'utf8');
}
