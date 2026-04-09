# Planning Mode A/B Test Plan

## Goal
Test if the agent can properly create and execute a simple plan.

## Test Case: "brush teeth and clean room in the morning"

### Expected Flow:
```
👤 You: brush teeth and clean room in the morning
🧠 Complex task detected - creating plan...

📝 Plan:
1. echo "Brush teeth"
2. echo "Clean room"

📋 Executing 2 step plan...

[Step 1/2] echo "Brush teeth"
🔧 [bash]
📋 Brush teeth

[Step 2/2] echo "Clean room"  
🔧 [bash]
📋 Clean room

💬 Summary:
Completed morning routine tasks.
```

## What Changed:
1. ✅ **Allow thinking** - Model can reason about the task
2. ✅ **Parse plans from full response** - Extract numbered steps anywhere
3. ✅ **Show thinking collapsed** - `💭 Thinking: ...` (first 3 lines)
4. ✅ **Better system prompt** - Clearer instructions
5. ✅ **Simpler plan generation** - Just numbered commands

## How to Test:
```bash
.\start.bat
# Select model #9 (Qwen3.5-4B-heretic - NOT reasoning model)

👤 You: brush teeth and clean room in the morning
```

## Success Criteria:
- [ ] Detects as complex task
- [ ] Creates numbered plan (1., 2., etc.)
- [ ] Executes at least one step
- [ ] Shows summary

## Next Iterations:
1. Fix plan parsing if it fails
2. Improve Windows command compatibility  
3. Add better error handling
4. Test with actual file operations
