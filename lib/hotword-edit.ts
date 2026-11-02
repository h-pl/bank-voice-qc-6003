import { serializeRows } from "./resource-import.ts";

// Quote explicit empty table rows so existing trailing-newline normalization cannot discard them.
export function serializeHotwordRows(rows: string[][]): string {
  return ["词条", ...rows.map(row => row[0]?.trim() ? serializeRows([row]) : '""')].join("\n");
}

export function pasteHotwordRows(rows: string[][], index: number, text: string, start: number, end: number) {
  const words = text.split(/\r\n?|\n/).map(word => word.trim()).filter(Boolean);
  if (!words.length) return null;
  const current = rows[index]?.[0] ?? "";
  words[0] = current.slice(0, start) + words[0];
  const caret = words.at(-1)!.length;
  words[words.length - 1] += current.slice(end);
  return { rows: [...rows.slice(0, index), ...words.map(word => [word]), ...rows.slice(index + 1)], lastIndex: index + words.length - 1, caret };
}
