export function makeToolText(result: {
  ok: boolean;
  error?: { message: string };
}): string {
  if (result.ok) {
    return 'Structured diagnosis data is available.';
  }
  return result.error?.message ?? 'Unknown error';
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function truncate(
  text: string | undefined,
  maxChars: number,
): string | undefined {
  if (!text) {
    return undefined;
  }
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

export function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}
