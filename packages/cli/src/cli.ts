import { createRequire } from 'node:module';
import type { CliFlags } from '@error2fix/core';
import { cac } from 'cac';
import { runClearCommand } from './commands/clear.js';
import { runFixCommand } from './commands/fix.js';
import { runInitCommand } from './commands/init.js';
import { runInternalCaptureCommand } from './commands/internal-capture.js';
import {
  maybePromptForUpgrade,
  shouldCheckForUpdates,
  startUpdateCheck,
} from './update.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };
const internalCommands = new Set(['__capture']);

interface GlobalOptions {
  json?: boolean;
  color?: boolean;
  debug?: boolean;
}

interface CaptureOptions extends GlobalOptions {
  shell: 'zsh' | 'bash' | 'fish' | 'unknown';
  command: string;
  exitCode: string;
  cwd: string;
  timestamp?: string;
  stdoutLog?: string;
  stderrLog?: string;
}

function collectFlags(options: GlobalOptions): CliFlags {
  return {
    json: options.json ?? false,
    color: options.color ?? true,
    debug: options.debug ?? false,
  };
}

async function handleCommand(
  task: () => Promise<string>,
  flags: CliFlags,
  updatePromise?: Promise<{
    updateAvailable: boolean;
    latestVersion: string | null;
  }> | null,
): Promise<void> {
  try {
    const output = await task();
    if (output) {
      console.log(output);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    if (flags.debug && error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  } finally {
    if (updatePromise) {
      await maybePromptForUpgrade(updatePromise);
    }
  }
}

function getUpdatePromise(
  commandName: string | null,
  flags: CliFlags,
): Promise<{ updateAvailable: boolean; latestVersion: string | null }> | null {
  return shouldCheckForUpdates(commandName, flags) ? startUpdateCheck() : null;
}

const cli = cac('e2f');

cli
  .option('--json', 'Output machine-readable JSON')
  .option('--no-color', 'Disable ANSI colors')
  .option('--debug', 'Enable debug output')
  .help((sections) =>
    sections.map((section) => ({
      ...section,
      body: section.body
        .split('\n')
        .filter((line) => {
          const trimmed = line.trim();
          return ![...internalCommands].some(
            (command) =>
              trimmed.startsWith(`${command} `) ||
              trimmed.startsWith(`$ e2f ${command}`),
          );
        })
        .join('\n'),
    })),
  )
  .version(packageJson.version)
  .usage('[command] [options]');

cli
  .command(
    'fix',
    'Load the latest failed command session and print a diagnosis summary.',
  )
  .action(async (options: GlobalOptions) => {
    const flags = collectFlags(options);
    await handleCommand(
      () => runFixCommand(flags),
      flags,
      getUpdatePromise('fix', flags),
    );
  });

cli
  .command('init', 'Install shell integration and initialize ~/.e2f storage.')
  .action(async (options: GlobalOptions) => {
    const flags = collectFlags(options);
    await handleCommand(() => runInitCommand(flags), flags);
  });

cli
  .command('clear', 'Remove e2f shell hooks and clear local ~/.e2f data.')
  .action(async (options: GlobalOptions) => {
    const flags = collectFlags(options);
    await handleCommand(() => runClearCommand(flags), flags);
  });

cli
  .command(
    '__capture',
    'Internal command used by shell integration to persist failed command sessions.',
  )
  .option('--shell <shell>', 'Shell name')
  .option('--command <command>', 'Command that failed')
  .option('--exit-code <code>', 'Exit code')
  .option('--cwd <cwd>', 'Working directory')
  .option('--timestamp <timestamp>', 'ISO timestamp')
  .option('--stdout-log <path>', 'Captured stdout log file')
  .option('--stderr-log <path>', 'Captured stderr log file')
  .action(async (options: CaptureOptions) => {
    const flags = collectFlags(options);
    await handleCommand(
      () =>
        runInternalCaptureCommand({
          shell: options.shell,
          command: options.command,
          exitCode: Number.parseInt(options.exitCode, 10),
          cwd: options.cwd,
          timestamp: options.timestamp,
          stdoutLog: options.stdoutLog,
          stderrLog: options.stderrLog,
        }),
      flags,
      null,
    );
  });

const parsed = cli.parse(process.argv, { run: false });
const selectedFlags = collectFlags(parsed.options);

if (parsed.options.help || parsed.options.version) {
  // cac already prints help/version during parse(); stop before falling through
} else if (cli.matchedCommand) {
  await cli.runMatchedCommand();
} else if (parsed.args.length === 0) {
  await handleCommand(
    () => runFixCommand(selectedFlags),
    selectedFlags,
    getUpdatePromise('fix', selectedFlags),
  );
} else {
  console.error(`Unknown command: ${parsed.args[0]}`);
  cli.outputHelp();
  process.exitCode = 1;
}
