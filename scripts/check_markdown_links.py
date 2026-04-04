#!/usr/bin/env python3
"""Check local markdown links and heading anchors in this repository."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


LINK_RE = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")
ID_RE = re.compile(r'<a\s+id="([^"]+)"\s*></a>')


def slugify(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("`", "")
    text = re.sub(r"[!?.,:/()]+", "", text)
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text


def collect_targets(root: Path, paths: list[str]) -> list[Path]:
    targets: list[Path] = []
    for raw in paths:
        path = (root / raw).resolve()
        if path.is_file():
            targets.append(path)
        elif path.is_dir():
            targets.extend(sorted(path.rglob("*.md")))
    return targets


def collect_anchors(path: Path) -> set[str]:
    anchors: set[str] = set()
    counts: dict[str, int] = {}

    for line in path.read_text(encoding="utf-8").splitlines():
        heading_match = HEADING_RE.match(line)
        if heading_match:
            slug = slugify(heading_match.group(2).strip())
            if slug:
                index = counts.get(slug, 0)
                counts[slug] = index + 1
                anchors.add(slug if index == 0 else f"{slug}-{index}")

        for anchor_match in ID_RE.finditer(line):
            anchors.add(anchor_match.group(1))

    return anchors


def should_skip_target(target: str) -> bool:
    return target.startswith(("http://", "https://", "mailto:", "/Users/"))


def check_paths(paths: list[Path]) -> list[str]:
    issues: list[str] = []

    for path in paths:
        text = path.read_text(encoding="utf-8")
        anchors = collect_anchors(path)

        for lineno, line in enumerate(text.splitlines(), 1):
            for target in LINK_RE.findall(line):
                if should_skip_target(target):
                    continue

                if target.startswith("#"):
                    anchor = target[1:]
                    if anchor and anchor not in anchors:
                        issues.append(
                            f"{path}:{lineno}: missing anchor {target}"
                        )
                    continue

                if ".md" in target:
                    relative_path = target.split("#", 1)[0]
                    destination = (path.parent / relative_path).resolve()
                    if not destination.exists():
                        issues.append(
                            f"{path}:{lineno}: missing file {target}"
                        )

    return issues


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check local markdown links and heading anchors."
    )
    parser.add_argument(
        "paths",
        nargs="*",
        default=["README.md", "AGENTS.md", "cloud", "database", "programming", "system-design"],
        help="Files or directories to scan. Defaults to repo markdown content.",
    )
    args = parser.parse_args()

    root = Path.cwd()
    paths = collect_targets(root, args.paths)
    issues = check_paths(paths)

    if issues:
        print("\n".join(issues))
        return 1

    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
