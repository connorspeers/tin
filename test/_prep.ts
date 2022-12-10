import { fromFileUrl } from "../deps.ts";
import { assertEquals, assertRejects } from "./test_deps.ts";
import { prep, stopPrep } from "../prep.ts";

const o1 = fromFileUrl(import.meta.resolve("./public/bundle1.ts.js"));
const o2 = fromFileUrl(import.meta.resolve("./public/bundle2.ts.js"));
const o3 = fromFileUrl(import.meta.resolve("./public/nested/bundle3.ts.js"));
// These two shouldn't exist
const o4 = fromFileUrl(import.meta.resolve("./public/_bundle4.ts.js"));
const o5 = fromFileUrl(import.meta.resolve("./public/.bundle5.ts.js"));

async function clean() {
  await Deno.remove(o1);
  await Deno.remove(o2);
  await Deno.remove(o3);
}

export async function prepTest() {
  await prep(import.meta.resolve("./public"));
  const r1 = await Deno.readTextFile(o1);
  const r2 = await Deno.readTextFile(o2);
  const r3 = await Deno.readTextFile(o3);
  await clean();
  const answer = "//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IiJ9\n";
  assertEquals(r1, answer);
  assertEquals(r2, answer);
  assertEquals(r3, answer);
  await assertRejects(() => Deno.stat(o4));
  await assertRejects(() => Deno.stat(o5));
}

export async function prepWatchTest() {
  const p = import.meta.resolve("./public");
  const i = fromFileUrl(import.meta.resolve("./public/nested/bundle3.ts"));
  const o = fromFileUrl(import.meta.resolve("./public/nested/bundle3.ts.js"));
  await Deno.writeTextFile(i, "export {};\n");
  await prep(p, { watch: true });
  await Deno.writeTextFile(i, "alert('hi')");
  await new Promise(r => setTimeout(r, 1000));
  const r = await Deno.readTextFile(o);
  await Deno.writeTextFile(i, "export {};\n");
  await clean();
  stopPrep();
  assertEquals(r, "alert('hi');\n//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vVXNlcnMvY29ubm9yL0Rlc2t0b3AvZ2l0L3Rpbi90ZXN0L3B1YmxpYy9uZXN0ZWQvYnVuZGxlMy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJhbGVydCgnaGknKSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxNQUFNIn0=\n");
}
