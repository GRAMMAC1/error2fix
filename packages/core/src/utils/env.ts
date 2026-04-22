export function detectPackageManager(
  userAgent = process.env.npm_config_user_agent ?? '',
): string {
  if (userAgent.startsWith('pnpm')) {
    return 'pnpm';
  }
  if (userAgent.startsWith('yarn')) {
    return 'yarn';
  }
  if (userAgent.startsWith('npm')) {
    return 'npm';
  }
  return 'unknown';
}
