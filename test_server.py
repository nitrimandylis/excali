#!/usr/bin/env python3
"""Smallest check on the part we wrote: the autosave round-trip and the guard
that a malformed POST can't corrupt the file. Excalidraw itself loads from a CDN
in a real browser, so it's out of scope here.

Run: python3 test_server.py
"""

import http.client
import json
import tempfile
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path

from server import make_handler

FIXTURE = {
    "type": "excalidraw",
    "version": 2,
    "source": "test",
    "elements": [{"id": "a", "type": "rectangle"}],
    "appState": {"viewBackgroundColor": "#ffffff"},
    "files": {},
}


def run():
    tmp = Path(tempfile.mkdtemp()) / "drawing.excalidraw"
    tmp.write_text(json.dumps(FIXTURE))

    httpd = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(tmp))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    port = httpd.server_address[1]
    conn = http.client.HTTPConnection("127.0.0.1", port)

    # GET /scene returns the file's current content.
    conn.request("GET", "/scene")
    got = json.loads(conn.getresponse().read())
    assert got["elements"][0]["id"] == "a", got

    # POST /scene writes valid JSON back to the original path.
    new = dict(FIXTURE, elements=[{"id": "b", "type": "ellipse"}])
    conn.request("POST", "/scene", body=json.dumps(new),
                 headers={"Content-Type": "application/json"})
    assert conn.getresponse().status == 200
    assert json.loads(tmp.read_text())["elements"][0]["id"] == "b"

    # A malformed POST is rejected and leaves the file untouched.
    conn.request("POST", "/scene", body="}{ not json",
                 headers={"Content-Type": "application/json"})
    assert conn.getresponse().status == 400
    assert json.loads(tmp.read_text())["elements"][0]["id"] == "b", "file was corrupted"

    httpd.shutdown()
    print("ok")


if __name__ == "__main__":
    run()
