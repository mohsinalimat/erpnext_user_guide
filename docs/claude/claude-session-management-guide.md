# Claude Code — Session Management & Conversation Export Guide

> **Environment:** Ubuntu 24.04 · Claude Code (CLI)  

---

## Table of Contents

1. [Important Note — Claude Desktop vs Claude Code on Linux](#1-important-note)
2. [Where Conversations Are Stored](#2-where-conversations-are-stored)
3. [Redirecting Session Storage](#3-redirecting-session-storage)
4. [Exporting Conversations to Markdown](#4-exporting-conversations-to-markdown)
5. [Project-wise Extraction Script](#5-project-wise-extraction-script)
6. [Final Script Reference](#7-final-script-reference)

---

## 1. Important Note

The **official Claude Desktop app is not available for Linux**. On Ubuntu 24.04, the correct tool is **Claude Code** (the CLI). All session storage described in this guide applies to Claude Code.

---

## 2. Where Conversations Are Stored

Claude Code stores all session data under `~/.claude/`:

| Path | Contents |
|---|---|
| `~/.claude/history.jsonl` | Global index of every prompt sent across all projects (timestamp, project path, session ID). Grows indefinitely. |
| `~/.claude/projects/<encoded-path>/` | Per-project directory containing all session files |
| `~/.claude/projects/<encoded-path>/*.jsonl` | Individual session transcripts (one file per session) |
| `~/.claude/projects/<encoded-path>/sessions-index.json` | Session metadata: summaries, message counts, git branches, timestamps |
| `~/.claude/todos/<session-id>-*.json` | Task lists created during sessions |

### Path Encoding

Claude Code encodes project paths by replacing path separators and special characters with `-`:

```
/home/$USER/erpnext/frappe-bench-test/apps/custom_app
        ↓  encoded as
-home-$USER-erpnext-frappe-bench-test-apps-custom_app
```

**Key encoding rules:**
- `/` → `-`
- `.` → `-` (so hidden dirs like `.claude-worktrees` produce a double dash `--`)
- Literal `-` in folder names → `-` (same as path separator — **lossy, not reversible**)

> Because the encoding is lossy, `frappe-bench-test` and `frappe/bench/test` look identical after encoding. **Never decode by blindly replacing `-` with `/`.**

### Exploring Sessions Manually

```bash
# Find encoded path for a project
echo "/home/$USER/erpnext/frappe-bench-test/apps/custom_app" | sed 's|/|-|g'

# List all sessions for a project (sorted by date)
ls -lt ~/.claude/projects/-home-$USER-erpnext-frappe-bench-test-apps-custom_app/

# Pretty-print a single session entry
head -1 ~/.claude/projects/<hash>/sessions/<session-id>.jsonl | python3 -m json.tool
```

> **Session file naming:** Main sessions use UUID-style names (e.g. `01e78099-de0e-4424-845c-518638c8241e.jsonl`). Sub-agent sessions are prefixed with `agent-` and don't contain direct user input.

---

## 3. Redirecting Session Storage

There is no official config flag to change the `~/.claude/` root. Practical options:

### Option A — Symlink (Simplest)

```bash
mv ~/.claude ~/my-backups/claude-sessions
ln -s ~/my-backups/claude-sessions ~/.claude
```

Claude Code writes there transparently with no other changes needed.

### Option B — Periodic rsync Backup

```bash
rsync -av ~/.claude/projects/ ~/Documents/claude-backups/projects/
```

Add to `crontab` for automatic scheduled backups:

```bash
crontab -e
# Add: 0 22 * * * rsync -av ~/.claude/projects/ ~/Documents/claude-backups/projects/
```

### Option C — Cross-machine Sync (claude-sync)

```bash
npm install -g @tawandotorg/claude-sync
claude-sync pull   # start of day
claude-sync push   # end of day
```

> **Caveat:** Sessions are indexed by absolute filesystem path. If the project path differs between machines, Claude Code treats them as separate projects and `claude --resume` won't bridge them.

---

## 4. Exporting Conversations to Markdown

### Using `claude-conversation-extractor` (Quickest)

```bash
# Install
sudo apt install pipx
pipx ensurepath
pipx install claude-conversation-extractor

# Interactive UI (recommended for casual use)
claude-start

# CLI usage
claude-extract --list                          # list all conversations
claude-extract --recent 5                      # export 5 most recent
claude-extract --all                           # export everything
claude-extract --output ~/Documents/exports   # custom output folder
claude-extract --detailed --format html --extract 1   # include tool calls, MCP responses
```

**Output format per file:**
```
claude-conversation-2026-05-18-abc123.md
├── Metadata (session ID, timestamp)
├── 👤 User messages
└── 🤖 Claude responses
```

> `claude-conversation-extractor` does not support filtering by project natively. Use the custom script below for project-wise extraction.

---

## 5. Project-wise Extraction Script

### The Problem with Naive Decoding

An early version of the script used this decode approach:

```python
# ❌ WRONG — breaks on paths with literal dashes
def decode_project_path(encoded):
    return encoded.replace("-", "/")
```

This caused `/home/$USER/erpnext/frappe-bench-test/apps/custom_app` to be shown as `/home/$USER/erpnext/frappe/bench/test/apps/ai/chatbot` — splitting folder names like `frappe-bench-test` at every `-`.

### The Fix — Read `cwd` from JSONL

The correct approach: each `.jsonl` session file contains a `cwd` field with the **original absolute path** as stored by the OS. Read that instead of trying to decode the directory name.

```python
# ✅ CORRECT
def get_real_project_path(proj_dir):
    for jsonl_file in proj_dir.glob("*.jsonl"):
        with open(jsonl_file) as f:
            for line in f:
                entry = json.loads(line)
                cwd = entry.get("cwd") or entry.get("projectPath")
                if cwd:
                    return cwd   # real path, no decoding needed
    return proj_dir.name  # fallback
```

---


## 6. Final Script Reference

[Source: ](../../utils/claude_utils.py)

### Installation

```bash
# Save to a convenient location
cp claude_utils.py ~/.local/bin/claude_utils.py
chmod +x ~/.local/bin/claude_utils.py
```

### Usage

```bash
# List all projects with real paths, session counts, last active date
python claude_utils.py --list

# List including empty/worktree dirs
python claude_utils.py --all

# Extract all sessions for a specific project
python claude_utils.py custom_app ~/claude-exports/

# Extract all frappe-bench-test projects
python claude_utils.py frappe-bench-test ~/claude-exports/

# Default output folder is ~/claude-exports/ if not specified
python claude_utils.py idp

# cleanup session and conversation
## always preview first (dry run, default)
python claude_utils.py --cleanup custom_app

## confirm and delete
python claude_utils.py --cleanup custom_app --yes

## keep a different number (e.g. last 3)
python claude_utils.py --cleanup custom_app --keep 3 --yes

## Cleanup all frappe-bench-test projects at once
python claude_utils.py --cleanup frappe-bench-test --keep 5 --yes

```

### Expected `--list` Output

```
Real Project Path                                                 Sessions  Last Active
-----------------------------------------------------------------------------------------------
/home/$USER/erpnext/frappe-bench-test/apps/idp                        21  2026-05-18
/home/$USER/erpnext/frappe-bench-test/apps/custom_app                   5  2026-05-18

  2 project(s) listed. Use --all to include empty dirs.
```

### Output Folder Structure

```
~/claude-exports/
└── home_$USER_erpnext_frappe-bench-test_apps_custom_app/
    ├── 20260501_1430_a1b2c3d4.md
    ├── 20260510_0915_e5f6a7b8.md
    └── 20260518_1122_c9d0e1f2.md
```

Each `.md` file contains:

```markdown
# Session: <uuid>
**Date:** 2026-05-18 14:30

---

### 👤 **You**
<your message>

### 🤖 **Claude**
<claude response>
```

---

## Quick Reference Card

```bash
# Where are my sessions?
ls ~/.claude/projects/

# What's the real path of a project?
head -5 ~/.claude/projects/<encoded>/sessions/<uuid>.jsonl | python3 -m json.tool | grep cwd

# Resume last session
claude --continue

# Browse and resume any session
claude --resume

# Export all projects to markdown
python claude_utils.py --all ~/claude-exports/

# Search inside session files
grep -r "your search term" ~/.claude/projects/ --include="*.jsonl"
```

---


