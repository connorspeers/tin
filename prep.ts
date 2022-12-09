// Copyright 2022 Connor Speers. All rights reserved. MIT License.

import {
  createGraph,
  toFileUrl,
  fromFileUrl,
  resolve,
  walk,
  bundle,
} from "./deps.ts";

export interface PrepOptions {
  /**
   * Toggles file system watching for updates. Default: `true`
   */
  watch?: boolean;
}

/**
 * Bundles the TypeScript files in the given directory into adjacent JavaScript
 * files, recursively.
 *
 * This function returns after the initial bundling. Then, the source files are
 * watched for changes which will trigger a re-bundle.
 *
 * The output file paths are equal to the input file paths but with a ".js"
 * extension instead of a ".ts" extension. This WILL overwrite old JavaScript
 * bundles, so consider this operation destructive.
 */
export async function prep(dir = "assets", opt?: PrepOptions): Promise<void> {
  dir = resolve(dir);
  const stat = await Deno.stat(dir);
  if (!stat.isDirectory) {
    throw new Error(`Not a directory: ${dir}`);
  }

  for await (const entry of walk(dir)) {
    if (entry.isFile && entry.path.endsWith(".ts")) {
      await process(entry.path, opt?.watch !== false);
    }
  }

  if (opt?.watch === false) {
    return;
  }
  (async () => {
    for await (const evt of Deno.watchFs(dir)) {
      for (const path of evt.paths) {
        if (path.endsWith(".ts")) {
          await process(path, true);
        }
      }
    }
  })();
}

const processing = new Set<string>();

/** Input must end in ".ts". */
async function process(input: string, watch?: boolean) {
  input = resolve(input);  
  if (processing.has(input)) {
    return;
  }
  processing.add(input);
  const output = input.slice(0, -3);

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
    deps = await customGraph(input);
    const code = await customBundle(input);
    await Deno.writeTextFile(output, code);
  } catch (err) {
    if (!watch) {
      processing.delete(input);
      throw err;
    }
    console.warn(err);
  }

  if (!watch) {
    processing.delete(input);
    return;
  }
  (async () => {
    for await (const _ of Deno.watchFs(deps)) {
      processing.delete(input);
      return await process(input, true);
    }
  })();
}

async function customGraph(input: string): Promise<string[]> {
  return (await createGraph(input)).modules
    .filter(m => m.specifier.startsWith("file://"))
    .map(m => fromFileUrl(m.specifier));
}

async function customBundle(input: string): Promise<string> {
  return (await bundle(toFileUrl(input), {
    allowRemote: true,
    type: "module",
    compilerOptions: {
      inlineSources: false,
      inlineSourceMap: false,
      sourceMap: false,
    },
    // Load?
  })).code;
}
