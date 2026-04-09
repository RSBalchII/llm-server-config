#!/usr/bin/env node

/**
 * Model-Triggered Tool Integration
 * Parses model responses for tool calls and executes them
 */

// Extract tool calls from model response
export function extractToolCalls(response) {
  const text = response.full || response.content || '';
  const toolCalls = [];
  
  // Pattern 1: "I'll <action>: <command>"
  const illPattern = /I'll\s+(\w+)[^:]*:\s*(.+)/gi;
  let match;
  while ((match = illPattern.exec(text)) !== null) {
    const action = match[1].toLowerCase();
    const command = match[2].trim().replace(/^`|`$/g, '').replace(/^bash\s*/i, '');
    
    // Map action to tool type
    const toolType = mapActionToTool(action, command);
    if (toolType) {
      toolCalls.push({ type: toolType, command, action });
    }
  }
  
  // Pattern 2: Backtick commands (but not in code blocks with explanations)
  const backtickPattern = /```(?:bash|sh)?\s*\n([^\n]+)\n```/gi;
  while ((match = backtickPattern.exec(text)) !== null) {
    const command = match[1].trim();
    if (isShellCommand(command)) {
      toolCalls.push({ type: 'bash', command, action: 'execute' });
    }
  }
  
  return toolCalls;
}

function mapActionToTool(action, command) {
  const actionMap = {
    'list': 'bash',
    'read': 'bash',
    'search': 'bash',
    'create': 'bash',
    'run': 'bash',
    'build': 'bash',
    'check': 'bash',
    'show': 'bash',
    'execute': 'bash',
  };
  
  return actionMap[action] || 'bash';
}

function isShellCommand(cmd) {
  const commands = [
    'ls', 'dir', 'Get-ChildItem', 'cat', 'Get-Content', 'grep', 'rg',
    'find', 'git', 'npm', 'node', 'echo', 'touch', 'mkdir', 'cd', 'pwd',
    'pytest', 'cargo', 'make', 'mv', 'cp', 'move', 'copy'
  ];
  
  return commands.some(c => cmd.toLowerCase().startsWith(c));
}

// Execute tool calls from model response
export async function executeModelToolCalls(modelResponse, executeTool) {
  const toolCalls = extractToolCalls(modelResponse);
  
  if (toolCalls.length === 0) {
    return null;
  }
  
  const results = [];
  for (const toolCall of toolCalls) {
    console.log(`\n🔧 [Model-triggered: ${toolCall.action}]`);
    console.log(`   Command: ${toolCall.command}`);
    
    const result = await executeTool({ type: toolCall.type, command: toolCall.command });
    console.log(`   Result: ${result.output.split('\n')[0]}`);
    
    results.push({ toolCall, result });
  }
  
  return results;
}
