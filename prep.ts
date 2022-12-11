// Copyright 2022 Connor Speers. All rights reserved. MIT License.

import {
  createGraph,
  toFileUrl,
  fromFileUrl,
  resolve,
  walk,
  bundle,
  basename,
} from "./deps.ts";

const prepping = new Map<string, Deno.FsWatcher>();

export interface PrepOptions {
  /**
   * Toggles file system watching for updates. Default: `false`
   */
  watch?: boolean;
}

/**
 * Bundles the TypeScript files in the given directory into adjacent JavaScript
 * files, recursively.
 *
 * This function returns after the initial bundling. Then, if the `watch` option
 * is `true`, the source files are watched for changes which will trigger a
 * re-bundle.
 *
 * The output file paths are equal to the input file paths but with a ".js"
 * extension instead of a ".ts" extension. This WILL overwrite old JavaScript
 * bundles, so consider this operation destructive.
 */
export async function prep(dir: string, opt?: PrepOptions): Promise<void> {
  const dirUrl = (
    dir.startsWith("file://") ? dir
    : toFileUrl(resolve(dir))
  );
  dir = fromFileUrl(dirUrl);
  const stat = await Deno.stat(dir);
  if (!stat.isDirectory) {
    throw new Error(`Not a directory: ${dir}`);
  }
  if (prepping.has(dir)) {
    return;
  }

  for await (const entry of walk(dir)) {
    if (
      entry.isFile &&
      (entry.path.endsWith(".ts") || entry.path.endsWith(".tsx")) &&
      entry.name[0] !== "." && entry.name[0] !== "_"
    ) {
      await process(entry.path, opt?.watch);
    }
  }

  if (!opt?.watch) {
    return;
  }

  const watcher = Deno.watchFs(dir);
  prepping.set(dir, watcher);

  (async () => {
    for await (const evt of watcher) {
      for (const path of evt.paths) {
        const base = basename(path);
        if (
          base[0] !== "." &&
          base[0] !== "_" &&
          (path.endsWith(".ts") || path.endsWith(".tsx"))
        ) {
          await process(path, true);
        }
      }
    }
  })();
}

const processing = new Map<string, Deno.FsWatcher | null>();

/** Input must end in ".ts". */
async function process(input: string, watch?: boolean) {
  const inputUrl = toFileUrl(input).href;
  input = fromFileUrl(inputUrl);
  if (processing.has(input)) {
    return;
  }
  processing.set(input, null);
  const output = input + ".js";

  try {
    const stat = await Deno.stat(input);
    if (!stat.isFile) {
      throw null;
    }
  } catch {
    // Delete the output file if it's there
    try {
      const stat = await Deno.stat(output);
      if (stat.isFile) {
        try {
          await Deno.remove(output);
        } catch (err) {
          console.warn(err);
        }
      }
    } catch {
      // continue
    }
    processing.delete(input);
    return;
  }

  let deps = [input];
  try {
    deps = await customGraph(inputUrl);
    const code = await customBundle(input);
    await Deno.writeTextFile(output, code);
  } catch (err) {
    if (!watch) {
      processing.delete(input);
      throw err;
    }
    console.warn(err);
  }

  // The first conditional is needed in case stopPrep was called before the
  // bundle was complete. If that happens, disregard the watch option
  if (!processing.has(input)) {
    return;
  }
  if (!watch) {
    processing.delete(input);
    return;
  }

  const watcher = Deno.watchFs(deps);
  processing.set(input, watcher);

  (async () => {
    for await (const _ of watcher) {
      processing.delete(input);
      return await process(input, true);
    }
  })();
}

/** Closes all prep watch loops. This is used to clean up during testing. */
export function stopPrep() {
  for (const [k, v] of prepping.entries()) {
    v.close();
    prepping.delete(k);
  }
  for (const [k, v] of processing.entries()) {
    if (v) {
      v.close();
    }
    processing.delete(k);
  }
}

/** Input should be a file URL. */
async function customGraph(input: string): Promise<string[]> {
  return (await createGraph(input)).modules
    .filter(m => m.specifier.startsWith("file://"))
    .map(m => fromFileUrl(m.specifier));
}

/** Input should NOT be a file URL. */
async function customBundle(input: string): Promise<string> {
  return (await bundle(input, {
    allowRemote: true,
    type: "module",
    // https://github.com/denoland/deno_emit/issues/61#issuecomment-1250137994
    load: async (specifier) => {
      const res = await fetch(specifier);
      const headers: Record<string, string> = {};
      for (const [k, v] of res.headers.entries()) {
        if (!headers[k]) {
          headers[k] = v;
        }
      }
      return {
        kind: "module",
        specifier: res.url,
        headers: headers,
        content: await res.text(),
      };
    },
  })).code;
}
