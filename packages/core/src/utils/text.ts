export function firstNonEmptyLine(
  text: string | undefined,
): string | undefined {
  return text
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
}
