# Claude Desktop — Hung Session Recovery Guide

**Platform:** Ubuntu 24.04 · Claude Code (CLI)  

---

## Quick Decision Flow

```
Session hung
    │
    ├─ UI responsive? ──→ Press Escape or Ctrl+C
    │
    ├─ UI frozen? ──────→ pkill -f "claude"  →  claude --continue
    │
    └─ Hangs again on same session?
              └─ Check tail of .jsonl for corrupt last line
                          └─ sed -i '$ d' <session-file>.jsonl
```

---

## Step 1 — Keyboard Shortcuts (try first)

| Shortcut | What it does |
|---|---|
| `Escape` | Cancel current running tool/task |
| `Ctrl + C` | Interrupt active generation |
| `Ctrl + R` | Open session history picker |
| `Ctrl + W` | Close current session tab |

---

## Step 2 — Kill the Hung Process

If the UI is completely frozen:

```bash
# Find the Claude process
ps aux | grep -i claude

# Graceful kill first
pkill -f "claude"

# If still hanging after 5 seconds, force kill
pkill -9 -f "claude"
```

---

## Step 3 — Check for Stuck Sub-processes

Claude Code spawns child processes for tool use. A stuck bash/python subprocess
is the most common cause of hangs:

```bash
# See full process tree
pstree -p $(pgrep -f "claude") 2>/dev/null

# Kill the whole group at once
pkill -9 -P $(pgrep -f "claude")
```

---

## Step 4 — Clear Stale Lock / Socket Files

```bash
# Remove any socket or lock files left behind
rm -f ~/.claude/*.lock
rm -f /tmp/claude-* 2>/dev/null

# Check for lingering node processes (Claude Code runs on Node)
pkill -f "node.*claude"
```

---

## Step 5 — Resume the Session After Restart

Your work is safe — the session is persisted to disk. After restarting:

```bash
# Resume the last session directly
claude --continue

# Or pick from the session list
claude --resume
```

From inside Claude Desktop UI: `Ctrl + R` opens the session picker — find your
hung session by name/date and continue from exactly where it left off.

---

## Step 6 — Fix a Repeatedly Hanging Session (Corrupt JSONL)

A session file can get corrupted mid-write during a crash. The last line may be
a partial JSON entry causing Claude to hang on load.

```bash
# Find the session file for your project
ls -lt ~/.claude/projects/-home-sanjay-erpnext-frappe-bench-test-apps-ai_chatbot/

# Inspect the last few lines of the most recent session
tail -5 ~/.claude/projects/-home-sanjay-erpnext-frappe-bench-test-apps-ai_chatbot/<session-uuid>.jsonl \
  | python3 -m json.tool
```

If `python3 -m json.tool` throws a parse error on the last line, that line is a
partial write. Fix it by removing it:

```bash
# Remove the last (corrupted) line
sed -i '$ d' ~/.claude/projects/.../<session-uuid>.jsonl
```

> **Why this is safe:** Claude Code stores sessions as append-only JSONL — each
> line is an independent JSON object. Removing one corrupt tail line loses only
> the in-flight message at the moment of crash, and the rest of the session
> remains fully intact.

---

## Reference — Session File Location

| What | Path |
|---|---|
| All projects | `~/.claude/projects/` |
| Specific project | `~/.claude/projects/-home-sanjay-erpnext-frappe-bench-test-apps-<name>/` |
| Session files | `<project-dir>/<session-uuid>.jsonl` (old) or `<project-dir>/<session-uuid>/` (new) |
| Session index | `<project-dir>/sessions-index.json` |

---

