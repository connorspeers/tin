// Copyright 2022 Connor Speers. All rights reserved. MIT License.

import { assertEquals, assertRejects } from "./test_deps.ts";
import { prep } from "../prep.ts";
import { fromFileUrl } from "../deps.ts";

Deno.test("basic test", async () => {
  const i = import.meta.resolve("./assets");
  const o1 = fromFileUrl(import.meta.resolve("./assets/bundle1.js"));
  const o2 = fromFileUrl(import.meta.resolve("./assets/bundle2.js"));
  const o3 = fromFileUrl(import.meta.resolve("./assets/nested/bundle3.js"));
  const o4 = fromFileUrl(import.meta.resolve("./assets/_bundle4.js"));
  const o5 = fromFileUrl(import.meta.resolve("./assets/.bundle5.js"));
  await prep({
    dir: i,
    watch: false,
  });
  const r1 = await Deno.readTextFile(o1);
  const r2 = await Deno.readTextFile(o2);
  const r3 = await Deno.readTextFile(o3);
  await Deno.remove(o1);
  await Deno.remove(o2);
  await Deno.remove(o3);
  const answer = "//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IiJ9\n";
  assertEquals(r1, answer);
  assertEquals(r2, answer);
  assertEquals(r3, answer);
  await assertRejects(() => Deno.stat(o4));
  await assertRejects(() => Deno.stat(o5));
});

// TODO: Rebundle when a non-prepped dependency is updated
// TODO: Rebundle properly when a filename is changed
// TODO: Remove bundles for deleted sources
