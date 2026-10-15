import { z } from 'zod';
import {
  ApiErrorSchema,
  ERROR_ACTIONS,
  routes,
  type RouteDef,
  type RouteName,
  type Routes,
} from './api.js';
import type { ErrorCode } from './kitty.js';

// Typed HTTP client built from `routes`: bigint in TypeScript, decimal strings on the wire.
// Each method takes one object merging path params, query and body (e.g. { id, as, decision }).

type Empty = Record<never, never>;
type Part<R, K extends string> = R extends { [P in K]: infer S extends z.ZodType }
  ? z.output<S>
  : Empty;

// Flattened so editor hints show `{ id: string; as: 'dave' }`, not an intersection.
type Flatten<T> = { [K in keyof T]: T[K] };
export type RouteInput<R extends RouteDef> = Flatten<
  Part<R, 'params'> & Part<R, 'query'> & Part<R, 'body'>
>;
export type RouteOutput<R extends RouteDef> = z.output<R['response']>;

export type ApiClient = {
  [K in RouteName]: Empty extends RouteInput<Routes[K]>
    ? (input?: RouteInput<Routes[K]>) => Promise<RouteOutput<Routes[K]>>
    : (input: RouteInput<Routes[K]>) => Promise<RouteOutput<Routes[K]>>;
};

// Every failure the UI sees: an ApiError from the server, or a transport/contract failure
// mapped to INTERNAL. `action` is always one human-readable next step.
export class ApiClientError extends Error {
  override readonly name = 'ApiClientError';

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly action: string,
    readonly httpStatus: number,
  ) {
    super(message);
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** The real client. `baseUrl` '' = same origin (the Vite dev server proxies /api). */
export function createFetchClient(
  baseUrl = '',
  fetchImpl: FetchLike = (input, init) => globalThis.fetch(input, init),
): ApiClient {
  const call = async (name: RouteName, input: Record<string, unknown> = {}) => {
    const route: RouteDef = routes[name];
    // Object schemas strip unknown keys, so each part is encoded from the merged input.
    const encode = (schema: z.ZodType) =>
      z.encode(schema, input as never) as Record<string, unknown>;

    let path = route.path;
    if (route.params) {
      for (const [k, v] of Object.entries(encode(route.params)))
        path = path.replace(`:${k}`, encodeURIComponent(String(v)));
    }
    if (route.query) {
      const qs = new URLSearchParams(
        Object.entries(encode(route.query)).map(([k, v]) => [k, String(v)]),
      ).toString();
      if (qs) path += `?${qs}`;
    }
    const init: RequestInit = { method: route.method };
    if (route.body) {
      init.headers = { 'content-type': 'application/json' };
      init.body = JSON.stringify(encode(route.body));
    }

    let res: Response;
    try {
      res = await fetchImpl(baseUrl + path, init);
    } catch (e) {
      throw new ApiClientError(
        'INTERNAL',
        `cannot reach the server: ${e instanceof Error ? e.message : String(e)}`,
        'Check that the server is running and retry.',
        0,
      );
    }

    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }

    if (!res.ok) {
      const err = ApiErrorSchema.safeParse(json);
      if (err.success) {
        const { code, message, action } = err.data.error;
        throw new ApiClientError(code, message, action, res.status);
      }
      throw new ApiClientError(
        'INTERNAL',
        `${route.method} ${route.path}: HTTP ${res.status}`,
        ERROR_ACTIONS.INTERNAL,
        res.status,
      );
    }

    const out = route.response.safeDecode(json);
    if (!out.success) {
      throw new ApiClientError(
        'INTERNAL',
        `${route.method} ${route.path}: response does not match the contract: ${out.error.message}`,
        ERROR_ACTIONS.INTERNAL,
        res.status,
      );
    }
    return out.data;
  };

  return Object.fromEntries(
    (Object.keys(routes) as RouteName[]).map((name) => [
      name,
      (input?: Record<string, unknown>) => call(name, input),
    ]),
  ) as unknown as ApiClient;
}
