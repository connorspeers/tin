// Copyright 2022 Connor Speers. All rights reserved. MIT License.

import { assertEquals, assertRejects } from "./test_deps.ts";
import { prep } from "../prep.ts";

Deno.test("prep", async () => {
  const i = import.meta.resolve("./assets");
  const o1 = import.meta.resolve("./assets/bundles/1.js");
  const o2 = import.meta.resolve("./assets/bundles/2.js");
  const o3 = import.meta.resolve("./assets/bundles/.3.js"); // Shouldn't exist
  await prep(i);
  const r1 = await Deno.readTextFile(o1);
  const r2 = await Deno.readTextFile(o2);
  await Deno.remove(o1);
  await Deno.remove(o2);
  assertEquals(r1, ""); // FIXME
  assertEquals(r2, ""); // FIXME
  await assertRejects(() => Deno.stat(o3));
});

// TODO: Rebundle when a non-prepped dependency is updated
// TODO: Rebundle properly when a filename is changed
// TODO: Remove bundles for deleted sources
