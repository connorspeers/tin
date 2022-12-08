// Copyright 2022 Connor Speers. All rights reserved. MIT License.

export interface BundleOptions {
  /** When `true`, suppresses error logs. */
  silent?: boolean;
}

/**
 * Bundles the given TypeScript file into an adjacent JavaScript file. If the
 * path is a directory, bundling will occur for every TypeScript file in the
 * directory, recursively.
 *
 * - The output file path is the same as the input file path but with a .js
 *   extension
 * - If the `watch` option is true, files are watched for changes; when updates
 *   occur to the source file, its bundle is regenerated
 * - When the path is a directory, files that begin with an underscore will be
 *   skipped
 * - Unless the `silent` option is `true`, errors will be logged to the console
 * - This function doesn't throw
 */
export async function bundle(path: string, opt: BundleOptions): Promise<void> {
  
}
