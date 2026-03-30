# ctxport

Never lose your AI chat context when switching tools or hitting free tier limits.

`ctxport` runs in the background while you work in Cursor, auto-summarizes your conversation every 10 messages, and gives you a ready-to-paste prompt when you switch to Claude, ChatGPT, or any other AI tool.

---

## Requirements

- Node.js v16+
- Cursor IDE

---

## Install

```bash
npm install -g ctxport
```

---

## Usage

**1. Start the watcher in your project folder**
```bash
ctxport watch
```
Runs in the background. Chat in Cursor as normal — every 10 messages, a summary block is written to `AI_CONTEXT.md` in your project root.

**2. When you want to switch AI tools**
```bash
ctxport export
```
Reads `AI_CONTEXT.md` + your recent git commits + modified files, wraps it into a prompt, and copies it to your clipboard. Paste it into any AI tool and pick up exactly where you left off.

**3. Other commands**
```bash
ctxport status   # check if watcher is running
ctxport stop     # stop the watcher (flushes remaining messages first)
```

---

## How it works

- Reads Cursor's local SQLite database to detect new messages
- Every 10 messages → sends a summarize request to Cursor's local model → writes 3-bullet summary to `AI_CONTEXT.md`
- `export` builds a full context snapshot: session summaries + project stack + git history
- No API key needed — uses your existing Cursor session

---

## Supported

| Tool | Watch | Export |
|------|-------|--------|
| Cursor | ✓ | ✓ |
| Claude Code | coming soon | ✓ |
| Aider | coming soon | ✓ |

`export` works with any AI tool since it just reads local files.
