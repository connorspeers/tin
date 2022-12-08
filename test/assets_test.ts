// Copyright 2022 Connor Speers. All rights reserved. MIT License.

import { assertEquals, assertRejects } from "./test_deps.ts";
import { assets } from "./assets.ts";
import type { ConnInfo } from "./deps.ts";
import { router } from "./router.ts";

const connInfo: ConnInfo = {
  localAddr: {
    hostname: "localhost",
    port: 8000,
    transport: "tcp",
  },
  remoteAddr: {
    hostname: "localhost",
    port: 8001,
    transport: "tcp",
  },
};

const app = assets(import.meta.resolve("./assets"));

Deno.test("serves regular file", async () => {
  const req = new Request("http://_/file.txt");
  const res = await app(req, connInfo);
  assertEquals(await res.text(), "file\n");
});

Deno.test("serves same path with html ext if 404", async () => {
  const req = new Request("http://_/not-nested");
  const res = await app(req, connInfo);
  assertEquals(await res.text(), "not-nested\n");
});

Deno.test("serves /index.html at /", async () => {
  const req = new Request("http://_/");
  const res = await app(req, connInfo);
  assertEquals(await res.text(), "index\n");
});

Deno.test("serves /nested/index.html at /nested/", async () => {
  const req = new Request("http://_/nested/");
  const res = await app(req, connInfo);
  assertEquals(await res.text(), "nested\n");
});

Deno.test("redirects from /nested to /nested/", async () => {
  const req = new Request("http://_/nested");
  const res = await app(req, connInfo);
  assertEquals(res.status, 302);
  assertEquals(res.headers.get("location"), "http://_/nested/");
});

Deno.test("redirects from /not-nested/ to /not-nested", async () => {
  const req = new Request("http://_/not-nested/");
  const res = await app(req, connInfo);
  assertEquals(res.status, 302);
  assertEquals(res.headers.get("location"), "http://_/not-nested");
});

Deno.test("404 when file not found", async () => {
  const req = new Request("http://_/not-found");
  await assertRejects(
    async () => await app(req, connInfo),
    Deno.errors.NotFound,
  );
});

Deno.test("works inside a router", async () => {
  const app2 = router({ "*": app });
  const req = new Request("http://_/");
  const res = await app2(req, connInfo);
  assertEquals(await res.text(), "index\n");
});

Deno.test(
  "404 for requests to files that start with an underscore",
  async () => {
    const req = new Request("http://_/_hidden.txt");
    await assertRejects(
      async () => await app(req, connInfo),
      Deno.errors.NotFound,
    );
  },
);

Deno.test(
  "404 for requests to files that start with a period",
  async () => {
    const req = new Request("http://_/.hidden.txt");
    await assertRejects(
      async () => await app(req, connInfo),
      Deno.errors.NotFound,
    );
  },
);
