export function parseCsv(text: string, keepEmpty = false): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (ch === ',' && !quoted) { row.push(cell); cell = ""; }
    else if ((ch === '\n' || ch === '\r') && !quoted) { if (ch === '\r' && text[i+1] === '\n') i++; row.push(cell); rows.push(row); row=[]; cell=""; }
    else cell += ch;
  }
  if (quoted) throw new Error("CSV 引号未闭合，请检查文件格式。");
  row.push(cell); rows.push(row);
  return keepEmpty ? rows : rows.filter(r => r.some(c => c.trim()));
}
