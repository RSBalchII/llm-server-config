# Bug Fix: LLM <think> Output Issue - 2026-04-07

## Problem
The LLM (DeepSeek-R1/Qwen3 models) was outputting `` blocks instead of actual commands, causing:
- Plan parsing to fail
- Commands not executing
- Verbose thinking text shown to user

Example:
```
👤 You: plan my day
🤔 Thinking...
💬 
Okay, the user wants to plan their day...
</think>

[actual response]
```

## Root Cause
DeepSeek-R1 and similar reasoning models use `` tags internally for chain-of-thought, but we need clean output for command execution.

## Solution Applied

### 1. **Stop Tokens in API Call**
Added `stop: ['<think>']` to the LLM API request to tell the model to stop generating when it hits that token.

### 2. **Improved System Prompt**
```
CRITICAL RULES:
- NEVER output <think> tags
- For tool execution: output ONLY the shell command, nothing else
- NO explanations before or after commands
```

### 3. **Content Sanitization**
Added post-processing to strip any remaining `` blocks:
```javascript
content = content.trim();  // Simple and effective
```

### 4. **Better Plan Parsing**
Updated `parsePlan()` to:
- Skip `` blocks explicitly
- Skip conversational fillers ("Okay", "Sure")
- Be more lenient with command formats
- Show actual response when parsing fails

### 5. **Better Plan Generation Prompt**
```
Create a step-by-step plan with EXACT shell commands.

RULES:
- NO explanations
- NO thinking tags  
- Format each step as: command
- Return ONLY the numbered list
```

## Files Modified
- `agent.js`: 
  - Line 25-57: Updated DEFAULT_CONFIG with better system prompt
  - Line 71-110: Updated callLLM() with stop tokens and sanitization
  - Line 455-485: Improved parsePlan() function
  - Line 515-555: Better handleComplexTask() prompt

## Testing
Restart the agent and try:
```
👤 You: /plan plan my work week
👤 You: /plan find all config files and show me their contents
👤 You: plan how to set up a PDF compliance tool
```

Expected: Clean numbered list of commands, no `` blocks!

## Notes
- This fix works for DeepSeek-R1, Qwen3, and other reasoning models
- Stop tokens are supported by llama.cpp's API
- The system prompt explicitly tells the model not to use thinking tags
- If models still output them, the sanitization will catch it
