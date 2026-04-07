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

EXCLUDE_DIRS = {".claude", "_workspace", "scripts", "node_modules", ".git", ".codex"}


def slugify(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("`", "")
    text = re.sub(r"[*_]", "", text)
    text = re.sub(r"[!?.,:/()]+", "", text)
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text


def strip_front_matter(text: str) -> tuple[list[str], int]:
    """Return (lines, skip_count) with front matter lines excluded.

    skip_count is the number of lines occupied by front matter (including
    both ``---`` delimiters) so that callers can adjust line numbers.
    """
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return lines, 0

    for i, line in enumerate(lines[1:], 1):
        if line.strip() == "---":
            return lines[i + 1 :], i + 1

    return lines, 0


def discover_content_dirs(root: Path) -> list[str]:
    """Discover category directories dynamically instead of hardcoding."""
    dirs: list[str] = []
    for child in sorted(root.iterdir()):
        if not child.is_dir():
            continue
        if child.name in EXCLUDE_DIRS or child.name.startswith("."):
            continue
        if any(child.glob("*.md")):
            dirs.append(child.name)
    return dirs


def collect_targets(root: Path, paths: list[str]) -> list[Path]:
    targets: list[Path] = []
    for raw in paths:
        path = (root / raw).resolve()
        if path.is_file():
            targets.append(path)
        elif path.is_dir():
            targets.extend(sorted(path.rglob("*.md")))
    return targets


def collect_anchors(text: str) -> set[str]:
    anchors: set[str] = set()
    counts: dict[str, int] = {}

    body_lines, _ = strip_front_matter(text)

    for line in body_lines:
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
    return target.startswith(("http://", "https://", "mailto:", "/"))


def check_paths(paths: list[Path]) -> list[str]:
    issues: list[str] = []
    anchor_cache: dict[Path, set[str]] = {}

    def get_anchors(file_path: Path) -> set[str]:
        resolved = file_path.resolve()
        if resolved not in anchor_cache:
            anchor_cache[resolved] = collect_anchors(
                resolved.read_text(encoding="utf-8")
            )
        return anchor_cache[resolved]

    for path in paths:
        text = path.read_text(encoding="utf-8")
        body_lines, skip = strip_front_matter(text)
        anchors = get_anchors(path)

        for lineno, line in enumerate(body_lines, skip + 1):
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

                if ".md" not in target:
                    continue

                parts = target.split("#", 1)
                relative_path = parts[0]
                destination = (path.parent / relative_path).resolve()

                if not destination.exists():
                    issues.append(
                        f"{path}:{lineno}: missing file {target}"
                    )
                elif len(parts) == 2 and parts[1]:
                    dest_anchors = get_anchors(destination)
                    if parts[1] not in dest_anchors:
                        issues.append(
                            f"{path}:{lineno}: missing anchor "
                            f"{relative_path}#{parts[1]}"
                        )

    return issues


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check local markdown links and heading anchors."
    )
    parser.add_argument(
        "paths",
        nargs="*",
        default=None,
        help="Files or directories to scan. Defaults to all content directories.",
    )
    args = parser.parse_args()

    root = Path.cwd()

    if args.paths:
        scan_paths = args.paths
    else:
        scan_paths = discover_content_dirs(root)
        # Always include top-level markdown files
        for md in sorted(root.glob("*.md")):
            scan_paths.append(md.name)

    paths = collect_targets(root, scan_paths)
    issues = check_paths(paths)

    if issues:
        print("\n".join(issues))
        return 1

    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
