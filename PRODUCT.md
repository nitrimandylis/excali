# excalidraw-tui

Open a `.excalidraw` file straight from the terminal in the **real** Excalidraw,
with edits auto-saved back to that file.

Not a viewer and not a reimplementation — it's the genuine Excalidraw web app.
`excali` is a single Bun script that is both the CLI and a small local autosave
server: the drawing opens in your browser (crisp, native trackpad) while the
terminal stays running as the server.

## Install

```sh
./install.sh
```

Compiles a standalone binary to `~/.bun/bin/excali` (the host page is embedded,
so it's self-contained) and installs the man page into your Homebrew manpath.
Then `excali <file>` and `man excali` work from anywhere.

## Usage

```sh
excali drawing.excalidraw       # after install.sh
./excali.ts drawing.excalidraw  # or run straight from source with Bun
```

Set `EXCALI_NO_OPEN=1` to skip launching the browser (headless).

Draw with the mouse; edits save back to the file automatically (~500ms after
you stop). A path that doesn't exist yet starts a blank canvas and is created
on first save.

The terminal stays running as the autosave server — leave it open while you
edit and press **Ctrl-C** when you're done.

## How it works

```
excali file.excalidraw               (one Bun script: CLI + server)
  ├─ Bun.serve (127.0.0.1:PORT, bound to file.excalidraw)
  │    GET /        → index.html
  │    GET /scene   → file.excalidraw JSON  (null if new/empty → blank canvas)
  │    GET /config  → global config JSON    ({} if unset)
  │    POST /scene  → write file.excalidraw
  │    POST /config → write global config
  └─ opens the browser at http://127.0.0.1:PORT/
       └─ index.html loads Excalidraw from esm.sh
            initialData ← GET /scene + GET /config
            onChange       (debounced) → POST /scene   (drawing, per-file)
            onChange/onLib (debounced) → POST /config  (prefs + library, global)
```

## Persistence

- **Per-drawing** → the `.excalidraw` file: the elements you draw.
- **Global** → `~/.config/excalidraw-tui/config.json` (shared across all
  drawings): UI preferences (theme/dark mode, canvas background, zen/view mode,
  grid, snap) and your imported libraries. Global prefs win over whatever a
  drawing was saved with, so your dark mode sticks on every reload.

Which prefs persist is a whitelist (`PREF_KEYS` in `index.html`) — add a key to
keep another setting.

Two code files: `excali.ts` (CLI + server) and `index.html` (Excalidraw host
page), plus `excali.test.ts`. Excalidraw and React load from the esm.sh CDN, so
there are **no dependencies** — just Bun.

## Requirements

- Bun, a browser, internet (Excalidraw/React load from esm.sh)

## Known limits

- **Autosave debounce:** a hard kill can drop the last <500ms of edits.
  Upgrade path: flush on exit.
- **Offline:** not supported (CDN). Upgrade path: vendor a bundled Excalidraw.

## Status

v2 — Bun rewrite: one dependency-free script replaces the old bash + Python +
Carbonyl setup. Open, edit, and autosave confirmed working. Scene + config
round-trips and the "malformed POST can't corrupt the file" guard are covered
by `excali.test.ts` (`bun test`).
