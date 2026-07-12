# excalidraw-tui

Open a `.excalidraw` file straight from the terminal in the **real** Excalidraw,
with edits auto-saved back to that file.

Not a viewer and not a reimplementation — it's the genuine Excalidraw web app.
The terminal is the launcher and the autosave server; the drawing itself opens
in your browser (crisp, native trackpad).

There's also a `--tui` mode that renders the app *inside* the terminal via
[Carbonyl](https://github.com/fathyb/carbonyl) (Chromium in a terminal). It
works and needs no browser, but paints at terminal-cell resolution — blocky,
best kept for SSH/headless boxes where no browser is available.

## Usage

```sh
./excli drawing.excalidraw          # opens in your browser (recommended)
./excli --tui drawing.excalidraw    # renders in the terminal (needs: npm install)
```

Draw with the mouse; edits save back to the file automatically (~500ms after
you stop). A path that doesn't exist yet starts a blank canvas and is created
on first save.

In browser mode the terminal stays running as the autosave server — leave it
open while you edit and press **Ctrl-C** when you're done. Only `--tui` needs
`npm install` (for the Carbonyl binary); browser mode needs only Python 3.

## How it works

```
excli file.excalidraw
  └─ server.py (127.0.0.1:PORT, bound to file.excalidraw)
       GET /        → index.html
       GET /scene   → file.excalidraw JSON  (null if new/empty → blank canvas)
       POST /scene  → write file.excalidraw
  └─ browser (default) or carbonyl (--tui) → http://127.0.0.1:PORT/
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

Four files: `excli` (wrapper), `server.py` (stdlib server + autosave),
`index.html` (Excalidraw host page), `test_server.py`. Excalidraw and React
load from the esm.sh CDN, so the only npm dependency is Carbonyl (needed only
for `--tui`).

## Requirements

- Python 3, a browser, internet (Excalidraw/React load from esm.sh)
- `--tui` only: macOS arm64 or Linux (Carbonyl ships native binaries per
  platform), via `npm install`

## Known limits

- **Autosave debounce:** a hard kill can drop the last <500ms of edits.
  Upgrade path: flush on exit.
- **`--tui` resolution:** Carbonyl paints at terminal-cell resolution — blocky,
  and inherent (no image protocol). Browser mode is the crisp path.
- **`--tui` panning:** Carbonyl doesn't reliably forward trackpad scroll to
  Excalidraw's canvas pan. Browser mode has native trackpad.
- **Offline:** not supported (CDN). Upgrade path: vendor a bundled Excalidraw.

## Status

v1 — done. Open, edit, and autosave confirmed working in browser mode. Server
round-trip and the "malformed POST can't corrupt the file" guard are covered by
`test_server.py`.
