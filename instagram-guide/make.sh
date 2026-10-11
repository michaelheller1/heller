#!/usr/bin/env bash
# Build the guide: render once with placeholder TOC page numbers, read the real
# page of every chapter from that render, then rebuild with the numbers filled in.
set -euo pipefail
cd "$(dirname "$0")"
OUT=Instagram_Marketing_Guide_HE.docx
TMP=$(mktemp -d)
SOFFICE=${SOFFICE:-soffice}

node build.js "$TMP/pass1.docx"
python3 finalize_toc.py "$TMP/pass1.docx"
"$SOFFICE" --headless --convert-to pdf --outdir "$TMP" "$TMP/pass1.docx" >/dev/null

node build.js "$OUT"
python3 finalize_toc.py "$OUT" "$TMP/pass1.pdf"
rm -rf "$TMP"
