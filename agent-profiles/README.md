# Qwen Code Agent Profiles

These are specialized agent profiles for Qwen Code. Copy them to `~/.qwen/agents/` to enable.

## Available Agents

| Agent | Description | Color |
|-------|-------------|-------|
| **[anchor-researcher](anchor-researcher.md)** | Retrieve, parse, and summarize information from Anchor Engine + Git + codebase | 🔵 Cyan |
| **[bug-triage](bug-triage.md)** | Analyze issues, suggest labels, prioritize | 🔴 Red |
| **[code-reviewer](code-reviewer.md)** | Review PRs, suggest improvements, create Decision Records | 🟣 Purple |
| **[doc-writer](doc-writer.md)** | Update documentation from code changes | 🟡 Amber |
| **[test-runner](test-runner.md)** | Run tests, report failures, track test history in Anchor | 🟢 Green |

## Installation

```bash
# Copy all agents to Qwen Code
cp agent-profiles/*.md ~/.qwen/agents/

# Or copy individual agents
cp agent-profiles/code-reviewer.md ~/.qwen/agents/
```

## Usage

Agents are triggered automatically based on their configured triggers, or manually:

```bash
# In Qwen Code:
/research <query>        # anchor-researcher
/triage                  # bug-triage
/review                  # code-reviewer
/docs                    # doc-writer
/test                    # test-runner
```

## Anchor Engine Integration

The `anchor-researcher` agent requires Anchor Engine MCP server. Configure in `.qwen/settings.json`:

```json
{
  "mcpServers": {
    "anchor": {
      "command": "node",
      "args": ["path/to/anchor-engine/mcp-server/dist/index.js"],
      "env": {
        "ANCHOR_API_URL": "http://localhost:3160",
        "ANCHOR_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Customization

Each agent is a markdown file. Edit to customize:
- Trigger patterns
- Output formats
- Priority levels
- Integration endpoints
- Project-specific conventions
