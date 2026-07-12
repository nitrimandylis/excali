#!/usr/bin/env bash
# Compile excali to a standalone binary in ~/.bun/bin and install its man page.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"

# 1. Standalone binary (index.html is embedded, so it's fully self-contained).
bindir="$HOME/.bun/bin"
mkdir -p "$bindir"
bun build "$here/excali.ts" --compile --outfile "$bindir/excali"

# 2. Man page -> the brew manpath (first entry containing 'brew', else the
#    Homebrew default). `manpath` reflects your actual man search path.
mandir="$(manpath 2>/dev/null | tr ':' '\n' | grep -m1 brew || echo /opt/homebrew/share/man)/man1"
mkdir -p "$mandir"
cp "$here/excali.1" "$mandir/excali.1"

echo "installed binary:   $bindir/excali"
echo "installed man page: $mandir/excali.1"
echo "try:  excali -h   and   man excali"
