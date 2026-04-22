export function toJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
