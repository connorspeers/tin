// Copyright 2022 Connor Speers. All rights reserved. MIT License.
// This module is browser-compatible.

/**
 * Generates a CSS class string from the given inputs. Non-strings and empty
 * strings are skipped, the rest are joined with a space separator.
 */
export function cx(...classes: unknown[]): string {
  return classes.filter(c => c && typeof c === "string").join(" ");
}
