// Copyright 2022 Connor Speers. All rights reserved. MIT License.

import {
  type ConnInfo,
  type Handler,
  basename,
  joinPath,
  serveFile,
  fromFileUrl,
} from "./deps.ts";
import { useContext } from "./context.ts";

async function stat(path: string): Promise<Deno.FileInfo | null> {
  try {
    return await Deno.stat(path);
  } catch {
    return null;
  }
}

/** Creates a handler for serving static assets. */
export function assets(dir?: string): Handler {
  let assetsDir = dir ?? "assets";
  if (assetsDir.startsWith("file://")) {
    assetsDir = fromFileUrl(assetsDir);
  }

  return async (
    req: Request,
    conn: ConnInfo,
  ) => {
    const ctx = useContext(req, conn);
    const path = joinPath(assetsDir, ctx.path);

    const base = basename(path);
    if (base.startsWith("_") ||  base.startsWith(".")) {
      throw new Deno.errors.NotFound();
    }
    
    const stat1 = await stat(path);
    if (stat1 && stat1.isFile && path.endsWith(".html")) {
      const url = new URL(ctx.url);
      url.pathname = url.pathname.slice(0, -5);
      return Response.redirect(url.href);
    } else if (stat1 && stat1.isFile) {
      return await serveFile(req, path);
    }

    const stat2 = await stat(path + ".html");
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
