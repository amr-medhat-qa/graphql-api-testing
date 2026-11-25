import type { APIRequestContext, APIResponse } from '@playwright/test';

export interface GraphQLError {
  message: string;
  locations?: { line: number; column: number }[];
  extensions?: { code?: string };
}

export interface GraphQLResult<T = unknown> {
  status: number;
  /** Parsed JSON body, or undefined when the server answered with an empty or non-JSON body. */
  body?: { data?: T | null; errors?: GraphQLError[] };
  rawBody: string;
  durationMs: number;
}

const MAX_ATTEMPTS = 6;
/** Minimum gap between two requests, so a long run stays under the public API's rate limit. */
const MIN_GAP_MS = 250;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let nextSlot = 0;
/** Spaces requests out (the tests run in one process, so a module-level clock is enough). */
async function pace(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_GAP_MS;
  if (wait > 0) await sleep(wait);
}

/** How long to wait before retrying: the server's `Retry-After` when it sends one, else growing backoff. */
function backoffMs(attempt: number, response?: APIResponse): number {
  const retryAfter = Number(response?.headers()['retry-after']);
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 10_000);
  return Math.min(1000 * 2 ** (attempt - 1), 8000);
}

/**
 * A free public API sheds load by resetting connections or answering with an HTML error page.
 * Those are infrastructure hiccups, not GraphQL answers, so only they are retried (never a 4xx JSON error).
 */
function isTransient(response: APIResponse): boolean {
  const type = response.headers()['content-type'] ?? '';
  return [429, 502, 503, 504].includes(response.status()) || type.includes('text/html');
}

/**
 * Thin GraphQL-over-HTTP client. A GraphQL call is always one request to a single endpoint,
 * so success/failure has to be read from the HTTP status *and* from `errors` in the body.
 */
export class GraphQLClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly path = '/graphql',
  ) {}

  async query<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<GraphQLResult<T>> {
    return this.send<T>({ query, ...(variables ? { variables } : {}) });
  }

  /** Sends an arbitrary JSON payload, for malformed-request scenarios. */
  async send<T = unknown>(payload: Record<string, unknown>): Promise<GraphQLResult<T>> {
    return this.execute<T>(() => this.request.post(this.path, { data: payload }));
  }

  /** GraphQL over GET (query string), supported by many servers for read-only queries. */
  async get<T = unknown>(query: string): Promise<GraphQLResult<T>> {
    return this.execute<T>(() => this.request.get(this.path, { params: { query } }));
  }

  private async execute<T>(call: () => Promise<APIResponse>): Promise<GraphQLResult<T>> {
    for (let attempt = 1; ; attempt++) {
      await pace();
      const started = Date.now();
      let response: APIResponse | undefined;
      try {
        response = await call();
      } catch (error) {
        if (attempt >= MAX_ATTEMPTS) throw error; // connection reset: retry, then report it
      }
      if (response && (!isTransient(response) || attempt >= MAX_ATTEMPTS)) {
        const rawBody = await response.text();
        let body: GraphQLResult<T>['body'];
        try {
          body = rawBody ? JSON.parse(rawBody) : undefined;
        } catch {
          body = undefined;
        }
        return { status: response.status(), body, rawBody, durationMs: Date.now() - started };
      }
      await sleep(backoffMs(attempt, response));
    }
  }
}
