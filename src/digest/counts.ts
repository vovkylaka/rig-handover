import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLine } from './read.js';
import type { RunStatus } from './types.js';

export type StatusCounts = Record<RunStatus, number>;

// Pure: count well-formed run lines by status. Bad lines are ignored.
export function countStatuses(text: string): StatusCounts {
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (line) counts[line.status]++;
  }
  return counts;
}

export function nightCounts(runsDir: string, night: string): StatusCounts {
  try {
    return countStatuses(readFileSync(join(runsDir, `${night}.jsonl`), 'utf8'));
  } catch {
    return { ok: 0, retry: 0, fail: 0 };
  }
}
