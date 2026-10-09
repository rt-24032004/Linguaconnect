"""Build index.html: the app plus the shim that lets it run without a server.

Run from anywhere:  python tools/build-standalone.py
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
APP = os.path.join(ROOT, "src", "app.html")
SHIM = os.path.join(ROOT, "src", "standalone-shim.js")
OUT = os.path.join(ROOT, "index.html")
ANCHOR = "<script>\n(function(){\n'use strict';"

app = open(APP, encoding="utf8").read()
shim = open(SHIM, encoding="utf8").read()
if app.count(ANCHOR) != 1:
    raise SystemExit("could not find the app's opening script tag in src/app.html")

out = app.replace(ANCHOR, "<script>\n" + shim + "</script>\n" + ANCHOR, 1)
open(OUT, "w", encoding="utf8").write(out)
print("wrote %s (%d bytes)" % (OUT, len(out)))
