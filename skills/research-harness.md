# Research Harness & Agent Coordination

## Triggers
- research harness, anchor researcher, web search, distillation, knowledge extraction, automated research, session management, research loop

## Core Concepts

### Research Agent Role
Autonomous executor that coordinates LLM + Anchor Engine + Web to produce research reports.

**Three-System Orchestration:**
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   LLM       │◄───►│   Anchor     │◄───►│   Web       │
│  llama-     │     │   Engine     │     │   Fetcher   │
│  server:18080│     │   :3160      │     │             │
└─────────────┘     └──────────────┘     └─────────────┘
     Generate           Search/Distill      Collect URLs
     Summarize          Log Decisions       Save HTML
```

### 7-Step Execution Flow

**Step 1: Initialize Session**
```powershell
$Session = @{
    topic = $Topic
    sessionId = $SessionId
    startTime = $StartTime
    status = "running"
    findings = @()
    urls = @()
}
```

**Step 2: Anchor Bootstrap**
```powershell
# Search existing knowledge
$InitialSearch = Invoke-AnchorSearch -Query $Topic

# Distill key chunks  
$InitialDistill = Invoke-AnchorDistill -SeedQuery $Topic

# Log session start
Invoke-AnchorLog -Type "research-start" -Title "Research: $Topic"
```

**Step 3: Research Loop (Core)**
```
For each research step:
  1. Fetch URLs → Save HTML → AnchorWebSearch(url) parses to MD
  2. Query LLM with Anchor context → Get findings
  3. Compile findings → Add to session
  4. Log intermediate results
```

**Step 4: Generate Report**
```markdown
# Research Report: {topic}
- Session metadata
- Initial context (search + distill)
- Key findings
- Web research URLs
- Summary
```

**Step 5: Save Session JSON**
Full state dump for resumption/audit.

**Step 6: Log Completion**
```powershell
Invoke-AnchorLog -Type "research-complete" -Content "Duration: X minutes"
```

**Step 7: Cleanup**
Archive sessions > 7 days old.

### Anchor Engine APIs Used

**Search (`/api/search`):**
```powershell
$body = @{
    query = $Topic
    tokenBudget = "2000"
    includeProvenance = "true"
} | ConvertTo-Json

$result = Invoke-RestMethod -Uri "$AnchorUrl/api/search" `
    -Method POST -Headers $headers -Body $body
```

Returns: `{ results: [{ content, score, tags, source }] }`

**Distill (`/api/distill`):**
```powershell
$body = @{
    seed = @{ query = $Topic }
    radius = 2
    outputFormat = "compound"
} | ConvertTo-Json

$result = Invoke-RestMethod -Uri "$AnchorUrl/api/distill" `
    -Method POST -Headers $headers -Body $body
```

Returns: `{ knowledge: [{ chunk, metadata }] }`

**Web Search (`/api/web-search`):**
```powershell
$body = @{
    query = $Url
    tokenBudget = "2000"
    includeProvenance = "true"
} | ConvertTo-Json

$result = Invoke-RestMethod -Uri "$AnchorUrl/api/web-search" `
    -Method POST -Headers $headers -Body $body
```

Returns: `{ knowledge: [{ markdown_chunk, url, metadata }] }`

**Log (`/api/decisions`):**
```powershell
$body = @{
    type = "research-start"
    title = "Research: $Topic"
    content = "Started at $StartTime"
} | ConvertTo-Json

Invoke-RestMethod -Uri "$AnchorUrl/api/decisions" `
    -Method POST -Headers $headers -Body $body
```

### LLM Integration (TODO - Currently Placeholder)

**Current State:** Simulated findings (not querying LLM)

**Required Implementation:**
```powershell
function Invoke-LLMQuery {
    param(
        [string]$Prompt,
        [string]$Context = ""
    )
    
    $body = @{
        messages = @(
            @{ role = "system"; content = "You are a research assistant..." }
            @{ role = "user"; content = "$Context`n`n$Prompt" }
        )
        max_tokens = 4096
        temperature = 0.7
        stream = $false
    } | ConvertTo-Json
    
    $result = Invoke-RestMethod -Uri "http://127.0.0.1:18080/v1/chat/completions" `
        -Method POST -Headers @{ "Content-Type" = "application/json" } `
        -Body $body
    
    return $result.choices[0].message.content
}
```

**Usage in Research Loop:**
```powershell
# Query LLM with Anchor context
$Prompt = "Based on the following knowledge about $Topic, provide key insights:"
$Context = $InitialSearch.results | ForEach-Object { $_.content } | Out-String
$Findings = Invoke-LLMQuery -Prompt $Prompt -Context $Context

$Session.findings += @{
    source = "llm-analysis"
    content = $Findings
    timestamp = Get-Date
}
```

### Web Research Flow
```
URL List → Fetch HTML → Save to File → AnchorWebSearch → Markdown Chunks → Session
```

**Example:**
```powershell
$urls = @(
    "https://arxiv.org/paper/12345",
    "https://example.com/article"
)

foreach ($url in $urls) {
    # 1. Fetch HTML
    $htmlFile = "web-$(Get-Date -Format 'yyyyMMdd-HHmmss').html"
    Fetch-WebContent -Url $url -OutputFile $htmlFile
    
    # 2. Parse with Anchor
    $result = Invoke-AnchorWebSearch -Url $url
    
    # 3. Store in session
    $Session.urls += $url
    $Session.findings += $result.knowledge
}
```

### Common Pitfalls (Stumps Small Models)
❌ **WRONG**: "Research harness queries LLM directly"  
✅ **CORRECT**: It coordinates LLM + Anchor + Web; Anchor provides context to LLM

❌ **WRONG**: "Web search downloads PDFs"  
✅ **CORRECT**: Web search fetches HTML; Anchor parses to markdown

❌ **WRONG**: "Session JSON is optional"  
✅ **CORRECT**: Session enables resumption, audit, and report generation

❌ **WRONG**: "Research is fully implemented"  
✅ **CORRECT**: Core loop is scaffolded; LLM integration is placeholder

### Session State Management
```json
{
  "topic": "AI safety",
  "sessionId": "abc123",
  "startTime": "2026-04-10 22:00:00",
  "status": "running",
  "findings": [
    { "name": "Key insight", "content": "Details..." }
  ],
  "urls": ["https://..."],
  "anchorSearch": { "results": [...] },
  "initialDistill": { "knowledge": [...] }
}
```

### Report Generation
```markdown
# Research Report: AI Safety

**Session ID:** abc123
**Started:** 2026-04-10 22:00:00
**Duration:** 5 minutes

## Initial Context
- Anchor Search: 15 related entries found
- Knowledge Distillation: 42 chunks distilled

## Key Findings
- Key finding 1: Details...
- Key finding 2: More details...

## Web Research URLs
- https://arxiv.org/paper/12345
- https://example.com/article

## Summary
Research complete. Found 5 key insights.
```

### Scheduling Research
```powershell
# Via Task Scheduler (Windows)
$action = New-ScheduledTaskAction `
    -Execute "pwsh" `
    -Argument "-File .\research-harness.ps1 -topic 'daily news'"
$trigger = New-ScheduledTaskTrigger -Daily -At 8am
Register-ScheduledTask -TaskName "DailyResearch" -Action $action -Trigger $trigger
```

### Troubleshooting
**Problem**: Anchor search returns no results  
**Solution**: Check if Anchor Engine is running; verify API key and URL

**Problem**: Web fetch fails for certain URLs  
**Solution**: Some sites block PowerShell's User-Agent; add headers or use browser automation

**Problem**: LLM query placeholder returns simulated data  
**Solution**: Implement `Invoke-LLMQuery` function to call llama-server

**Problem**: Session file not saved  
**Solution**: Check output directory permissions; ensure path exists

## Safe
true

## Description
Research harness orchestration, Anchor Engine integration, web fetching, session management, report generation