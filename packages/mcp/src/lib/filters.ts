import { z } from 'zod';
import { McpToolError } from './errors';

const filterValue = z
  .string()
  .min(1)
  .describe(
    'Exact match by default. Prefix with an operator: "neq.value", "c.value" (contains), "dnc.value", "re.regex", "nre.regex". Comma-separate multiple values: "chrome,firefox".',
  );

/** Example shapes agents can copy (also valid as top-level tool arguments). */
export const FILTER_EXAMPLES = {
  browserAndCountry: { browser: 'chrome', country: 'US' },
  pagePath: { path: '/pricing' },
  segment: { segment: 'e676c9b4-11e4-4ef1-a4d7-87001773e9f2' },
  customEvent: { event: 'signup' },
} as const;

const filterFieldDescriptions: Record<string, string> = {
  path: 'Page path, e.g. "/pricing".',
  referrer: 'Referrer domain, e.g. "google.com".',
  title: 'Page title.',
  query: 'URL query string.',
  hostname: 'Hostname the page was served from.',
  event: 'Custom event name (event tools and event-type metrics only).',
  tag: 'Tracker tag.',
  browser: 'Browser name, e.g. "chrome".',
  os: 'Operating system, e.g. "Mac OS".',
  device: 'Device type: desktop, laptop, tablet or mobile.',
  country: 'ISO 3166-1 alpha-2 country code, e.g. "US".',
  region: 'Region code, e.g. "US-CA".',
  city: 'City name.',
  language: 'Browser language, e.g. "en-US".',
  distinctId: 'Identified user ID (distinct ID).',
  utmSource: 'UTM source.',
  utmMedium: 'UTM medium.',
  utmCampaign: 'UTM campaign.',
  utmContent: 'UTM content.',
  utmTerm: 'UTM term.',
  segment: 'Saved segment ID (see list_segments).',
  cohort: 'Saved cohort ID (see list_segments).',
  match: 'Whether all set filters must match ("all", default) or any may match ("any").',
};

function optionalFilterField(key: keyof typeof filterFieldDescriptions) {
  const base = filterValue.optional().describe(filterFieldDescriptions[key]);

  if (key === 'segment' || key === 'cohort') {
    return z.string().uuid().optional().describe(filterFieldDescriptions[key]);
  }

  if (key === 'match') {
    return z
      .enum(['all', 'any'])
      .optional()
      .describe(filterFieldDescriptions[key]);
  }

  return base;
}

const allFilterKeys = Object.keys(filterFieldDescriptions) as (keyof typeof filterFieldDescriptions)[];

const pageviewFilterKeys = allFilterKeys.filter(key => key !== 'event');

function buildFilterFields(keys: readonly (keyof typeof filterFieldDescriptions)[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const key of keys) {
    shape[key] = optionalFilterField(key);
  }

  return shape;
}

/** Optional filter arguments at the top level of a tool (no nested "filters" object). */
export const pageviewFilterFields = buildFilterFields(pageviewFilterKeys);

/**
 * Pageview tools accept but reject `event` so agents get a clear error instead of a stripped argument.
 */
export const pageviewEventGuardField = {
  event: filterValue
    .optional()
    .describe(
      'Not supported on pageview or performance tools. Use get_event_stats, get_event_series, or get_website_metrics with type "event".',
    ),
};

/** Same as pageview filters plus `event` for event-scoped analytics tools. */
export const eventFilterFields = buildFilterFields(allFilterKeys);

export type Filters = {
  [K in keyof typeof filterFieldDescriptions]?: string;
};

export const filtersSchema = z
  .object(
    Object.fromEntries(
      allFilterKeys.map(key => [key, optionalFilterField(key)]),
    ) as z.ZodRawShape,
  )
  .strict();

// Pageview and performance queries never match a custom event name (#3886),
// so their tools reject the event filter instead of returning zeros.
export const pageviewFiltersSchema = filtersSchema.omit({ event: true });

const FILTER_KEY_SET = new Set<string>(allFilterKeys);

export function filtersFromInput(
  input: Record<string, unknown>,
  options: { allowEvent?: boolean } = {},
): Filters | undefined {
  const allowEvent = options.allowEvent ?? true;
  const picked: Filters = {};

  for (const key of allFilterKeys) {
    if (key === 'event' && !allowEvent) {
      continue;
    }

    const value = input[key];

    if (value !== undefined && value !== null && value !== '') {
      picked[key] = String(value);
    }
  }

  return Object.keys(picked).length ? picked : undefined;
}

export function assertNoEventFilter(
  filters: Filters | undefined,
  message = 'The event filter only applies on event analytics tools. To analyze a custom event, use get_event_stats or get_event_series.',
) {
  if (filters?.event) {
    throw new McpToolError('invalid_input', message);
  }
}

export function toFilterParams(filters?: Filters): Record<string, string> {
  const params: Record<string, string> = {};

  if (!filters) {
    return params;
  }

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '' && FILTER_KEY_SET.has(key)) {
      params[key] = String(value);
    }
  }

  return params;
}
