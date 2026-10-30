import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const GOOD = '2026-01-01';
const EMPTY = '2026-01-02';
const BAD = '2026-01-03';
const MISSING = '2026-01-04';

const line = (o: Record<string, unknown>) => JSON.stringify(o);

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  writeFileSync(
    join(dir, `${GOOD}.jsonl`),
    [
      line({ at: '2026-01-01T01:00:00+01:00', job: 'zeta-sync', status: 'ok', owner: 'ana' }),
      line({ at: '2026-01-01T01:05:00+01:00', job: 'alpha-backup', status: 'retry', owner: 'bo', error: 'timeout' }),
      line({ at: '2026-01-01T01:10:00+01:00', job: 'alpha-backup', status: 'fail', owner: 'bo', error: 'disk full' }),
      line({ at: '2026-01-01T02:00:00+01:00', job: 'mid-report', status: 'ok' }),
    ].join('\n') + '\n',
  );
  writeFileSync(join(dir, `${EMPTY}.jsonl`), '');
  writeFileSync(
    join(dir, `${BAD}.jsonl`),
    [
      line({ at: '2026-01-03T01:00:00+01:00', job: 'only-job', status: 'ok', owner: 'ana' }),
      'not json at all',
      '{"at": 1}',
    ].join('\n') + '\n',
  );
  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir: dir,
  });
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('GET /digest/:night', () => {
  it('renders the jobs for a good night, sorted by job', async () => {
    const res = await app.request(`/digest/${GOOD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain(`digest · ${GOOD}`);
    const a = html.indexOf('alpha-backup');
    const m = html.indexOf('mid-report');
    const z = html.indexOf('zeta-sync');
    expect(a).toBeGreaterThan(-1);
    expect(m).toBeGreaterThan(a);
    expect(z).toBeGreaterThan(m);
    expect(html).toContain('disk full');
    expect(html).not.toContain('nothing ran');
    expect(html).not.toContain('bad line');
  });

  it('marks failing rows with class="warn"', async () => {
    const html = await (await app.request(`/digest/${GOOD}`)).text();
    expect(html).toContain('class="warn"');
  });

  it('renders missing values as a dash', async () => {
    const html = await (await app.request(`/digest/${GOOD}`)).text();
    expect(html).toContain('—');
  });

  it('says nothing ran for an empty night file', async () => {
    const res = await app.request(`/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('counts bad lines and still shows the good ones', async () => {
    const res = await app.request(`/digest/${BAD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('only-job');
    expect(html).toMatch(/2 bad line\(s\) skipped/);
  });

  it('404s for a night with no file', async () => {
    const res = await app.request(`/digest/${MISSING}`);
    expect(res.status).toBe(404);
    expect(await res.text()).toContain(`no run log for ${MISSING}`);
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the Night with rows in the same order as the page', async () => {
    const res = await app.request(`/api/digest/${GOOD}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.night).toBe(GOOD);
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha-backup', 'mid-report', 'zeta-sync']);
    const alpha = body.rows[0]!;
    expect(alpha.runs).toBe(2);
    expect(alpha.retries).toBe(1);
    expect(alpha.lastStatus).toBe('fail');
    expect(alpha.lastError).toBe('disk full');

    const html = await (await app.request(`/digest/${GOOD}`)).text();
    const positions = body.rows.map((r) => html.indexOf(r.job));
    expect([...positions].sort((x, y) => x - y)).toEqual(positions);
  });

  it('returns no rows for an empty night', async () => {
    const res = await app.request(`/api/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: EMPTY, rows: [], badLines: 0 });
  });

  it('counts bad lines', async () => {
    const res = await app.request(`/api/digest/${BAD}`);
    const body = (await res.json()) as Night;
    expect(body.badLines).toBe(2);
    expect(body.rows).toHaveLength(1);
  });

  it('404s with an error body for a night with no file', async () => {
    const res = await app.request(`/api/digest/${MISSING}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log', night: MISSING });
  });
});
