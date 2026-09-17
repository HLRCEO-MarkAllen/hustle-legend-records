#!/usr/bin/env python3
"""Prepare low-bitrate HLR Radio derivatives from the private B2BAL customer ZIP.

This tool is intentionally local/private. It never uploads source files and it never
writes into the public repository unless the operator explicitly copies its output.
The customer ZIP and masters must remain private.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

TRACKS = [
    (1, "5 Years Later…", "5-years-later"),
    (2, "Karma", "karma"),
    (3, "Rare Breed", "rare-breed"),
    (4, "Hood Fam", "hood-fam"),
    (5, "Blacked Out Memories", "blacked-out-memories"),
    (6, "Bite My Tongue", "bite-my-tongue"),
    (7, "Got a Problem", "got-a-problem"),
    (8, "Deja Vu", "deja-vu"),
    (9, "Loser", "loser"),
    (10, "King Cobra", "king-cobra"),
    (11, "Kiss My Ass", "kiss-my-ass"),
    (12, "All Alone", "all-alone"),
    (13, "Rowdy", "rowdy"),
    (14, "Started This War", "started-this-war"),
    (15, "Told U", "told-u"),
    (16, "My Angel", "my-angel"),
    (17, "Dreams", "dreams"),
    (18, "Who I Am", "who-i-am"),
    (19, "Truth Bomb", "truth-bomb"),
    (20, "S.O.S.", "sos"),
]


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def pick_source(files: list[Path], position: int, title: str) -> Path:
    pos = f"{position:02d}"
    title_key = norm(title)
    ranked = []
    for f in files:
        stem = f.stem
        key = norm(stem)
        score = 0
        if re.search(rf"(^|\D){position}(\D|$)", stem):
            score += 3
        if stem.startswith(pos):
            score += 4
        if title_key and title_key in key:
            score += 8
        ranked.append((score, f))
    ranked.sort(key=lambda x: (x[0], x[1].name), reverse=True)
    if not ranked or ranked[0][0] <= 0:
        raise RuntimeError(f"Could not confidently match track {position}: {title}")
    return ranked[0][1]


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("archive", type=Path, help="Private HLR_Born_2_Be_A_Legend_Digital_Download.zip")
    p.add_argument("output", type=Path, help="Private output directory for radio derivatives")
    p.add_argument("--bitrate", default="96k", help="MP3 bitrate for radio copies (default: 96k)")
    args = p.parse_args()

    if not args.archive.is_file():
        raise SystemExit(f"Archive not found: {args.archive}")
    if not ffmpeg_available():
        raise SystemExit("ffmpeg is required but was not found on PATH")

    args.output.mkdir(parents=True, exist_ok=True)
    manifest = []
    with tempfile.TemporaryDirectory(prefix="hlr-radio-") as td:
        tmp = Path(td)
        with zipfile.ZipFile(args.archive) as zf:
            zf.extractall(tmp)
        audio = [p for p in tmp.rglob("*") if p.suffix.lower() in {".mp3", ".wav", ".flac", ".m4a", ".aiff", ".aif"}]
        if len(audio) < 20:
            raise SystemExit(f"Expected at least 20 audio files, found {len(audio)}")

        used: set[Path] = set()
        for position, title, slug in TRACKS:
            src = pick_source([f for f in audio if f not in used], position, title)
            used.add(src)
            out = args.output / f"{position:02d}-{slug}.mp3"
            subprocess.run([
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                "-i", str(src), "-vn", "-codec:a", "libmp3lame", "-b:a", args.bitrate,
                "-map_metadata", "-1", str(out)
            ], check=True)
            manifest.append({"position": position, "title": title, "slug": slug, "file": out.name, "source": src.name})
            print(f"{position:02d}. {title} <- {src.name} -> {out.name}")

    (args.output / "radio-media-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Prepared {len(manifest)} radio-safe derivatives in {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
