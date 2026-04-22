import { createColors } from 'picocolors';

export function getColors(enabled: boolean) {
  return createColors(enabled);
}

export function printKeyValue(label: string, value: string): string {
  return `${label}: ${value}`;
}
