# Research Schedule Examples

## Daily Morning Research (8 AM)

**Topic:** "tech trends"
**Command:**
```bash
./research.bat -topic "tech trends"
```

**Anchor Search Query:** "technology trends 2026"
**Token Budget:** 3000

**Web URLs:** Collected and saved in `./research/web-<timestamp>.html` for Anchor Engine web search tool.

**Anchor Web Search:** Automatically parses HTML into markdown knowledge chunks via Anchor Engine's `/v1/memory/web-search` endpoint.

---

## Afternoon News Cycle Research (2 PM)

**Topic:** "AI breakthroughs"
**Command:**
```bash
./research.bat -topic "AI breakthroughs"
```

**Anchor Search Query:** "AI developments news"
**Token Budget:** 2000

---

## Evening Deep Dive (8 PM)

**Topic:** "quantum computing"
**Command:**
```bash
./research.bat -topic "quantum computing"
```

**Anchor Search Query:** "quantum computing research"
**Token Budget:** 5000

---

## Weekend Knowledge Refresh (Saturday 10 AM)

**Topic:** "software architecture patterns"
**Command:**
```bash
./research.bat -topic "software architecture patterns"
```

**Anchor Search Query:** "design patterns microservices monolith"
**Token Budget:** 4000

---

## Power Automate Flow Example

```
Trigger: Schedule (daily at 8am)
    ↓
Action: Run PowerShell Script (research-harness.ps1)
    ↓
Input: Topic = "tech trends"
    ↓
Action: Wait for completion (5-10 minutes)
    ↓
Action: Send Email Notification (report available)
    ↓
Action: Push to GitHub (research-reports/)
```

## Cron Example (Linux/macOS)

```bash
# Daily at 8 AM
0 8 * * * /usr/bin/powershell -ExecutionPolicy Bypass -File ~/Projects/micro-nano-bot/research-harness.ps1 -topic "tech trends"

# Afternoon at 2 PM
0 14 * * * /usr/bin/powershell -ExecutionPolicy Bypass -File ~/Projects/micro-nano-bot/research-harness.ps1 -topic "AI breakthroughs"

# Evening at 8 PM
0 20 * * * /usr/bin/powershell -ExecutionPolicy Bypass -File ~/Projects/micro-nano-bot/research-harness.ps1 -topic "quantum computing"
```

## Windows Task Scheduler Example

**Task Name:** Micro-nanobot Research Daily
**Trigger:** Daily at 8:00 AM
**Action:** Start Program → PowerShell.exe
**Arguments:** `-ExecutionPolicy Bypass -File "C:\Users\rsbiiw\Projects\micro-nano-bot\research-harness.ps1" -topic "tech trends"`
**Settings:** Run whether user is logged on or not
