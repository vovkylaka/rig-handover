// Plan morning-digest § 1. The contract every part of § 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after parsing.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job for the night. Times keep the log's offset, never converted to UTC.
export type DigestRow = {
  job: string;
  owner: string | null; // null renders as `—`
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null; // error of the last line that had one
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string; // YYYY-MM-DD, the file name
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that didn't parse; counted, never thrown
};

// null when runs/<night>.jsonl doesn't exist (the routes answer 404).
export type ReadNight = (runsDir: string, night: string) => Night | null;
