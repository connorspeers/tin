// Copyright 2022 Connor Speers. All rights reserved. MIT License.

import {
  type ConnInfo,
  type Handler,
  basename,
  joinPath,
  serveFile,
  fromFileUrl,
} from "./deps.ts";
import { context } from "./context.ts";

async function stat(path: string): Promise<Deno.FileInfo | null> {
  try {
    return await Deno.stat(path);
  } catch {
    return null;
  }
}

export interface AssetsInit {
  /**
   * When true, TypeScript files will be served instead of skipped. Default:
   * `false`
   */
  serveTs?: boolean;
}

/**
 * Creates a handler for serving static assets.
 *
 * By default, TypeScript files will be treated as if they aren't there. To
 * serve them like normal, use the `serveTs` option.
 */
export function assets(dir: string, init?: AssetsInit): Handler {
  if (dir.startsWith("file://")) {
    dir = fromFileUrl(dir);
  }

  return async (
    req: Request,
    conn: ConnInfo,
  ) => {
    const ctx = context(req, conn);
    const path = joinPath(dir, ctx.path);
    const base = basename(ctx.url.pathname);

    if (
      base.startsWith(".") ||
      (!init?.serveTs && base.endsWith(".ts"))
    ) {
      throw new Deno.errors.NotFound();
    }
    
    const stat1 = await stat(path);
    if (stat1 && stat1.isFile && base === "index.html") {
      const url = new URL(ctx.url);
      url.pathname = joinPath(url.pathname, "..");
      return Response.redirect(url.href);
    }
    if (stat1 && stat1.isFile && base.endsWith(".html")) {
      const url = new URL(ctx.url);
      url.pathname = url.pathname.slice(0, -5);
      return Response.redirect(url.href);
    }
    if (stat1 && stat1.isFile) {
      return await serveFile(req, path);
    }

    const stat2 = await stat(path + ".html");
    if (stat2 && stat2.isFile && base === "index") {
      const url = new URL(ctx.url);
      url.pathname = joinPath(url.pathname, "..");
      return Response.redirect(url.href);
    }
    if (stat2 && stat2.isFile) {
      return await serveFile(req, path + ".html");
    }

    if (ctx.url.pathname.endsWith("/")) {
      const stat3 = await stat(joinPath(path, ".."));
      const stat4 = await stat(joinPath(path, "..") + ".html");
      if ((stat3 && stat3.isFile) || (stat4 && stat4.isFile)) {
        const url = new URL(ctx.url);
        url.pathname = url.pathname.slice(0, -1);
        return Response.redirect(url.href);
      }
    } else if (stat1 && stat1.isDirectory) {
      const stat5 = await stat(joinPath(path, "index"));
      const stat6 = await stat(joinPath(path, "index.html"));
      if ((stat5 && stat5.isFile) || (stat6 && stat6.isFile)) {
        const url = new URL(ctx.url);
        url.pathname += "/";
        return Response.redirect(url.href);
      }
    }

    throw new Deno.errors.NotFound(ctx.path);
  };
}
