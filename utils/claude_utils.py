#!/usr/bin/env python3
"""
Project-wise Claude conversation extractor.

Usage:
  python extract_project.py --list
  python extract_project.py <partial-project-path> [output-dir]

Examples:
  python extract_project.py --list
  python extract_project.py ai_chatbot ~/claude-exports/
  python extract_project.py frappe-bench-test ~/claude-exports/
"""

import json
import sys
import os
from pathlib import Path
from datetime import datetime

CLAUDE_DIR = Path.home() / ".claude" / "projects"


def get_real_project_path(proj_dir: Path) -> str:
    """
    Read the actual original path from JSONL session data (cwd field),
    instead of trying to decode the lossy encoded directory name.
    Falls back to a best-effort decode if no sessions exist.
    """
    # Search all JSONL files (including agent files as last resort)
    session_files = [f for f, _ in find_session_files(proj_dir)]
    # also grab agent files as absolute last resort
    all_jsonl = session_files or list(proj_dir.rglob("*.jsonl"))

    for jsonl_file in all_jsonl:
        try:
            with open(jsonl_file) as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                        cwd = entry.get("cwd") or entry.get("projectPath")
                        if cwd:
                            return cwd
                        msg = entry.get("message", {})
                        if isinstance(msg, dict):
                            cwd = msg.get("cwd") or msg.get("projectPath")
                            if cwd:
                                return cwd
                    except json.JSONDecodeError:
                        continue
        except Exception:
            continue

    # Fallback: best-effort decode of the encoded dir name.
    # Encoding rules: '/' -> '-', '.' -> '-' (causing '.dir' -> '--dir' double dash)
    # We can't perfectly reverse it, but '--' strongly implies '/.' (hidden dir).
    name = proj_dir.name
    # '--' in encoded name = '/.' in original (e.g. /.claude-worktrees)
    decoded = name.replace("--", "/.")
    # remaining single '-' = '/' separators (but also literal '-' — ambiguous,
    # so we just replace all and note it's approximate)
    decoded = decoded.replace("-", "/")
    return f"~{decoded}  [approx]"


def list_projects(show_empty: bool = False):
    """List all known projects with real paths and session counts."""
    if not CLAUDE_DIR.exists():
        print(f"No Claude projects directory found at: {CLAUDE_DIR}")
        return

    rows = []
    for proj_dir in sorted(CLAUDE_DIR.iterdir()):
        if not proj_dir.is_dir():
            continue
        main_sessions = find_session_files(proj_dir)
        if not show_empty and len(main_sessions) == 0:
            continue  # skip empty/worktree dirs unless --all requested
        real_path = get_real_project_path(proj_dir)
        latest_mtime = max(
            (f.stat().st_mtime for f, _ in main_sessions), default=0
        )
        rows.append((real_path, len(main_sessions), latest_mtime, proj_dir.name))

    rows.sort(key=lambda r: r[2], reverse=True)  # sort by most recent

    print(f"\n{'Real Project Path':<65} {'Sessions':>8}  {'Last Active'}")
    print("-" * 95)
    for real_path, count, mtime, _ in rows:
        last = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d") if mtime else "unknown"
        print(f"{real_path:<65} {count:>8}  {last}")
    print(f"\n  {len(rows)} project(s) listed. Use --all to include empty dirs.\n")


def clean_first_prompt(raw: str) -> str:
    """
    Derive a readable title from firstPrompt (Option A — no API needed).
    Strips file paths, markdown syntax, code fences, and truncates.

    Example:
      "@/home/sanjay/.../useSocket.js continue from **Phase 30**...
       getting below error: ERR_CONNECTION_REFUSED"
      → "continue from Phase 30 - getting below error: ERR_CONNECTION_REFUSED"
    """
    import re
    t = raw.strip()
    # Remove @/path/to/file references
    t = re.sub(r'@\S+', '', t)
    # Remove markdown bold/italic markers
    t = re.sub(r'\*{1,3}(.+?)\*{1,3}', r'\1', t)
    # Remove inline code
    t = re.sub(r'`[^`]*`', '', t)
    # Remove code fences
    t = re.sub(r'```[\s\S]*?```', '', t)
    # Collapse whitespace and newlines
    t = re.sub(r'\s+', ' ', t).strip()
    # Truncate
    if len(t) > 80:
        t = t[:77] + "..."
    return t or "Untitled Session"


def generate_title_via_api(first_prompt: str) -> str:
    """
    Option B — call Claude API to generate a clean 6-word title,
    matching what Claude Desktop shows in the sidebar.
    Requires ANTHROPIC_API_KEY in environment.
    """
    import urllib.request
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return clean_first_prompt(first_prompt)
    payload = json.dumps({
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 30,
        "messages": [{
            "role": "user",
            "content": (
                f"Generate a concise 4-7 word title for a coding session that started with "
                f"this message. Reply with only the title, no punctuation at the end:\n\n{first_prompt[:500]}"
            )
        }]
    }).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
            return result["content"][0]["text"].strip()
    except Exception:
        return clean_first_prompt(first_prompt)


def load_session_titles(proj_dir: Path, generate: bool = False) -> dict:
    """
    Return {session_uuid: title} for all sessions in a project.
    - generate=False (default): cleans up firstPrompt locally, no API cost
    - generate=True: calls Claude API for a proper sidebar-style title
    """
    index_file = proj_dir / "sessions-index.json"
    if not index_file.exists():
        return {}
    try:
        data = json.loads(index_file.read_text())
        titles = {}
        for meta in data.get("entries", []):
            if not isinstance(meta, dict):
                continue
            uuid = meta.get("sessionId") or meta.get("id")
            raw = meta.get("firstPrompt") or meta.get("title") or meta.get("summary") or ""
            if not uuid or not raw:
                continue
            if generate:
                print(f"    Generating title for {uuid[:8]}...", end=" ", flush=True)
                titles[uuid] = generate_title_via_api(raw)
                print(titles[uuid])
            else:
                titles[uuid] = clean_first_prompt(raw)
        return titles
    except Exception:
        return {}


def find_session_files(proj_dir: Path) -> list[tuple[Path, str]]:
    """
    Return list of (jsonl_path, session_uuid) for all main sessions in a project.

    Handles two storage formats Claude Code has used:
      Old format: <project-dir>/<uuid>.jsonl          (flat file)
      New format: <project-dir>/<uuid>/               (subdirectory)
                    the main conversation file is the non-agent .jsonl inside it
    """
    sessions = []

    for item in proj_dir.iterdir():
        # --- Old format: uuid.jsonl directly in project dir ---
        if item.is_file() and item.suffix == ".jsonl" and not item.stem.startswith("agent-"):
            sessions.append((item, item.stem))

        # --- New format: uuid-named subdirectory ---
        elif item.is_dir() and _looks_like_uuid(item.name):
            # Main conversation file sits directly inside the subdir (not under subagents/)
            for candidate in item.iterdir():
                if (candidate.is_file()
                        and candidate.suffix == ".jsonl"
                        and not candidate.stem.startswith("agent-")):
                    sessions.append((candidate, item.name))  # uuid = dir name
                    break  # only one main file per session dir

    sessions.sort(key=lambda t: t[0].stat().st_mtime)
    return sessions


def _looks_like_uuid(name: str) -> bool:
    """Loose check: 8-4-4-4-12 hex groups separated by dashes."""
    parts = name.split("-")
    return (len(parts) == 5
            and all(c in "0123456789abcdefABCDEF" for p in parts for c in p))
    """
    Match project dirs by checking the real path (from cwd in JSONL),
    not the encoded directory name.
    """
    matched = []
    for proj_dir in CLAUDE_DIR.iterdir():
        if not proj_dir.is_dir():
            continue
        real_path = get_real_project_path(proj_dir)
        # Match against the real path
        if project_filter in real_path:
            matched.append((proj_dir, real_path))
    return matched


def extract_project(project_filter: str, output_dir: Path, generate: bool = False):
    """Extract all sessions for projects whose real path matches the filter."""
    output_dir.mkdir(parents=True, exist_ok=True)

    matched = find_matching_projects(project_filter)

    if not matched:
        print(f"\nNo projects found matching: '{project_filter}'")
        print("Run --list to see all available projects.")
        return

    for proj_dir, real_path in matched:
        # Use real path to build a clean output folder name
        safe_name = real_path.strip("/").replace("/", "_")
        proj_output = output_dir / safe_name
        proj_output.mkdir(exist_ok=True)

        session_files = find_session_files(proj_dir)
        titles = load_session_titles(proj_dir, generate=generate)

        print(f"\nProject : {real_path}")
        print(f"Sessions: {len(session_files)}")
        print(f"Output  : {proj_output}")

        for session_file, session_uuid in session_files:
            title = titles.get(session_uuid)
            extract_session(session_file, proj_output, session_uuid=session_uuid, title=title)

    print(f"\nDone. All files saved to: {output_dir}")


def extract_session(session_file: Path, output_dir: Path, session_uuid: str | None = None, title: str | None = None):
    """Convert a single .jsonl session to a clean Markdown file."""
    messages = []
    try:
        with open(session_file) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    role = entry.get("type")
                    content = entry.get("message", {})

                    if role == "user" and isinstance(content, dict) and content.get("role") == "user":
                        text = content.get("content", "")
                        if isinstance(text, list):
                            text = " ".join(
                                p.get("text", "") for p in text
                                if isinstance(p, dict) and p.get("type") == "text"
                            )
                        if text.strip():
                            ts = entry.get("timestamp", "")
                            messages.append(("user", text.strip(), ts))

                    elif role == "assistant" and isinstance(content, dict) and content.get("role") == "assistant":
                        parts = content.get("content", [])
                        if isinstance(parts, list):
                            text = " ".join(
                                p.get("text", "") for p in parts
                                if isinstance(p, dict) and p.get("type") == "text"
                            )
                        else:
                            text = str(parts)
                        if text.strip():
                            ts = entry.get("timestamp", "")
                            messages.append(("assistant", text.strip(), ts))

                except json.JSONDecodeError:
                    continue
    except Exception as e:
        print(f"  ✗ Error reading {session_file.name}: {e}")
        return

    if not messages:
        return

    uuid_display = session_uuid or session_file.stem
    mtime = datetime.fromtimestamp(session_file.stat().st_mtime)
    filename = f"{mtime.strftime('%Y%m%d_%H%M')}_{uuid_display[:8]}.md"
    out_path = output_dir / filename

    with open(out_path, "w") as f:
        heading = title if title else "Untitled Session"
        f.write(f"# {heading}\n\n")
        f.write(f"**Session ID:** `{uuid_display}`  \n")
        f.write(f"**Date:** {mtime.strftime('%Y-%m-%d %H:%M')}\n\n---\n\n")
        for role, text, ts in messages:
            prefix = "👤 **You**" if role == "user" else "🤖 **Claude**"
            f.write(f"### {prefix}\n{text}\n\n")

    title_display = f'"{title}"' if title else "(no title)"
    print(f"  ✓ {filename}  {title_display}  ({len(messages)} messages)")


def cleanup_project(project_filter: str, keep: int = 5, dry_run: bool = True):
    """
    Delete all sessions except the most recent `keep` ones for matching projects.

    Sorting uses `modified` date from sessions-index.json (most accurate),
    falling back to file mtime if the index is missing.

    Steps:
      1. Show what will be deleted (always previews first)
      2. Ask for confirmation unless --yes is passed
      3. Delete session files/dirs and update sessions-index.json
    """
    import shutil

    matched = find_matching_projects(project_filter)
    if not matched:
        print(f"\nNo projects found matching: '{project_filter}'")
        print("Run --list to see all available projects.")
        return

    for proj_dir, real_path in matched:
        print(f"\nProject: {real_path}")

        # --- Build ordered session list, newest last ---
        # Prefer `modified` from sessions-index.json over file mtime (more accurate)
        index_file = proj_dir / "sessions-index.json"
        modified_map = {}   # uuid -> ISO modified string
        first_prompt_map = {}
        if index_file.exists():
            try:
                data = json.loads(index_file.read_text())
                for entry in data.get("entries", []):
                    uid = entry.get("sessionId") or entry.get("id")
                    if uid:
                        modified_map[uid] = entry.get("modified") or entry.get("fileMtime") or ""
                        first_prompt_map[uid] = clean_first_prompt(
                            entry.get("firstPrompt") or entry.get("title") or ""
                        )
            except Exception:
                pass

        sessions = find_session_files(proj_dir)   # sorted oldest→newest by mtime
        if not sessions:
            print("  No sessions found — skipping.")
            continue

        # Re-sort by index `modified` if available, else keep mtime order
        def sort_key(item):
            _, uuid = item
            return modified_map.get(uuid) or item[0].stat().st_mtime

        sessions.sort(key=sort_key)

        total = len(sessions)
        to_delete = sessions[:-keep] if keep < total else []
        to_keep   = sessions[-keep:] if keep < total else sessions

        print(f"  Total sessions : {total}")
        print(f"  Keeping latest : {len(to_keep)}")
        print(f"  To delete      : {len(to_delete)}")

        if not to_delete:
            print("  ✓ Nothing to delete — already within limit.")
            continue

        # --- Preview ---
        print("\n  KEEP (newest):")
        for f, uuid in reversed(to_keep):
            mod = modified_map.get(uuid, "")[:10] or datetime.fromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d")
            title = first_prompt_map.get(uuid) or uuid[:8]
            print(f"    ✓ [{mod}] {title}")

        print("\n  DELETE (oldest):")
        for f, uuid in to_delete:
            mod = modified_map.get(uuid, "")[:10] or datetime.fromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d")
            title = first_prompt_map.get(uuid) or uuid[:8]
            # show what will actually be removed from disk
            target = f.parent if _looks_like_uuid(f.parent.name) else f
            print(f"    ✗ [{mod}] {title}")
            print(f"         → {target}")

        if dry_run:
            print("\n  ⚠  Dry run — nothing deleted. Pass --yes to confirm deletion.")
            continue

        # --- Confirm ---
        print()
        answer = input(f"  Delete {len(to_delete)} session(s) from '{real_path}'? [y/N] ").strip().lower()
        if answer != "y":
            print("  Skipped.")
            continue

        # --- Delete ---
        deleted_uuids = set()
        for f, uuid in to_delete:
            # New format: delete the whole UUID directory
            target = f.parent if _looks_like_uuid(f.parent.name) else f
            try:
                if target.is_dir():
                    shutil.rmtree(target)
                else:
                    target.unlink()
                deleted_uuids.add(uuid)
                print(f"  ✗ Deleted: {target.name}")
            except Exception as e:
                print(f"  ✗ Failed to delete {target}: {e}")

        # --- Update sessions-index.json ---
        if deleted_uuids and index_file.exists():
            try:
                data = json.loads(index_file.read_text())
                original_count = len(data.get("entries", []))
                data["entries"] = [
                    e for e in data.get("entries", [])
                    if (e.get("sessionId") or e.get("id")) not in deleted_uuids
                ]
                index_file.write_text(json.dumps(data, indent=2))
                removed = original_count - len(data["entries"])
                print(f"\n  ✓ sessions-index.json updated ({removed} entries removed)")
            except Exception as e:
                print(f"\n  ⚠ Could not update sessions-index.json: {e}")

        print(f"\n  Done. {len(deleted_uuids)} session(s) deleted.")


def find_matching_projects(project_filter: str) -> list[Path]:
    """
    Match project dirs by checking the real path (from cwd in JSONL),
    not the encoded directory name.
    """
    matched = []
    for proj_dir in CLAUDE_DIR.iterdir():
        if not proj_dir.is_dir():
            continue
        real_path = get_real_project_path(proj_dir)
        # Match against the real path
        if project_filter in real_path:
            matched.append((proj_dir, real_path))
    return matched


if __name__ == "__main__":
    args = sys.argv[1:]

    if not args or args[0] == "--list":
        list_projects(show_empty=False)
    elif args[0] == "--all":
        list_projects(show_empty=True)
    elif args[0] == "--cleanup":
        # Usage: --cleanup <project> [--keep N] [--yes]
        remaining = args[1:]
        keep_val = 5
        yes = "--yes" in remaining
        remaining = [a for a in remaining if a != "--yes"]
        if "--keep" in remaining:
            ki = remaining.index("--keep")
            keep_val = int(remaining[ki + 1])
            remaining = remaining[:ki] + remaining[ki + 2:]
        project_filter = remaining[0] if remaining else ""
        if not project_filter:
            print("Usage: python extract_project.py --cleanup <project> [--keep N] [--yes]")
        else:
            cleanup_project(project_filter, keep=keep_val, dry_run=not yes)
    else:
        generate = "--generate-titles" in args
        filtered = [a for a in args if a != "--generate-titles"]
        project_filter = filtered[0]
        output_dir = Path(filtered[1]) if len(filtered) > 1 else Path.home() / "claude-exports"

        if generate and not os.environ.get("ANTHROPIC_API_KEY"):
            print("⚠️  --generate-titles requires ANTHROPIC_API_KEY in environment.")
            print("   export ANTHROPIC_API_KEY=sk-ant-...")
            print("   Falling back to local title cleaning.\n")
            generate = False

        extract_project(project_filter, output_dir, generate=generate)
