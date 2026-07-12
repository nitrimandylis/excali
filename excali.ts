#!/usr/bin/env bun
// excali <file.excalidraw> — open a drawing in the real Excalidraw, autosaving
// to the file. This one script is both the CLI and the local server: it serves
// the host page, streams the drawing + global config to it, and writes edits
// back. The drawing opens in your browser; this terminal is the autosave server.

import { mkdir, rename } from "fs/promises";
import { homedir } from "os";
import { dirname, join } from "path";
// Embed the host page into the script so `bun build --compile` bundles it into
// the standalone binary (there's no index.html on disk next to a compiled exe).
// `type: "text"` serves it verbatim — do NOT let Bun's HTML loader bundle it,
// since it loads Excalidraw from a CDN via an import map.
import indexHtml from "./index.html" with { type: "text" };

// Global config (theme, prefs, library) — shared across every drawing.
// Overridable via EXCALIDRAW_TUI_CONFIG (used by the test).
function configPath(): string {
  const override = process.env.EXCALIDRAW_TUI_CONFIG;
  if (override) return override;
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "excalidraw-tui", "config.json");
}

// File contents, or `fallback` for a missing/empty file.
async function readOr(path: string, fallback: string): Promise<string> {
  const f = Bun.file(path);
  if ((await f.exists()) && f.size > 0) return f.text();
  return fallback;
}

// Validate JSON before writing so a malformed POST can't corrupt the file, then
// write to a temp file and rename over the target so a crash never leaves a
// half-written file.
async function writeJson(path: string, body: string): Promise<boolean> {
  try {
    JSON.parse(body);
  } catch {
    return false;
  }
  await mkdir(dirname(path), { recursive: true });
  const tmp = path + ".tmp";
  await Bun.write(tmp, body);
  await rename(tmp, path);
  return true;
}

function json(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function save(path: string, req: Request): Promise<Response> {
  const ok = await writeJson(path, await req.text());
  return ok ? json('{"ok":true}') : json('{"error":"invalid json"}', 400);
}

// Start the server bound to one drawing file. Exported so the test can drive it.
export function serve(file: string) {
  return Bun.serve({
    hostname: "127.0.0.1",
    port: 0, // OS picks a free port
    async fetch(req) {
      const path = new URL(req.url).pathname;
      if (req.method === "GET") {
        if (path === "/")
          return new Response(indexHtml, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        if (path === "/scene") return json(await readOr(file, "null"));
        if (path === "/config") return json(await readOr(configPath(), "{}"));
      }
      if (req.method === "POST") {
        if (path === "/scene") return save(file, req);
        if (path === "/config") return save(configPath(), req);
      }
      return new Response("not found", { status: 404 });
    },
  });
}

const USAGE = `excali — open a .excalidraw file in the real Excalidraw, autosaving to the file.

Usage:
  excali <file.excalidraw>   Open in your browser; edits autosave to the file.
  excali -h | --help         Show this help.

Notes:
  - A path that doesn't exist yet starts a blank canvas, created on first save.
  - Edits autosave ~500ms after you stop drawing.
  - This terminal stays running as the autosave server; leave it open while
    editing and press Ctrl-C when done.
  - Theme, prefs, and libraries persist in ~/.config/excalidraw-tui/config.json.
`;

if (import.meta.main) {
  const arg = process.argv[2];
  if (arg === "-h" || arg === "--help") {
    console.log(USAGE);
    process.exit(0);
  }
  if (!arg) {
    console.error(USAGE);
    process.exit(1);
  }

  // New file -> create it empty so the path resolves; the host page serves a
  // blank canvas for an empty file and the first save writes real content.
  if (!(await Bun.file(arg).exists())) await Bun.write(arg, "");

  const server = serve(arg);
  const url = `http://127.0.0.1:${server.port}/`;
  // EXCALI_NO_OPEN skips launching the browser (headless / testing).
  if (!process.env.EXCALI_NO_OPEN) {
    const opener = process.platform === "darwin" ? "open" : "xdg-open";
    Bun.spawn([opener, url]);
  }

  console.log(`Excalidraw is open in your browser — edits autosave to ${arg}`);
  console.log("Press Ctrl-C here to stop.");
  // The running server keeps this process alive until Ctrl-C.
}
