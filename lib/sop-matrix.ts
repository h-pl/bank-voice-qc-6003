export type SopMatrixRow = { name: string; steps: { index: number; number: string; content: string; required: string }[] };

// Retain source indices and explicit step numbers so editing never silently rewrites imported data.
export function groupSopRows(rows: string[][]): SopMatrixRow[] {
  const groups: SopMatrixRow[] = [], latest = new Map<string, SopMatrixRow>();
  rows.forEach((row, index) => {
    const name = row[0] ?? "";
    let group = latest.get(name);
    if (!group || row[1] === "1") {
      group = { name, steps: [] };
      groups.push(group);
      latest.set(name, group);
    }
    group.steps.push({ index, number: row[1] ?? "", content: row[2] ?? "", required: row[3] ?? "" });
  });
  return groups;
}
