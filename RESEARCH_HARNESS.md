# Research Harness

Automated research harness for Qwen Code + Anchor Engine. Runs scheduled research tasks, collects web URLs for Anchor's web search tool, and generates markdown reports.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     RESEARCH HARNESS                        │
│  (research-harness.ps1)                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
    ┌────▼────┐  ┌────▼─────┐  ┌────▼────┐
    │Anchor   │  │  LLM     │  │  Web    │
    │Search   │  │  (Qwen) │  │  Fetch   │
    │         │  │          │  │  (URLs)  │
    └────┬────┘  └─────┬────┘  └────┬────┘
         │             │             │
         └──────┬──────┴───────┬────┘
                │              │
         ┌──────▼──────┐  ┌───▼──────┐
         │  Markdown   │  │ Anchor   │
         │  Report     │  │ Log      │
         └─────────────┘  └──────────┘
```

## Workflow

1. **Anchor Search** - Query Anchor Engine for related context
2. **Knowledge Distill** - Compress related knowledge chunks
3. **Web Research** - Fetch HTML from URLs (saved as `web-<timestamp>.html`)
4. **Deep Dive** - LLM research based on Anchor context
5. **Compile Findings** - Generate markdown report
6. **Anchor Log** - Log session to Anchor Engine

## Web URLs for Anchor Engine

The harness collects URLs from web research and saves them in `./research/web-<timestamp>.html`. These HTML files can be used with Anchor Engine's web search tool to parse articles and papers.

**Anchor Web Search Integration:**
- Fetch HTML files → Anchor parses them
- Extract key concepts from articles
- Store in Anchor Engine knowledge base
- Use in future research queries

## Files

- `research-harness.ps1` - Main harness script
- `research.bat` - Simple batch wrapper
- `SCHEDULE.md` - Scheduled research examples
- `README.md` - This file

## Usage

### Manual Run

```bash
# Basic usage
.\research.bat -topic "tech trends"

# With custom parameters
.\research-harness.ps1 -topic "AI breakthroughs" -anchor-key "your-key"
```

### Scheduled (Power Automate)

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

### Scheduled (Windows Task Scheduler)

**Task Name:** Micro-nanobot Research Daily
**Trigger:** Daily at 8:00 AM
**Action:** Start Program → PowerShell.exe
**Arguments:** `-ExecutionPolicy Bypass -File "C:\Users\rsbiiw\Projects\micro-nano-bot\research-harness.ps1" -topic "tech trends"`

## Output Files

- `session-<timestamp>.json` - Full session data (for debugging)
- `report-<timestamp>.md` - Markdown report with findings and URLs
- `web-<timestamp>.html` - Collected web content (for Anchor)

## Configuration

```powershell
$Config = @{
    LLMUrl = "http://127.0.0.1:18080"
    Model = "qwen-3.5-4b"
    MaxTokens = 8192
    Temperature = 0.7
    AnchorUrl = "http://127.0.0.1:3160"
    AnchorKey = "your-api-key"
    OutputDir = ".\research"
    BrowserUrl = "http://localhost:18080"
}
```

## Anchor Engine Requirements

- Anchor Engine running at `http://localhost:3160`
- API key configured
- Web search tool available for parsing HTML files

## Token Savings

By running research overnight with the local model (Qwen 4B), you save tokens on Qwen Code's API calls. The research harness:
- Uses local llama-server (port 18080)
- Queries Anchor Engine via HTTP API
- Generates markdown reports
- Logs findings to Anchor Engine
