import { describe, expect, it } from 'vitest';
import { assertNoEventFilter, filtersFromInput, toFilterParams } from './filters';
import { McpToolError } from './errors';

describe('filtersFromInput', () => {
  it('picks only known filter keys from flat tool input', () => {
    expect(
      filtersFromInput({
        websiteId: '00000000-0000-0000-0000-000000000001',
        browser: 'chrome',
        country: 'US',
        startAt: '2024-01-01',
      }),
    ).toEqual({ browser: 'chrome', country: 'US' });
  });

  it('omits event when allowEvent is false', () => {
    expect(filtersFromInput({ event: 'signup', browser: 'chrome' }, { allowEvent: false })).toEqual({
      browser: 'chrome',
    });
  });

  it('returns undefined when no filter fields are set', () => {
    expect(filtersFromInput({ websiteId: 'x' })).toBeUndefined();
  });
});

describe('assertNoEventFilter', () => {
  it('throws when event is present', () => {
    expect(() => assertNoEventFilter({ event: 'signup' })).toThrow(McpToolError);
  });
});

describe('toFilterParams', () => {
  it('maps filters to API query keys', () => {
    expect(toFilterParams({ browser: 'chrome', segment: 'e676c9b4-11e4-4ef1-a4d7-87001773e9f2' })).toEqual({
      browser: 'chrome',
      segment: 'e676c9b4-11e4-4ef1-a4d7-87001773e9f2',
    });
  });
});
