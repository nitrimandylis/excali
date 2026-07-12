#!/usr/bin/env python3
"""Serve the excalidraw-tui host page and autosave the one file it's bound to.

Usage: server.py <file.excalidraw> [port]

Binds to 127.0.0.1. With no port (or 0) the OS picks a free one, which is
printed on the first stdout line so the `excali` wrapper knows where Carbonyl
should connect. Localhost-only, single file, no auth.
"""

import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
INDEX = HERE / "index.html"


def config_path():
    """Global config file (theme, prefs, library) — shared across all drawings.
    Overridable via EXCALIDRAW_TUI_CONFIG (used by the test)."""
    override = os.environ.get("EXCALIDRAW_TUI_CONFIG")
    if override:
        return Path(override)
    base = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    return base / "excalidraw-tui" / "config.json"


def make_handler(scene_path):
    class Handler(BaseHTTPRequestHandler):
        def _send(self, code, body=b"", ctype="application/json"):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _read_json(self, path, empty):
            # Serve file contents, or `empty` for a missing/empty file.
            if path.exists() and path.stat().st_size > 0:
                self._send(200, path.read_bytes())
            else:
                self._send(200, empty)

        def _write_json(self, path):
            length = int(self.headers.get("Content-Length", 0))
            data = self.rfile.read(length)
            # Validate before writing so a malformed POST can't corrupt the file.
            try:
                json.loads(data)
            except ValueError:
                self._send(400, b'{"error":"invalid json"}')
                return
            # Write to a temp file then atomically replace, so a crash mid-write
            # never leaves a half-written file.
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.parent / (path.name + ".tmp")
            tmp.write_bytes(data)
            tmp.replace(path)
            self._send(200, b'{"ok":true}')

        def do_GET(self):
            if self.path == "/":
                self._send(200, INDEX.read_bytes(), "text/html; charset=utf-8")
            elif self.path == "/scene":
                # `null` -> host page opens a blank canvas.
                self._read_json(scene_path, b"null")
            elif self.path == "/config":
                # `{}` -> host page uses defaults.
                self._read_json(config_path(), b"{}")
            else:
                self._send(404, b"not found", "text/plain")

        def do_POST(self):
            if self.path == "/scene":
                self._write_json(scene_path)
            elif self.path == "/config":
                self._write_json(config_path())
            else:
                self._send(404, b"not found", "text/plain")

        def log_message(self, *args):  # ponytail: quiet, shares the terminal with Carbonyl
            pass

    return Handler


def main():
    if len(sys.argv) < 2:
        print("usage: server.py <file.excalidraw> [port]", file=sys.stderr)
        sys.exit(1)
    scene_path = Path(sys.argv[1]).resolve()
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 0

    httpd = ThreadingHTTPServer(("127.0.0.1", port), make_handler(scene_path))
    print(httpd.server_address[1], flush=True)  # tell the wrapper the real port
    httpd.serve_forever()


if __name__ == "__main__":
    main()
