// Copyright 2022 Connor Speers. All rights reserved. MIT License.

import type { ConnInfo } from "./deps.ts";
import { type Context, useContext } from "./context.ts";

/**
 * Handler type supported by the Router. Compatible with Deno's standard Handler
 * type.
 */
export type RouterHandler = (
  req: Request,
  context: Context,
) => Response | Promise<Response>;

/** The shape of a router, mapping route path to its corresponding handler. */
export interface RouterShape {
  [x: string]: RouterHandler | RouterHandler[] | null;
}

/** Routes requests between multiple handlers based on request path. */
export type Router<Shape extends RouterShape> = (
  & Shape
  & ((req: Request, conn: ConnInfo) => Promise<Response>)
);

/** Creates a Router handler, for routing requests based on request path. */
export function router<Shape extends RouterShape>(
  shape: Shape,
): Router<Shape> {
  const keys = Object.keys(shape).filter(k => !!shape[k]);
  sortKeys(keys);

  const routes = new Map<string[], RouterHandler[]>();
  for (const k of keys) {
    let handlers = shape[k]!;
    if (typeof handlers === "function") {
      handlers = [handlers];
    }
    routes.set(k.split("/").map(decodeURIComponent), handlers);
  }

  const handler = async (
    req: Request,
    conn: ConnInfo,
  ): Promise<Response> => {
    const ctx = useContext(req, conn);
    const path = ctx.path.slice(1).split("/").map(decodeURIComponent);
    
    for (const [pattern, handlers] of routes.entries()) {
      const match = matchPattern(pattern, path);
      if (!match) {
        continue;
      }

      let routedPath = ctx.routedPath;
      if (routedPath !== "/") {
        routedPath += `/${match.routed}`;
      } else {
        routedPath += match.routed;
      }

      const nextCtx = {
        ...ctx,
        routedPath,
        path: `/${match.unrouted}`,
        params: { ...ctx.params, ...match.param },
      };
      for (const h of handlers) {
        try {
          return await h(req, nextCtx);
        } catch (e) {
          if (e instanceof Deno.errors.NotFound && !req.bodyUsed) {
            continue;
          }
          throw e;
        }
      }
    }
    throw new Deno.errors.NotFound(ctx.path);
  };

  return Object.assign(handler, shape);
}

function sortKeys(keys: string[]) {
  for (const k of keys) {
    if (!k) {
      continue; // Empty key is allowed
    }

    const split = k.split("/");
    for (let i = 0; i < split.length; i++) {
      const s = split[i];
      if (!s) {
        throw new SyntaxError(
          `Leading/trailing/duplicate slashes aren't allowed: ${k}`,
        );
      }

      if (s === "*" && i !== split.length - 1) {
        throw new SyntaxError(
          `Wildcards are only allowed at the end of the route path: ${k}`,
        );
      }

      if (s !== "*" && s.indexOf("*") !== -1) {
        throw new SyntaxError(
          `Wildcards can only appear as complete segments at the end of the route path: ${k}`,
        );
      }

      if (s === "." || s === "..") {
        throw new SyntaxError(
          `'..' and '.' aren't allowed as router path segments: ${k}`,
        );
      }
    }
  }

  keys.sort((a, b) => {
    if (a === b) {
      return 0;
    }

    // Forwarding paths should always come after non-forwarding paths
    if (a.endsWith("*") && !b.endsWith("*")) {
      return 1;
    }
    if (!a.endsWith("*") && b.endsWith("*")) {
      return -1;
    }

    const sa = a.split("/");
    const sb = b.split("/");
    for (let i = 0; i <= Math.max(sa.length, sb.length); i++) {
      if (i === sa.length && i === sb.length) {
        break;
      }
      if (i === sa.length) {
        return 1;
      }
      if (i === sb.length) {
        return -1;
      }
      if (
        (sa[i] === "*" && sb[i] === "*") ||
        (sa[i][0] === ":" && sb[i][0] === ":")
      ) {
        continue;
      }
      if (sa[i] === "*" || (sa[i][0] === ":" && sb[i] !== "*")) {
        return 1;
      }
      if (sb[i] === "*" || (sb[i][0] === ":" && sa[i] !== "*")) {
        return -1;
      }
    }

    return keys.indexOf(b) - keys.indexOf(a);
  });
}

function matchPattern(pattern: string[], path: string[]) {
  if (
    (pattern[pattern.length-1] !== "*" && pattern.length !== path.length) ||
    (pattern[pattern.length-1] === "*" && pattern.length - 1 > path.length)
  ) {
    return null;
  }

  const param: Record<string, string> = {};
  let routed = "";
  let unrouted = "";
  
  // For the root path, the leading slash is always inferred. If the route
  // pattern is the empty string and the "index" path didn't match, allow the
  // empty string to match. Don't do this for non-root paths, since trailing
  // slashes are never inferred if the path isn't root
  if (
    pattern.length === 1 &&
    path.length === 1 &&
    !pattern[0] &&
    path[0] === "index"
  ) {
    routed = "index";
    return { param, routed, unrouted };
  }
  
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === "*") {
      unrouted = path.slice(i).join("/");
      break;
    }
    if (pattern[i][0] === ":") {
      routed += routed ? "/" + path[i] : path[i];
      param[pattern[i].slice(1)] = path[i];
      continue;
    }
    if (pattern[i] !== path[i]) {
      return null;
    }
    routed += routed ? "/" + path[i] : path[i];
  }
  return { param, routed, unrouted };
}
