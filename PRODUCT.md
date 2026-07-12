# excalidraw-tui

Run the **real** Excalidraw inside your terminal, and open a `.excalidraw`
file straight from the CLI with edits auto-saved back to that file.

Not a viewer and not a reimplementation — it's the genuine Excalidraw web app,
rendered to the terminal by [Carbonyl](https://github.com/fathyb/carbonyl)
(Chromium in a terminal). All the hard parts — the canvas, tools, rendering —
are borrowed.

## Usage

```sh
npm install          # one-time: pulls the Carbonyl (Chromium) binary
./excli drawing.excalidraw
```

Opens `drawing.excalidraw` in Excalidraw in your terminal. Draw with the
mouse; edits save back to the file automatically (~500ms after you stop).
A path that doesn't exist yet starts a blank canvas and is created on first
save.

## How it works

```
excli file.excalidraw
  └─ server.py (127.0.0.1:PORT, bound to file.excalidraw)
       GET /        → index.html
       GET /scene   → file.excalidraw JSON  (null if new/empty → blank canvas)
       POST /scene  → write file.excalidraw
  └─ carbonyl http://127.0.0.1:PORT/
       └─ index.html loads Excalidraw from esm.sh
            initialData ← GET /scene
            onChange (debounced 500ms) → POST /scene  (Excalidraw's own serializer)
```

Four files: `excli` (wrapper), `server.py` (stdlib server + autosave),
`index.html` (Excalidraw host page), `test_server.py`. Excalidraw and React
load from the esm.sh CDN, so the only npm dependency is Carbonyl.

## Requirements

- macOS arm64 or Linux (Carbonyl ships native binaries per platform)
- Python 3
- Internet (Excalidraw/React load from esm.sh)

## Known limits

- **Autosave debounce:** a hard kill can drop the last <500ms of edits.
  Upgrade path: flush on exit.
- **Keyboard shortcuts:** Carbonyl forwards most but not all of Excalidraw's
  shortcuts. Upgrade path: a keymap shim.
- **Offline:** not supported (CDN). Upgrade path: vendor a bundled Excalidraw.

## Status

v0.1 — works end to end: open, edit, autosave. Server round-trip and the
"malformed POST can't corrupt the file" guard are covered by `test_server.py`.
