# AGENTS.md

This repository is a Korean backend interview guide organized as Markdown content under `database/`, `cloud/`, `programming/`, and `system-design/`.

`.codex/` may point to `.claude/`. Treat them as the same local guidance set for this project.

## Project Rules

- Preserve the existing category structure and Markdown style.
- Keep each category `README.md` as the index for documents in that directory.
- Do not add broken links to README files. If a topic is not written yet, list it as planned instead of linking a missing file.
- Every content `.md` file must start with YAML front matter (`title`, `description`, `parent`, `nav_order`). Category READMEs additionally require `has_children`, `has_toc`, and `permalink`. See `style-guide.md` for the full template.
- Prefer the repo-local checker at `scripts/check_markdown_links.py` after markdown edits that touch headings, anchors, or links.

## Writing Tips

- Keep guide tone direct and instructional. Prefer "how to explain this in an interview" over review-style wording such as "부정확합니다", "위험합니다", or "곤란합니다".
- Keep product and technology names in their canonical form: `MongoDB`, `Redis`, `Kubernetes`, `JavaScript`, `Go`, `gRPC`. Use Korean + English pairing mainly for general concepts such as `캐싱 (Caching)` or `서비스 메시 (Service Mesh)`.
- Avoid overly translated product names such as `몽고DB` or `레디스` unless the project already uses that form consistently.
- When softening absolute claims, rewrite the sentence as guidance instead of meta commentary. Prefer "워크로드와 구성에 따라 달라진다" over "그 설명은 틀릴 수 있다".
- Favor natural Korean over leftover English phrasing in body text. Replace fragments like `lightweight mechanism` with a Korean explanation unless the English term itself is the concept being taught.
- When researching factual claims, prefer official documentation first. For behavior, guarantees, pricing, limits, or architecture details that may drift over time, verify with primary sources and add footnotes in `## 참고 자료`.
- Use citations selectively for the parts that actually need verification. General explanation does not need a footnote on every sentence, but corrected or potentially contentious claims should be traceable to an official source.

## Dynamic Discovery

Agents and skills must not hardcode category names (`database`, `cloud`, etc.). Instead, discover the project structure at runtime:
1. Read root `README.md` → extract category directory links from `## 목차`
2. Read each category `README.md` → extract document lists
3. Use `Glob("*/README.md")` to find category directories (exclude `.claude/`, `_workspace/`, `scripts/`)

This ensures the harness works correctly when categories are added, renamed, or removed.

When scanning multiple documents (listing, comparing, or validating), read only the front matter first (`Read` with `limit: 10`) instead of loading entire files. Full reads are only needed when reviewing or editing the body content.

## Category Boundary Rules

- Do not reorganize directories only because similar keywords appear in multiple categories.
- Keep overlapping topics when the interview angle is different, and make that angle explicit near the top of the document.
- Treat `system-design/` as the design-decision layer: why, when, and what tradeoff to choose.
- Treat `database/`, `cloud/`, and other domain categories as the implementation/operations layer: how to build it, what to operate, and what can go wrong.
- When two documents touch the same keyword across categories, add cross-links so they read as a depth hierarchy rather than duplicate content.
- Only consider merging or restructuring when the body content substantially overlaps, not just because the title or keyword is similar.

## Skill Routing

- `interview-guide`: use for multi-step content work or broad repo-wide review.
- `content-generation`: use for writing a new document or expanding an existing one.
- `content-review`: use for technical accuracy, interview quality, and style review.
- `consistency-check`: use for README/index cleanup, broken links, and structure checks.

After any markdown edit that touches headings, anchors, or links, run `python scripts/check_markdown_links.py` to verify structural integrity.
