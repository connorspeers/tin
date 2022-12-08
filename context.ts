// Copyright 2022 Connor Speers. All rights reserved. MIT License.

import type { ConnInfo } from "./deps.ts";

const _context = Symbol("_context");

/** Contextual information related to the incoming request. */
// deno-lint-ignore ban-types
export type Context<T = {}> = ConnInfo & T & {
  [_context]: true;
  /** URL instance created from the request url. */
  url: URL;
  /** The unrouted portion of the request path. */
  path: string;
  /** The routed portion of the request path. */
  routedPath: string;
  /** Path parameters captured during routing. */
  params: Record<string, string>;
  /** The query string parameters of the request URL, as a Record. */
  query: Record<string, string | string[]>;
};

/**
 * Returns the Context instance for a given Request and ConnInfo pair. If the
 * `connInfo` instance is already a Context, it's returned unmodified.
 */
export function context(req: Request, connInfo: ConnInfo): Context {
  if ((connInfo as Context)[_context]) {
    return connInfo as Context;
  }

  const url = new URL(req.url);
  let path = url.pathname;
  if (url.pathname.endsWith("/")) {
    path += "index";
  }

  const query: Record<string, string | string[]> = {};
  for (const [k, v] of url.searchParams.entries()) {
    const old = query[k];
    if (Array.isArray(old)) {
      old.push(v);
      continue;
    }
    if (typeof old !== "undefined") {
      query[k] = [old, v];
      continue;
    }
    query[k] = v;
  }

  return {
    [_context]: true,
    ...connInfo,
    url,
    path,
    routedPath: "",
    params: {},
    query,
  };
}
