# research-harness.ps1
# Automated research harness for Qwen Code + Anchor Engine
# Usage: .\research-harness.ps1 -topic "topic to research" -schedule "daily at 8am"
# Or trigger manually: .\research-harness.ps1 -topic "what to research"

param(
    [Parameter(Mandatory=$true)]
    [string]$Topic,

    [Parameter(Mandatory=$false)]
    [string]$SessionId,

    [Parameter(Mandatory=$false)]
    [string]$AnchorApiUrl = "http://127.0.0.1:3160",

    [Parameter(Mandatory=$false)]
    [string]$AnchorApiKey = "your-api-key",

    [Parameter(Mandatory=$false)]
    [string]$OutputDir = ".\research",

    [Parameter(Mandatory=$false)]
    [string]$QwenCodePath = ".\Projects\Qwen Code",

    [Parameter(Mandatory=$false)]
    [string]$LlamaServerUrl = "http://127.0.0.1:18080",

    [Parameter(Mandatory=$false)]
    [string]$Model = "qwen-3.5-4b",

    [Parameter(Mandatory=$false)]
    [string]$BrowserUrl = "http://localhost:18080",  # Browser server for web fetching
)

$ErrorActionPreference = "Continue"
$VerbosePreference = "IfNewer"

Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  micro-nanobot Research Harness v0.1.0                  ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Configuration
$Config = @{
    LLMUrl = $LlamaServerUrl
    Model = $Model
    MaxTokens = 8192
    Temperature = 0.7
    AnchorUrl = $AnchorApiUrl
    AnchorKey = $AnchorApiKey
    OutputDir = $OutputDir
    QwenPath = $QwenCodePath
    BrowserUrl = $BrowserUrl
}

# Ensure output directory exists
if (-not (Test-Path $Config.OutputDir)) {
    Write-Host "Creating output directory: $Config.OutputDir" -ForegroundColor DarkGray
    New-Item -ItemType Directory -Force -Path $Config.OutputDir | Out-Null
}

# Timestamps
$StartTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$EndTime = $null

# Session file
$SessionFile = Join-Path $Config.OutputDir "session-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
$ReportFile = Join-Path $Config.OutputDir "report-$(Get-Date -Format 'yyyyMMdd-HHmmss').md"

Write-Host ""
Write-Host "📋 Research Topic: $Topic" -ForegroundColor Yellow
Write-Host "📊 Session ID: $($SessionId ?? 'auto-generated')" -ForegroundColor DarkGray
Write-Host "🔗 LLM: $Config.LLMUrl" -ForegroundColor DarkGray
Write-Host "🔗 Anchor: $Config.AnchorUrl" -ForegroundColor DarkGray
Write-Host ""

# ============================================================================
# STEP 1: Initialize Session
# ============================================================================

Write-Host "🚀 Initializing research session..." -ForegroundColor Cyan

$Session = @{
    topic = $Topic
    sessionId = $SessionId
    startTime = $StartTime
    llmUrl = $Config.LLMUrl
    model = $Config.Model
    anchorUrl = $Config.AnchorUrl
    anchorKey = $Config.AnchorKey
    outputDir = $Config.OutputDir
    browserUrl = $Config.BrowserUrl
    status = "running"
    steps = @()
    findings = @()
    summary = $null
    urls = @()  # Collected URLs for Anchor web search
}

$Session | ConvertTo-Json | Out-File $SessionFile -Encoding UTF8

Write-Host "✅ Session saved to: $SessionFile" -ForegroundColor Green

# ============================================================================
# STEP 2: Log to Anchor Engine
# ============================================================================

Write-Host ""
Write-Host "📡 Logging to Anchor Engine..." -ForegroundColor Cyan

function Invoke-AnchorSearch {
    param(
        [string]$Query,
        [string]$TokenBudget = "2000",
        [string]$IncludeProvenance = "true"
    )

    $headers = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $Config.AnchorKey"
    }

    $body = @{
        query = $Query
        tokenBudget = $TokenBudget
        includeProvenance = $IncludeProvenance
    } | ConvertTo-Json

    try {
        $result = Invoke-RestMethod -Uri "$Config.AnchorUrl/api/search" -Method POST -Headers $headers -Body $body -TimeoutSec 30
        return $result
    } catch {
        Write-Host "⚠️  Anchor search error: $_" -ForegroundColor Yellow
        return $null
    }
}

function Invoke-AnchorDistill {
    param(
        [string]$SeedQuery,
        [int]$Radius = 2,
        [string]$OutputFormat = "compound"
    )

    $headers = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $Config.AnchorKey"
    }

    $body = @{
        seed = @{ query = $SeedQuery }
        radius = $Radius
        outputFormat = $OutputFormat
    } | ConvertTo-Json

    try {
        $result = Invoke-RestMethod -Uri "$Config.AnchorUrl/api/distill" -Method POST -Headers $headers -Body $body -TimeoutSec 30
        return $result
    } catch {
        Write-Host "⚠️  Anchor distill error: $_" -ForegroundColor Yellow
        return $null
    }
}

function Fetch-WebContent {
    param(
        [string]$Url,
        [string]$OutputFile
    )

    try {
        $response = Invoke-RestMethod -Uri $Url -TimeoutSec 30
        $html = $response.Content
        
        # Save HTML for Anchor web search
        $html | Out-File -FilePath $OutputFile -Encoding UTF8
        Write-Host "  Saved HTML to: $OutputFile" -ForegroundColor DarkGray
        
        # Return URL for Anchor web search tool to parse
        return $Url
    } catch {
        Write-Host "⚠️  Web fetch error for $Url: $_" -ForegroundColor Yellow
        return $null
    }
}

function Invoke-AnchorWebSearch {
    param(
        [string]$Url,
        [string]$TokenBudget = "2000",
        [string]$IncludeProvenance = "true"
    )

    $headers = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $Config.AnchorKey"
    }

    $body = @{
        query = $Url
        tokenBudget = $TokenBudget
        includeProvenance = $IncludeProvenance
    } | ConvertTo-Json

    try {
        $result = Invoke-RestMethod -Uri "$Config.AnchorUrl/api/web-search" -Method POST -Headers $headers -Body $body -TimeoutSec 30
        return $result
    } catch {
        Write-Host "⚠️  Anchor web search error: $_" -ForegroundColor Yellow
        return $null
    }
}

function Invoke-AnchorLog {
    param(
        [string]$Type,
        [string]$Title,
        [string]$Content
    )

    $headers = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $Config.AnchorKey"
    }

    $body = @{
        type = $Type
        title = $Title
        content = $Content
        createdAt = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
    } | ConvertTo-Json

    try {
        Invoke-RestMethod -Uri "$Config.AnchorUrl/api/decisions" -Method POST -Headers $headers -Body $body -TimeoutSec 30
    } catch {
        Write-Host "⚠️  Anchor log error: $_" -ForegroundColor Yellow
    }
}

# Initial search
Write-Host "  Searching Anchor for related context..." -ForegroundColor DarkGray
$InitialSearch = Invoke-AnchorSearch -Query $Topic
if ($InitialSearch) {
    Write-Host "  Found $($InitialSearch.results.Count) related entries" -ForegroundColor Green
    $Session.anchorSearch = $InitialSearch
} else {
    Write-Host "  No related entries found in Anchor" -ForegroundColor Yellow
}

# Initial distill
Write-Host "  Distilling related knowledge..." -ForegroundColor DarkGray
$InitialDistill = Invoke-AnchorDistill -SeedQuery $Topic
if ($InitialDistill) {
    Write-Host "  Distilled $(($InitialDistill.knowledge.Count ?? 0)) knowledge chunks" -ForegroundColor Green
    $Session.initialDistill = $InitialDistill
} else {
    Write-Host "  Distill returned empty" -ForegroundColor Yellow
}

# Log initial session
Invoke-AnchorLog -Type "research-start" -Title "Research: $Topic" -Content "Started at $StartTime"

Write-Host "✅ Anchor Engine initialized" -ForegroundColor Green

# ============================================================================
# STEP 3: Run Research (LLM + Anchor loop)
# ============================================================================

Write-Host ""
Write-Host "🤖 Running research..." -ForegroundColor Cyan
$EndTime = Get-Date

# Simulated research loop - in practice, this would:
# 1. Query LLM with anchor search results as context
# 2. Execute commands (git search, web fetch, etc.)
# 3. Log findings to Anchor
# 4. Generate markdown

$ResearchSteps = @(
    @{
        name = "Initial search"
        action = { $InitialSearch }
    },
    @{
        name = "Knowledge distillation"
        action = { $InitialDistill }
    },
    @{
        name = "Web research"
        action = {
            # Fetch URLs for web research
            Write-Host "  Fetching web content for web research..." -ForegroundColor DarkGray
            
            $WebUrls = @(
                "https://example.com/article1",
                "https://example.com/article2",
                "https://example.com/paper1.pdf"
            )
            
            foreach ($url in $WebUrls) {
                $htmlFile = Join-Path $Config.OutputDir "web-$((Get-Date -Format 'yyyyMMdd-HHmmss')).html"
                Fetch-WebContent -Url $url -OutputFile $htmlFile
                
                # Use Anchor Engine web search to parse HTML into MD
                $webSearchResult = Invoke-AnchorWebSearch -Url $url
                if ($webSearchResult) {
                    Write-Host "  Anchor web search: $($webSearchResult.knowledge.Count ?? 0) knowledge chunks" -ForegroundColor Green
                }
                
                $Session.urls += $url
            }
            
            Write-Host "  Collected $($Session.urls.Count) URLs for Anchor web search" -ForegroundColor Green
            return $null
        }
    },
    @{
        name = "Deep dive research"
        action = {
            # Placeholder - would query LLM with more context
            # Example: "expand on $Topic based on anchor results"
            Write-Host "  Running deep research on: $Topic" -ForegroundColor DarkGray
            # Simulate LLM response
            return @{
                findings = @(
                    @{ name = "Key finding 1" content = "Details about $Topic" },
                    @{ name = "Key finding 2" content = "More details" }
                )
            }
        }
    },
    @{
        name = "Compile findings"
        action = {
            # Placeholder - would format findings for markdown
            Write-Host "  Compiling findings..." -ForegroundColor DarkGray
            return @{
                summary = "Research complete. Found $($Session.findings.Count) key findings."
            }
        }
    }
)

$StepCount = 0
foreach ($step in $ResearchSteps) {
    $StepCount++
    Write-Host ""
    Write-Host "  Step $($StepCount): $($step.name)" -ForegroundColor DarkGray
    
    $result = $step.action()
    
    if ($result) {
        if ($result.findings) {
            $Session.findings += $result.findings
        }
        if ($result.summary) {
            $Session.summary = $result.summary
        }
        Write-Host "  ✓ Step completed" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Step had issues" -ForegroundColor Yellow
    }
}

$Duration = (Get-Date) - $StartTime
Write-Host ""
Write-Host "📊 Research completed in $($Duration.TotalMinutes) minutes" -ForegroundColor Cyan

# ============================================================================
# STEP 4: Generate Markdown Report
# ============================================================================

Write-Host ""
Write-Host "📝 Generating markdown report..." -ForegroundColor Cyan

$Report = @"
# Research Report: $Topic

**Session ID:** $($Session.sessionId)  
**Started:** $StartTime  
**Completed:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  
**Duration:** $((Get-Date - Format 'hh:mm'))  

## Initial Context

### Anchor Search Results
$(if ($InitialSearch) { "$($InitialSearch.results.Count) related entries found" } else { "No related entries in Anchor Engine" })

### Knowledge Distillation
$(if ($InitialDistill) { "$($InitialDistill.knowledge.Count ?? 0) knowledge chunks distilled" } else { "Distill returned empty" })

## Key Findings

$(if ($Session.findings) {
    foreach ($finding in $Session.findings) {
        Write-Host "  - $($finding.name): $($finding.content)" -ForegroundColor DarkGray
    }
} else {
    Write-Host "  No findings yet" -ForegroundColor Yellow
})

## Summary
$($Session.summary ?? "Research in progress...")

## Web Research URLs

For Anchor Engine web search tool, here are the URLs that were fetched:

$(if ($Session.urls) {
    foreach ($url in $Session.urls) {
        Write-Host "  - $url" -ForegroundColor DarkGray
    }
} else {
    Write-Host "  No URLs collected yet" -ForegroundColor Yellow
})

## Anchor Log Entries

### Research Start
- Type: research-start
- Title: Research: $Topic
- Time: $StartTime
"@

$Report | Out-File $ReportFile -Encoding UTF8
Write-Host "✅ Report saved to: $ReportFile" -ForegroundColor Green

# ============================================================================
# STEP 5: Save Session JSON
# ============================================================================

$Session | ConvertTo-Json | Out-File $SessionFile -Encoding UTF8
Write-Host "✅ Session saved to: $SessionFile" -ForegroundColor Green

# ============================================================================
# STEP 6: Log Final Status to Anchor
# ============================================================================

Invoke-AnchorLog -Type "research-complete" -Title "Research: $Topic" -Content "Completed at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'). Duration: $Duration.TotalMinutes minutes."

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Research Complete!                                      ║" -ForegroundColor Cyan
Write-Host "║  Report: $ReportFile                                  ║" -ForegroundColor Cyan
Write-Host "║  Session: $SessionFile                                ║" -ForegroundColor Cyan
Write-Host "║  Anchor Entries: research-start, research-complete        ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

# ============================================================================
# STEP 7: Cleanup
# ============================================================================

# Keep session file for 7 days, then archive
$RetentionDays = 7
$AgeDays = (Get-Date) - (New-TimeSpan -Start $StartTime -End (Get-Date)).TotalDays

if ($AgeDays -gt $RetentionDays) {
    Write-Host "  Archiving old sessions..." -ForegroundColor DarkGray
    $OldSessions = Get-ChildItem $Config.OutputDir -Filter "session-*" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) }
    foreach ($old in $OldSessions) {
        $old.Delete()
    }
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
