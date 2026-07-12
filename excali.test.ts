// Smallest check on the part we wrote: the scene + config round-trips and the
// guard that a malformed POST can't corrupt the file. Excalidraw itself loads
// from a CDN in a real browser, so it's out of scope here.
//
// Run: bun test

import { test, expect } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const dir = mkdtempSync(join(tmpdir(), "excali-"));
process.env.EXCALI_CONFIG = join(dir, "config.json");

const { serve } = await import("./excali.ts");

test("scene + config round-trip and corruption guard", async () => {
  const file = join(dir, "drawing.excalidraw");
  writeFileSync(file, JSON.stringify({ type: "excalidraw", elements: [{ id: "a" }] }));

  const server = serve(file);
  const base = `http://127.0.0.1:${server.port}`;
  const readFile = () => JSON.parse(readFileSync(file, "utf8"));

  // GET /scene returns the file's current content.
  let r = await fetch(`${base}/scene`);
  expect((await r.json()).elements[0].id).toBe("a");

  // POST /scene writes valid JSON back to the file.
  r = await fetch(`${base}/scene`, { method: "POST", body: JSON.stringify({ elements: [{ id: "b" }] }) });
  expect(r.status).toBe(200);
  expect(readFile().elements[0].id).toBe("b");

  // A malformed POST is rejected and leaves the file untouched.
  r = await fetch(`${base}/scene`, { method: "POST", body: "}{ not json" });
  expect(r.status).toBe(400);
  expect(readFile().elements[0].id).toBe("b");

  // Global config: empty before anything is saved, round-trips after.
  r = await fetch(`${base}/config`);
  expect(await r.json()).toEqual({});
  r = await fetch(`${base}/config`, { method: "POST", body: JSON.stringify({ prefs: { theme: "dark" } }) });
  expect(r.status).toBe(200);
  r = await fetch(`${base}/config`);
  expect((await r.json()).prefs.theme).toBe("dark");

  server.stop(true);
});
