#!/usr/bin/env python3
"""
Generate content-index.json by scanning markdown/ and html/.

Rules:
- Base name is filename without extension and without a trailing _<number> version suffix.
- Version is parsed from trailing _<number> before extension; default 1 if missing.
- Title/grade/subject are read from Markdown front matter if available.
- Each HTML variant becomes its own manifest item; items carry arrays of all md/html variants.

Usage:
  python3 scripts/generate_manifest.py

This updates content-index.json in the project root. Commit and push to GitHub Pages.
GitHub Pages then serves the static JSON; no runtime scanning is needed.
"""
from __future__ import annotations
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML_DIR = ROOT / 'html'
MD_DIR = ROOT / 'markdown'
OUT = ROOT / 'content-index.json'

version_re = re.compile(r"_(\d+)$")


def base_and_version(stem: str) -> tuple[str, int]:
    m = version_re.search(stem)
    if m:
        base = stem[: m.start()]
        ver = int(m.group(1))
    else:
        base = stem
        ver = 1
    return base, ver


def parse_frontmatter(md_path: Path) -> dict:
    try:
        text = md_path.read_text(encoding='utf-8', errors='ignore')
    except Exception:
        return {}
    if not text.startswith('---'):
        return {}
    try:
        end = text.find('\n---', 3)
        if end == -1:
            return {}
        block = text[3:end].strip().splitlines()
    except Exception:
        return {}
    data = {}
    for line in block:
        if ':' in line:
            k, v = line.split(':', 1)
            data[k.strip().lower()] = v.strip()
    return data


def titleize(s: str) -> str:
    return ' '.join(w.capitalize() for w in re.sub(r"[_-]+", ' ', s).split())


def guess_grade_from_name(stem: str) -> str:
    name = stem.lower()
    # Kindergarten synonyms
    if any(k in name for k in ["kindergarten", "kindie", "kinder", "kg"]):
        return "K"
    # Patterns like 'grade 5', 'grade5', 'Grade12'
    m = re.search(r"\bgrade\s*([k]|1[0-2]|[1-9])", name, flags=re.I)
    if m:
        g = m.group(1).upper()
        return "K" if g == "K" else g
    return ""


def main() -> None:
    bases: dict[str, dict] = {}

    # Collect markdown variants
    if MD_DIR.exists():
        for md in sorted(MD_DIR.glob('*.md')):
            stem = md.stem
            base, ver = base_and_version(stem)
            entry = bases.setdefault(base, {"mds": [], "htmls": []})
            entry["mds"].append((ver, f"markdown/{md.name}"))

    # Collect html variants
    if HTML_DIR.exists():
        for h in sorted(HTML_DIR.glob('*.html')):
            stem = h.stem
            base, ver = base_and_version(stem)
            entry = bases.setdefault(base, {"mds": [], "htmls": []})
            entry["htmls"].append((ver, f"html/{h.name}"))

    items = []
    for base, entry in sorted(bases.items()):
        mds = sorted(entry.get("mds", []), key=lambda x: x[0])
        htmls = sorted(entry.get("htmls", []), key=lambda x: x[0])
        md_paths = [p for _, p in mds]
        html_paths = [p for _, p in htmls]

        # Metadata from first markdown variant if present, otherwise guess from filename
        title = titleize(base)
        grade = ""
        subject = ""
        if mds:
            fm = parse_frontmatter(ROOT / md_paths[0])
            title = fm.get('title', title) or title
            grade = str(fm.get('grade', '')).strip()
            subject = str(fm.get('subject', '')).strip().lower()
        if not grade:
            # Try to infer grade from filename base
            grade = guess_grade_from_name(base)

        for ver, html_path in htmls:
            item = {
                "id": base,
                "title": title,
                "grade": grade,
                "subject": subject,
                "markdown": md_paths[0] if md_paths else None,
                "html": html_path,
                "file": base,
                "version": ver,
                "markdownVariants": md_paths,
                "htmlVariants": html_paths,
            }
            items.append(item)

    data = {"items": items}
    OUT.write_text(json.dumps(data, indent=2), encoding='utf-8')
    print(f"Wrote {OUT} with {len(items)} items.")


if __name__ == '__main__':
    main()
