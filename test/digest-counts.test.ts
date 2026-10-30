import { describe, expect, it } from 'vitest';
import { countStatuses } from '../src/digest/counts.js';

describe('countStatuses', () => {
  it('sums lines by status and skips bad lines', () => {
    const text = [
      '{"at":"a","job":"x","status":"ok"}',
      '{"at":"b","job":"x","status":"retry"}',
      '{"at":"c","job":"y","status":"fail"}',
      '{"at":"d","job":"y","status":"ok"}',
      'garbage',
      '',
    ].join('\n');
    expect(countStatuses(text)).toEqual({ ok: 2, retry: 1, fail: 1 });
  });
});
