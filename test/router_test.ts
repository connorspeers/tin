// Copyright 2022 Connor Speers. All rights reserved. MIT License.

import { assertEquals, assertRejects } from "./test_deps.ts";
import { router } from "../router.ts";
import type { ConnInfo } from "../deps.ts";

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

Deno.test("404 (no routes)", async () => {
  const req = new Request("http://_/not-found");
  await assertRejects(
    async () => await router({})(req, connInfo),
    Deno.errors.NotFound,
  );
});

Deno.test("inferred index with trailing slash", async () => {
  const testRouter = router({
    "test/*": router({
      "index": () => new Response("yep"),
    }),
  });

  const req = new Request("http://_/test/");
  const res = await testRouter(req, connInfo);
  assertEquals(await res.text(), "yep");
});

Deno.test("inferred index for root path", async () => {
  const testRouter = router({
    "index": () => new Response("yep"),
  });

  const req = new Request("http://_/");
  const res = await testRouter(req, connInfo);
  assertEquals(await res.text(), "yep");
});

Deno.test("empty route when whole path consumed", async () => {
  const testRouter = router({
    "a/*": router({
      "b/*": router({
        "": () => new Response("yep"),
      }),
    }),
  });

  const req = new Request("http://_/a/b");
  const res = await testRouter(req, connInfo);
  assertEquals(await res.text(), "yep");
});

Deno.test("empty route !== index route for nested routers", async () => {
  const testRouter = router({
    "test/*": router({
      "": () => new Response("empty"),
      "index": () => new Response("index"),
    }),
  });

  const req = new Request("http://_/test/");
  const res = await testRouter(req, connInfo);
  assertEquals(await res.text(), "index");

  const req2 = new Request("http://_/test");
  const res2 = await testRouter(req2, connInfo);
  assertEquals(await res2.text(), "empty");
});

Deno.test(
  "empty route NOT checked when trailing slash and not root",
  async () => {
    const testRouter = router({
      "nested": router({
        "": () => new Response("bad"),
      }),
    });

    const req = new Request("http://_/nested/");
    await assertRejects(
      () => testRouter(req, connInfo),
      Deno.errors.NotFound,
    );
  },
);

Deno.test("empty route IS checked when root path", async () => {
  const testRouter = router({
    "": () => new Response("yep"),
  });

  const req = new Request("http://_/");
  const res = await testRouter(req, connInfo);
  assertEquals(await res.text(), "yep");
});

Deno.test("empty route checked after index route for root", async () => {
  const testRouter = router({
    "": () => new Response("empty"),
    "index": () => new Response("index"),
  });

  const req = new Request("http://_");
  const res = await testRouter(req, connInfo);
  assertEquals(await res.text(), "index");
});

Deno.test("static > dynamic > wildcard", async () => {
  const testRouter = router({
    ":a": (_, context) => new Response(`one: ${context.params.a}`),
    "*": (_, context) => new Response(`two: ${context.path}`),
    "b": () => new Response("three"),
  });

  const req = new Request("http://_/b");
  const res = await testRouter(req, connInfo);
  assertEquals(await res.text(), "three");

  const req2 = new Request("http://_/a");
  const res2 = await testRouter(req2, connInfo);
  assertEquals(await res2.text(), "one: a");

  const req3 = new Request("http://_/c/d");
  const res3 = await testRouter(req3, connInfo);
  assertEquals(await res3.text(), "two: /c/d");
});

Deno.test("deep paths > shallow paths", async () => {
  const testRouter = router({
    "a/*": () => new Response("one"),
    "a/:b/c": () => new Response("two"),
  });

  const req = new Request("http://_/a/b/c"); // Matches both
  const res = await testRouter(req, connInfo);
  assertEquals(await res.text(), "two");

  const req2 = new Request("http://_/a/b/d"); // Matches one
  const res2 = await testRouter(req2, connInfo);
  assertEquals(await res2.text(), "one");
});

Deno.test("empty route > wildcard", async () => {
  const testRouter = router({
    "test": router({
      "*": () => new Response("one"),
      "": () => new Response("two"),
    }),
  });

  const req = new Request("http://_/test");
  const res = await testRouter(req, connInfo);
  assertEquals(await res.text(), "two");
});

Deno.test(
  "continue matching if no request body + NotFound",
  async () => {
    const testRouter = router({
      "*": () => new Response("one"),
      "a/b/c": () => { throw new Deno.errors.NotFound() },
    });

    const req = new Request("http://_/a/b/c");
    const res = await testRouter(req, connInfo);
    assertEquals(await res.text(), "one");
  },
);

Deno.test(
  "continue matching if request body + NotFound and body not consumed",
  async () => {
    const testRouter = router({
      "*": () => new Response("one"),
      "a/b/c": () => { throw new Deno.errors.NotFound() },
    });

    const req = new Request("http://_/a/b/c", {
      method: "POST",
      body: "hello",
    });
    const res = await testRouter(req, connInfo);
    assertEquals(await res.text(), "one");
  },
);

Deno.test(
  "stop matching if request body + NotFound and body consumed",
  async () => {
    const testRouter = router({
      "*": () => new Response("one"),
      "a/b/c": async (req) => {
        await req.text();
        throw new Deno.errors.NotFound();
      },
    });

    const req = new Request("http://_/a/b/c", {
      method: "POST",
      body: "hello",
    });
    await assertRejects(
      async () => await testRouter(req, connInfo),
      Deno.errors.NotFound,
    );
  },
);

Deno.test(
  "forwarding paths checked after non-forwarding paths",
  async () => {
    const testRouter = router({
      "match/*": () => new Response("one"),
      "match": () => new Response("two"),
    });

    const req = new Request("http://_/match");
    const res = await testRouter(req, connInfo);
    assertEquals(await res.text(), "two");
  },
);

Deno.test("new parameters override old ones", async () => {
  const testRouter = router({
    ":one/:two/*": router({
      ":one/:three": (_, context) => new Response(
        context.params.one + " " +
        context.params.two + " " +
        context.params.three
      ),
    }),
  });

  const req = new Request("http://_/one/two/three/four");
  const res = await testRouter(req, connInfo);
  assertEquals(await res.text(), "three two four");
});

Deno.test("handles percent encoding correctly", async () => {
  const testRouter = router({
    "hello world": () => new Response("yep"),
    "what's%2Fup": () => new Response("mhmm"),
  });

  const req = new Request("http://_/hello%20world");
  const res = await testRouter(req, connInfo);
  assertEquals(await res.text(), "yep");

  const req2 = new Request("http://_/hello world");
  const res2 = await testRouter(req2, connInfo);
  assertEquals(await res2.text(), "yep");

  const req3 = new Request("http://_/what's%2Fup");
  const res3 = await testRouter(req3, connInfo);
  assertEquals(await res3.text(), "mhmm");

  const req4 = new Request("http://_/what's/up");
  assertRejects(() => testRouter(req4, connInfo), Deno.errors.NotFound);
});

Deno.test("unrouted/routed path on context", async () => {
  const testRouter = router({
    "routed/*": router({
      "routed2/*": (_, ctx) => new Response(
        ctx.routedPath + "|" + ctx.path,
      ),
    }),
    "index": (_, ctx) => new Response(ctx.routedPath + "|" + ctx.path),
  });

  const req1 = new Request("http://_/routed/routed2/unrouted");
  const res1 = await testRouter(req1, connInfo);
  assertEquals(await res1.text(), "/routed/routed2|/unrouted");

  const req2 = new Request("http://_/routed/routed2");
  const res2 = await testRouter(req2, connInfo);
  assertEquals(await res2.text(), "/routed/routed2|/");

  const req3 = new Request("http://_/");
  const res3 = await testRouter(req3, connInfo);
  assertEquals(await res3.text(), "/index|/");
});

Deno.test("nested objects become nested routers", async () => {
  const testRouter = router({
    "a/*": {
      "b": () => new Response("yep"),
      "*": () => new Response("yep yep"),
    },
  });

  const req1 = new Request("https://_/a/b");
  const res1 = await testRouter(req1, connInfo);
  assertEquals(await res1.text(), "yep");

  const req2 = new Request("https://_/a/b/c");
  const res2 = await testRouter(req2, connInfo);
  assertEquals(await res2.text(), "yep yep");
});
