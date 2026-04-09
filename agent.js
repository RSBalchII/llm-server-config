#!/usr/bin/env node

/**
 * micro-nanobot: Minimal AI Agent Harness
 * Inspired by microclaw - single file, minimal dependencies
 */

import { exec } from 'child_process';
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs';
import { createInterface } from 'readline';
import { promisify } from 'util';
import { loadSkills } from './skills/loader.js';
import { parseSchedule } from './scheduler/parser.js';
import { addSchedule, listSchedules, removeSchedule, toggleSchedule, formatSchedule } from './scheduler/manager.js';
import VoiceManager from './voice/manager.js';
import { extractToolCalls, executeModelToolCalls } from './tools/model-trigger.js';

const execAsync = promisify(exec);

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG = {
  llmUrl: 'http://127.0.0.1:8080',
  model: 'qwen-3.5-4b-heretic',
  maxContext: 10,
  systemPrompt: `You are a local coding agent.

When asked to do something:
- Output ONLY the shell command
- No explanations
- No thinking tags

Examples:
User: list files
Assistant: ls -la

User: what directory are we in
Assistant: pwd

User: hi
Assistant: Hello! How can I help?`,
  temperature: 0.4,
};

function loadConfig() {
  try {
    const userConfig = JSON.parse(readFileSync('config.json', 'utf-8'));
    return { ...DEFAULT_CONFIG, ...userConfig };
  } catch {
    return DEFAULT_CONFIG;
  }
}

const config = loadConfig();

// ============================================================================
// LLM CLIENT (llama.cpp HTTP API)
// ============================================================================

function extractThinkingAndResponse(content) { let response = content.trim(); let thinking = ''; const thinkClose = '<' + '/' + 'think' + '>'; const openIdx = content.indexOf(''); const closeIdx = content.indexOf(thinkClose); if (openIdx !== -1) { if (closeIdx !== -1 && closeIdx > openIdx) { thinking = content.slice(openIdx + 9, closeIdx).trim(); response = content.slice(closeIdx + 8).trim(); } else { const textAfterOpen = content.slice(openIdx + 9); const lines = textAfterOpen.split('\n').filter(l => l.trim()); const lastLine = (lines[lines.length - 1] || '').trim(); if (lastLine.length < 50 && !lastLine.startsWith('Okay') && !lastLine.startsWith('The user')) { thinking = textAfterOpen.slice(0, -lastLine.length).trim(); response = lastLine; } else { thinking = textAfterOpen.trim(); response = ''; } } return { thinking, response }; } return { thinking, response }; }

function extractCommandFromResponse(content) {
  // Search the ENTIRE response (including thinking) for command patterns
  // This catches commands mentioned anywhere in the text
  
  // Common command patterns
  const commandPatterns = [
    // Direct: "the command is: ls -la"
    /(?:command|run|execute|use)\s*(?:is|:)?\s*[`'"]?([a-z][a-z0-9\s\-\/\.\*]+)[`'"]?$/im,
    // Backticks: `ls -la`
    /`([a-z][a-z0-9\s\-\/\.\*]+)`/im,
    // Code block
    /```(?:bash|sh)?\s*\n([a-z][a-z0-9\s\-\/\.\*]+)\n```/im,
    // "I should run: ls -la"
    /(?:run|execute|use)\s*:?`\s*([a-z][a-z0-9\s\-\/\.\*]+)\s*`/im,
  ];
  
  for (const pattern of commandPatterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}

async function callLLM(messages, options = {}) {
  try {
    const response = await fetch(`${config.llmUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: config.systemPrompt },
          ...messages
        ],
        stream: false,
        max_tokens: options.maxTokens || 1024,
        temperature: config.temperature || 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // Handle reasoning models that output to reasoning_content
    const reasoningContent = data.choices[0].message.reasoning_content || '';
    const rawContent = data.choices[0].message.content || '';
    
    // Extract thinking from content if present
    const { thinking, response: cleanContent } = extractThinkingAndResponse(rawContent);
    
    // Return both the extracted thinking and clean response
    return { 
      reasoning: reasoningContent || thinking,  // Use extracted thinking if no reasoning_content
      content: cleanContent,
      full: (reasoningContent || thinking) + '\n' + cleanContent
    };
  } catch (error) {
    throw new Error(`LLM call failed: ${error.message}`);
  }
}

// ============================================================================
// INTENT PARSER - Extract command intent from user's natural language
// ============================================================================

// Load skills from .md files
const SKILL_PATTERNS = loadSkills();

// Fallback patterns (if skills don't cover something)
const FALLBACK_PATTERNS = [
  // Code operations
  { pattern: /\b(run|execute)\s+(tests?|test)\b/i,
    handler: () => {
      if (existsSync('package.json')) return 'npm test';
      if (existsSync('pytest.ini') || existsSync('setup.py')) return 'pytest';
      if (existsSync('Cargo.toml')) return 'cargo test';
      if (existsSync('Makefile')) return 'make test';
      return 'echo "No test runner found"';
    }
  },
  { pattern: /\b(run|execute|start)\s+(the\s+)?(server|app|application)\b/i,
    handler: () => {
      if (existsSync('package.json')) return 'npm start';
      if (existsSync('Cargo.toml')) return 'cargo run';
      if (existsSync('Makefile')) return 'make run';
      return 'echo "No start command found"';
    }
  },
  { pattern: /\b(build|compile)\b/i,
    handler: () => {
      if (existsSync('package.json')) return 'npm run build';
      if (existsSync('Cargo.toml')) return 'cargo build';
      if (existsSync('Makefile')) return 'make';
      return 'echo "No build command found"';
    }
  },

  // Search operations
  { pattern: /\b(search|find|grep)\s+(for\s+)?"(.+)"\s+(in\s+)?(.+)?/i,
    handler: (m) => `grep -rn "${m[3]}" ${m[5] || '.'}`
  },
  { pattern: /\b(where|which)\s+(is|are)\s+(\S+)/i,
    handler: (m) => `find . -name "*${m[3]}*" -type f`
  },

  // File operations
  { pattern: /\b(create|make)\s+(\S+)\s+with\s+(.+)\s*$/i,
    handler: (m) => `echo "${m[2]}" > ${m[3]}`
  },
  
  // Advanced file operations
  { pattern: /\b(append|add)\s+(.+?)\s+to\s+(.+)\s*$/i,
    handler: (m) => JSON.stringify({ type: 'append_file', path: m[3], content: m[2] })
  },
  { pattern: /\b(prepend|add to top of)\s+(.+?)\s+to\s+(.+)\s*$/i,
    handler: (m) => JSON.stringify({ type: 'prepend_file', path: m[3], content: m[2] })
  },
  { pattern: /\b(replace|substitute)\s+(.+?)\s+with\s+(.+?)\s+in\s+(.+)\s*$/i,
    handler: (m) => JSON.stringify({ type: 'replace_in_file', path: m[4], search: m[2], replace: m[3] })
  },
  { pattern: /\b(move|rename)\s+(\S+\.\S+|\S+\/\S+)\s+to\s+(\S+)\s*$/i,
    handler: (m) => JSON.stringify({ type: 'move_file', source: m[2], dest: m[3] })
  },
  { pattern: /\b(copy|duplicate)\s+(\S+\.\S+|\S+\/\S+)\s+to\s+(\S+)\s*$/i,
    handler: (m) => JSON.stringify({ type: 'copy_file', source: m[2], dest: m[3] })
  },

  // Git operations
  { pattern: /\b(git)\s+(status|st|log|diff|branch|pull|push|add|commit|fetch)\b/i,
    handler: (m) => `git ${m[2]}`
  },
];

// Filter out any null patterns from skills
const INTENT_PATTERNS = [
  ...SKILL_PATTERNS.flatMap(s => s.patterns).filter(p => p && p.pattern),
  ...FALLBACK_PATTERNS
];

function extractIntent(userText) {
  for (const intent of INTENT_PATTERNS) {
    const match = userText.match(intent.pattern);
    if (match) {
      const result = intent.handler(match);
      if (result) {
        // Check if it's a JSON tool call or a bash command
        if (result.startsWith('{')) {
          try {
            const toolCall = JSON.parse(result);
            return { type: toolCall.type, ...toolCall, confidence: 'high' };
          } catch (e) {
            // Not valid JSON, treat as bash command
          }
        }
        return { type: 'bash', command: result, confidence: 'high' };
      }
    }
  }

  // Fallback: if text looks like a raw command, use it
  const trimmed = userText.trim();
  if (/^(ls|cat|pwd|date|echo|mkdir|touch|rm|cp|mv|cd|grep|find|head|tail|wc|ps|free|df|du|uptime|whoami|hostname|git|npm|node|python|bash|sh)\b/.test(trimmed)) {
    return { type: 'bash', command: trimmed, confidence: 'medium' };
  }

  return null;
}

// ============================================================================
// CODE INTENT DETECTION - Smart code-aware parsing
// ============================================================================

function extractCodeIntent(userText) {
  const text = userText.toLowerCase();
  
  // Test execution
  if (/\b(run|execute)\s+(tests?|testing)\b/.test(text) || 
      /\btest\s+(the\s+)?(code|project|app)\b/.test(text)) {
    return { type: 'run_tests' };
  }
  
  // Build
  if (/\b(build|compile|make)\b/.test(text) && !/\b(search|find)\b/.test(text)) {
    return { type: 'build' };
  }
  
  // Code search
  const searchMatch = text.match(/\b(search|find|grep)\s+(for\s+)?["']?(.+?)["']?\s*(in\s+(\S+))?$/i);
  if (searchMatch) {
    return { 
      type: 'code_search', 
      query: searchMatch[3],
      directory: searchMatch[5] || '.' 
    };
  }
  
  return null;
}

// ============================================================================
// DANGEROUS COMMAND DETECTION
// ============================================================================

const DANGEROUS_PATTERNS = [
  {
    pattern: /\brm\s+(-[rf]+\s+)?\/(?!tmp|data\/data)/,
    level: 'critical',
    message: 'This could delete system files or important data',
    action: 'block'
  },
  {
    pattern: /\brm\s+-rf\s+/,
    level: 'critical',
    message: 'Recursive force delete is dangerous',
    action: 'confirm'
  },
  {
    pattern: /\bdd\s+/,
    level: 'critical',
    message: 'dd can overwrite disk partitions',
    action: 'block'
  },
  {
    pattern: /\bmkfs/,
    level: 'critical',
    message: 'This will format a filesystem',
    action: 'block'
  },
  {
    pattern: /\bsudo\s+/,
    level: 'warning',
    message: 'Running with elevated privileges',
    action: 'confirm'
  },
  {
    pattern: /\bchmod\s+777/,
    level: 'warning',
    message: 'This makes files world-writable',
    action: 'confirm'
  },
  {
    pattern: /\bchown\s+/,
    level: 'warning',
    message: 'Changing file ownership',
    action: 'confirm'
  },
  {
    pattern: /\bkill\s+-9\s+\d+/,
    level: 'warning',
    message: 'Force killing process',
    action: 'confirm'
  },
];

function checkDangerousCommand(command) {
  for (const rule of DANGEROUS_PATTERNS) {
    if (rule.pattern.test(command)) {
      return rule;
    }
  }
  return null;
}

async function confirmDangerousCommand(command, rule) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`\n⚠️  ${rule.level.toUpperCase()}: ${rule.message}`);
  console.log(`   Command: ${command}`);

  if (rule.action === 'block') {
    console.log('   This command is BLOCKED for safety.\n');
    rl.close();
    return false;
  }

  console.log('   Type "CONFIRM" to execute, or anything else to cancel:');

  const answer = await new Promise(resolve => {
    rl.question('   > ', answer => {
      rl.close();
      resolve(answer.trim().toUpperCase());
    });
  });

  return answer === 'CONFIRM';
}

async function toolBash(command, options = {}) {
  try {
    const cwd = options.cwd || process.cwd();
    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000,
      maxBuffer: 1024 * 1024,
      cwd: cwd
    });
    return { success: true, output: stdout || stderr };
  } catch (error) {
    return {
      success: false,
      output: error.message
    };
  }
}

async function toolReadFile(filepath) {
  try {
    const absPath = filepath.startsWith('/') ? filepath : `${process.cwd()}/${filepath}`;
    if (!existsSync(absPath)) {
      return { success: false, output: `File not found: ${filepath}` };
    }
    const content = readFileSync(absPath, 'utf-8');
    return { success: true, output: content };
  } catch (error) {
    return { success: false, output: error.message };
  }
}

async function toolWriteFile(filepath, content) {
  try {
    const absPath = filepath.startsWith('/') ? filepath : `${process.cwd()}/${filepath}`;
    writeFileSync(absPath, content);
    return { success: true, output: `Written: ${filepath}` };
  } catch (error) {
    return { success: false, output: error.message };
  }
}

async function toolAppendFile(filepath, content) {
  try {
    const absPath = filepath.startsWith('/') ? filepath : `${process.cwd()}/${filepath}`;
    appendFileSync(absPath, content);
    return { success: true, output: `Appended to: ${filepath}` };
  } catch (error) {
    return { success: false, output: error.message };
  }
}

async function toolPrependFile(filepath, content) {
  try {
    const absPath = filepath.startsWith('/') ? filepath : `${process.cwd()}/${filepath}`;
    const existing = existsSync(absPath) ? readFileSync(absPath, 'utf-8') : '';
    writeFileSync(absPath, content + '\n' + existing);
    return { success: true, output: `Prepended to: ${filepath}` };
  } catch (error) {
    return { success: false, output: error.message };
  }
}

async function toolReplaceInFile(filepath, search, replace) {
  try {
    if (!filepath || !search || replace === undefined) {
      return { success: false, output: 'Missing parameters. Example: replace "old" with "new" in file.txt' };
    }
    const absPath = filepath.startsWith('/') ? filepath : `${process.cwd()}/${filepath}`;
    if (!existsSync(absPath)) {
      return { success: false, output: `File not found: ${filepath}` };
    }
    let content = readFileSync(absPath, 'utf-8');
    const count = (content.match(new RegExp(search, 'g')) || []).length;
    content = content.split(search).join(replace);
    writeFileSync(absPath, content);
    return { success: true, output: `Replaced ${count} occurrence(s) in ${filepath}` };
  } catch (error) {
    return { success: false, output: error.message };
  }
}

async function toolMoveFile(source, dest) {
  try {
    if (!source || !dest) {
      return { success: false, output: 'Missing source or destination. Example: move file.txt to new.txt' };
    }
    const absSource = source.startsWith('/') ? source : `${process.cwd()}/${source}`;
    const absDest = dest.startsWith('/') ? dest : `${process.cwd()}/${dest}`;
    
    if (!existsSync(absSource)) {
      return { success: false, output: `Source not found: ${source}` };
    }
    
    // Use rename for moving within same filesystem
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    // On Windows, use move; on Unix, use mv
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? `move "${absSource}" "${absDest}"` : `mv "${absSource}" "${absDest}"`;
    
    await execAsync(cmd);
    return { success: true, output: `Moved: ${source} → ${dest}` };
  } catch (error) {
    return { success: false, output: error.message };
  }
}

async function toolCopyFile(source, dest) {
  try {
    if (!source || !dest) {
      return { success: false, output: 'Missing source or destination. Example: copy file.txt to backup.txt' };
    }
    const absSource = source.startsWith('/') ? source : `${process.cwd()}/${source}`;
    const absDest = dest.startsWith('/') ? dest : `${process.cwd()}/${dest}`;
    
    if (!existsSync(absSource)) {
      return { success: false, output: `Source not found: ${source}` };
    }
    
    const content = readFileSync(absSource);
    writeFileSync(absDest, content);
    return { success: true, output: `Copied: ${source} → ${dest}` };
  } catch (error) {
    return { success: false, output: error.message };
  }
}

async function toolCodeSearch(query, directory = '.') {
  try {
    const { stdout } = await execAsync(`grep -rn "${query}" ${directory} --include="*.js" --include="*.ts" --include="*.py" --include="*.rs" --include="*.json" --include="*.md" | head -50`, {
      timeout: 10000,
      maxBuffer: 1024 * 512
    });
    return { success: true, output: stdout || 'No matches found' };
  } catch (error) {
    return { success: false, output: error.message };
  }
}

async function toolRunTests() {
  try {
    // Detect test framework
    if (existsSync('package.json')) {
      const { stdout } = await execAsync('npm test', { timeout: 60000, maxBuffer: 1024 * 1024 });
      return { success: true, output: stdout };
    }
    if (existsSync('pytest.ini') || existsSync('setup.py') || existsSync('pyproject.toml')) {
      const { stdout } = await execAsync('pytest', { timeout: 60000, maxBuffer: 1024 * 1024 });
      return { success: true, output: stdout };
    }
    if (existsSync('Cargo.toml')) {
      const { stdout } = await execAsync('cargo test', { timeout: 120000, maxBuffer: 1024 * 1024 });
      return { success: true, output: stdout };
    }
    return { success: false, output: 'No test framework detected' };
  } catch (error) {
    return { success: false, output: error.stderr || error.message };
  }
}

async function toolBuild() {
  try {
    if (existsSync('package.json')) {
      const { stdout, stderr } = await execAsync('npm run build', { timeout: 120000, maxBuffer: 1024 * 1024 });
      return { success: true, output: stdout || stderr };
    }
    if (existsSync('Cargo.toml')) {
      const { stdout, stderr } = await execAsync('cargo build', { timeout: 300000, maxBuffer: 1024 * 1024 });
      return { success: true, output: stdout || stderr };
    }
    if (existsSync('Makefile')) {
      const { stdout, stderr } = await execAsync('make', { timeout: 300000, maxBuffer: 1024 * 1024 });
      return { success: true, output: stdout || stderr };
    }
    return { success: false, output: 'No build system detected' };
  } catch (error) {
    return { success: false, output: error.stderr || error.message };
  }
}

async function executeTool(toolCall, skipSafetyCheck = false, options = {}) {
  console.log(`\n🔧 [${toolCall.type}]`);

  // Safety check for bash commands
  if (toolCall.type === 'bash' && !skipSafetyCheck) {
    const danger = checkDangerousCommand(toolCall.command);
    if (danger) {
      const confirmed = await confirmDangerousCommand(toolCall.command, danger);
      if (!confirmed) {
        return { success: false, output: 'Command cancelled by user' };
      }
    }
  }

  switch (toolCall.type) {
    case 'bash':
      // Handle cd commands specially - update working directory
      if (toolCall.command.startsWith('cd ')) {
        const targetDir = toolCall.command.slice(3).trim();
        const { resolve } = await import('path');
        const { existsSync, statSync } = await import('fs');
        
        const newDir = resolve(options.cwd || process.cwd(), targetDir);
        if (existsSync(newDir) && statSync(newDir).isDirectory()) {
          options.cwd = newDir;
          return { success: true, output: newDir };
        } else {
          return { success: false, output: `Directory not found: ${newDir}` };
        }
      }
      return await toolBash(toolCall.command, { cwd: options.cwd });
    case 'read_file':
      return await toolReadFile(toolCall.path);
    case 'write_file':
      return await toolWriteFile(toolCall.path, toolCall.content);
    case 'append_file':
      return await toolAppendFile(toolCall.path, toolCall.content);
    case 'prepend_file':
      return await toolPrependFile(toolCall.path, toolCall.content);
    case 'replace_in_file':
      return await toolReplaceInFile(toolCall.path, toolCall.search, toolCall.replace);
    case 'move_file':
      return await toolMoveFile(toolCall.source, toolCall.dest);
    case 'copy_file':
      return await toolCopyFile(toolCall.source, toolCall.dest);
    case 'code_search':
      return await toolCodeSearch(toolCall.query, toolCall.directory);
    case 'run_tests':
      return await toolRunTests();
    case 'build':
      return await toolBuild();
    default:
      return { success: false, output: 'Unknown tool type' };
  }
}

// ============================================================================
// Unix→Windows Command Translation
// ============================================================================

function translateToWindows(command) {
  const isWindows = process.platform === 'win32';
  if (!isWindows) return command;
  
  // Exact command translations
  const exactMap = {
    'pwd': 'cd',
    'ls': 'dir',
    'ls -la': 'dir',
    'ls -l': 'dir',
    'ls -a': 'dir /a',
    'll': 'dir',
    'cat': 'type',
    'head': 'more',
    'tail': 'more',
    'grep': 'findstr',
    'find .': 'dir /s /b',
    'touch': 'type nul >',
    'rm': 'del',
    'rm -rf': 'rmdir /s /q',
    'rm -r': 'rmdir /s',
    'cp': 'copy',
    'mv': 'move',
    'mkdir': 'md',
    'rmdir': 'rmdir',
    'chmod': 'icacls',
    'ps': 'tasklist',
    'kill': 'taskkill',
    'whoami': 'whoami',
    'hostname': 'hostname',
    'date': 'date /t',
    'uptime': 'systeminfo | findstr /C:"System Boot Time"',
  };
  
  for (const [unix, win] of Object.entries(exactMap)) {
    if (command.toLowerCase() === unix.toLowerCase()) {
      return win;
    }
  }
  
  // Pattern translations
  if (command.toLowerCase().startsWith('ls ')) {
    return 'dir ' + command.slice(3);
  }
  
  if (command.toLowerCase().startsWith('cat ')) {
    return 'type ' + command.slice(4);
  }
  
  if (command.toLowerCase().startsWith('grep ')) {
    // grep -rn "pattern" . → findstr /s /i "pattern" .
    return command.replace(/grep\s+(-[a-zA-Z]+\s+)?/i, 'findstr /s /i ');
  }
  
  if (command.toLowerCase().startsWith('find ')) {
    // find . -name "*.ext" → dir /s /b *.ext
    const nameMatch = command.match(/find\s+\.?\s*-name\s+["']?\*?(\.[a-z0-9]+)["']?/i);
    if (nameMatch) {
      return `dir /s /b *${nameMatch[1]}`;
    }
    return command.replace(/^find\s/i, 'dir /s /b ');
  }
  
  if (command.toLowerCase().startsWith('git ')) {
    // Git commands work on Windows if git is installed
    return command;
  }
  
  return command;
}

// ============================================================================
// PLANNING MODE DETECTION
// ============================================================================

const PLANNING_TRIGGERS = [
  /\b(and|then|after|before|while)\b/i,           // Multi-step connectors
  /\b(show|tell|explain)\s+(me\s+)?(how|what|where|why|all)\b/i,  // Exploration
  /\b(all\s+(files?|items?|contents?))\b/i,       // "all files" pattern
  /\b(find|locate|search).+\b(and|then)\b/i,      // Search + action
  /\b(explore|investigate|analyze|debug)\b/i,      // Complex tasks
  /\b(setup|install|configure|build|deploy)\b/i,   // Multi-step operations
];

const MODES = {
  CHAT: 'chat',      // Just conversation
  TOOL: 'tool',      // Execute single command
  PLAN: 'plan',      // Multi-step planning
};

let currentMode = MODES.TOOL;  // Default to tool mode
let currentWorkingDir = process.cwd();  // Track working directory globally

function needsPlanning(input) {
  return PLANNING_TRIGGERS.some(p => p.test(input));
}

function parsePlan(llmResponse) {
  const steps = [];
  const lines = llmResponse.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Match numbered lists: "1. ls -la" or "1) ls -la" or "1 - ls -la"
    const match = trimmed.match(/^\s*(\d+)[\.\)\-]\s*(.+)$/);
    if (match) {
      let cmd = match[2].trim();
      
      // Remove parenthetical explanations
      cmd = cmd.replace(/\s*\(.*?\)\s*$/, '').trim();
      // Remove markdown formatting
      cmd = cmd.replace(/\*\*/g, '').replace(/`/g, '').trim();
      
      // Skip if too short or too long
      if (cmd.length < 3 || cmd.length > 200) continue;
      
      // Only accept lines that start with actual shell commands (including Windows)
      const commandStarters = /^(ls|find|cat|grep|git|dir|echo|cd|mkdir|touch|rm|cp|mv|Get-ChildItem|Select-String|Get-Content|xargs|head|tail|wc|pwd|type|more|findstr|md|del|copy|move|tasklist|taskkill|whoami|hostname|date)\b/i;
      
      if (commandStarters.test(cmd)) {
        steps.push(cmd);
      }
    }
  }

  return steps;
}

async function executePlan(originalInput, steps, workingDir = process.cwd()) {
  console.log(`\n📋 Executing ${steps.length} step plan...\n`);

  const results = [];
  let currentDir = workingDir;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`\n[Step ${i + 1}/${steps.length}] ${step}`);

    try {
      // Translate Unix commands to Windows
      const translatedStep = translateToWindows(step);
      if (translatedStep !== step) {
        console.log(`   🔄 Translated: ${step} → ${translatedStep}`);
      }
      
      const result = await executeTool({ type: 'bash', command: translatedStep }, false, { cwd: currentDir });
      
      // If cd succeeded, update working directory
      if (step.startsWith('cd ') && result.success) {
        currentDir = result.output;
        console.log(`📍 Changed to: ${currentDir}`);
      }
      
      console.log(`📋 ${result.output.split('\n')[0] || '(executed)'}`);
      results.push({ step, success: result.success, output: result.output });

      // Check if we should continue (ask LLM)
      if (i < steps.length - 1) {
        const checkResponse = await callLLM([{
          role: 'user',
          content: `Task: ${originalInput}\nCompleted step ${i + 1}/${steps.length}\nResult: ${result.output}\n\nShould we continue with remaining steps? Reply ONLY "yes" or "no".`
        }]);

        // Extract content from response object
        const answer = (checkResponse.content || checkResponse.full || '').toLowerCase();
        if (answer.includes('no')) {
          console.log('⏹️  Stopping plan execution');
          break;
        }
      }
    } catch (error) {
      console.log(`❌ Step failed: ${error.message}`);
      results.push({ step, success: false, output: error.message });
      break;
    }
  }

  return results;
}

async function handleComplexTask(input) {
  console.log('\n🧠 Complex task detected - creating plan...\n');

  // Step 1: Ask LLM to create a plan
  const planResponse = await callLLM([{
    role: 'user',
    content: `Task: ${input}

Give me a numbered list of shell commands to do this.

Use ONLY these Windows commands:
1. cd directory
2. dir
3. type filename
4. findstr /s /i "pattern" *.ext
5. git status

Format:
1. cd ../anchor-engine-node
2. dir
3. type package.json

Start with the numbered list.`
  }], { maxTokens: 256 });

  // Parse plan from the FULL response (thinking + content)
  const fullText = planResponse.full || planResponse.content || '';
  const steps = parsePlan(fullText);
  
  console.log('📝 Plan:');
  if (steps.length > 0) {
    steps.forEach((step, i) => console.log(`   ${i + 1}. ${step}`));
  } else {
    console.log('   Could not extract steps from response');
    console.log(`   Raw: ${fullText.slice(0, 100)}...`);
  }

  if (steps.length === 0) {
    console.log('⚠️  Could not parse plan from LLM response');
    console.log('💡 Response was:', planResponse.content.slice(0, 200));
    return null;
  }

  // Step 3: Execute the plan
  const results = await executePlan(input, steps);

  // Step 4: LLM summarizes results
  console.log('\n🤖 Summarizing results...\n');
  const summary = await callLLM([{
    role: 'user',
    content: `Original task: ${input}

Steps executed:
${results.map((r, i) => `${i + 1}. ${r.step}\n   Success: ${r.success}`).join('\n')}

Provide a brief summary of what was accomplished.`
  }]);

  return summary.content;
}

function truncateContext(messages, maxMessages) {
  if (messages.length <= maxMessages) {
    return messages;
  }
  // Keep the most recent messages
  return messages.slice(-maxMessages);
}

function saveSession(sessionId, messages) {
  try {
    const timestamp = new Date().toISOString();
    appendFileSync('sessions.log',
      `\n=== ${sessionId} @ ${timestamp} ===\n` +
      messages.map(m => `${m.role}: ${m.content}`).join('\n') +
      '\n'
    );
  } catch {}
}

// ============================================================================
// MAIN AGENT LOOP
// ============================================================================

async function runAgentLoop() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const messages = [];
  const sessionId = `session-${Date.now()}`;
  const voiceManager = new VoiceManager({ processInput: null }); // Will set below
  // currentWorkingDir is global - initialized above

  console.log('🤖 micro-nanobot v0.2.0 - Local Coding Agent');
  console.log(`📡 LLM: ${config.llmUrl} (${config.model})`);
  console.log(`📍 Working: ${currentWorkingDir}`);
  console.log('💡 Commands: /quit, /clear, /config, /tool, /plan, /chat, /code');
  console.log('📅 Schedule: /schedule, /schedules, /unschedule');
  console.log('🎤 Voice: /voice, /speak, /handsfree');
  console.log('🔧 Tools: /test (run tests), /build, /search <query>\n');
  console.log('📍 Mode: /tool (execute), /plan (multi-step), /chat (conversation), /code (smart)\n');

  // Create agent reference for voice manager
  const agent = {
    processInput: async (input) => {
      // This will be called from voice manager
      const trimmed = input.trim();
      await handleUserInput(trimmed, rl, messages, voiceManager);
    }
  };
  voiceManager.agent = agent;

  rl.on('close', () => {
    saveSession(sessionId, messages);
    console.log('\n👋 Goodbye!');
    process.exit(0);
  });

  while (true) {
    const userInput = await new Promise(resolve => {
      rl.question('👤 You: ', resolve);
    });

    await handleUserInput(userInput, rl, messages, voiceManager);
  }
}

async function handleUserInput(userInput, rl, messages, voiceManager) {
  const trimmed = userInput.trim();

  // Handle special commands
  if (trimmed === '/quit' || trimmed === '/exit') {
    rl.close();
    return;
  }

  if (trimmed === '/clear') {
    messages.length = 0;
    console.log('🗑️  Context cleared\n');
    return;
  }

  if (trimmed === '/config') {
    console.log('📋 Current config:', JSON.stringify(config, null, 2), '\n');
    return;
  }

  // Code agent commands
  if (trimmed === '/code') {
    currentMode = MODES.PLAN;
    console.log('💻 Mode: CODE (smart code-aware mode)\n');
    return;
  }

  if (trimmed === '/test' || trimmed.startsWith('/test ')) {
    console.log('🧪 Running tests...');
    const result = await toolRunTests();
    console.log(`📋 ${result.output}`);
    return;
  }

  if (trimmed === '/build') {
    console.log('🔨 Building project...');
    const result = await toolBuild();
    console.log(`📋 ${result.output}`);
    return;
  }

  if (trimmed.startsWith('/search ') || trimmed.startsWith('/grep ')) {
    const query = trimmed.replace(/^\/(search|grep)\s+/, '');
    console.log(`🔍 Searching for: ${query}`);
    const result = await toolCodeSearch(query);
    console.log(`📋 ${result.output}`);
    return;
  }

  // Voice commands
  if (trimmed === '/voice' || trimmed === '/voice on') {
    await voiceManager.enableVoiceMode();
    console.log('');
    return;
  }

  if (trimmed === '/voice off') {
    voiceManager.disableVoiceMode();
    console.log('');
    return;
  }

  if (trimmed === '/speak' || trimmed === '/speak on') {
    await voiceManager.enableSpeakResponses();
    console.log('');
    return;
  }

  if (trimmed === '/speak off') {
    voiceManager.disableSpeakResponses();
    console.log('');
    return;
  }

  if (trimmed === '/handsfree' || trimmed === '/handsfree on') {
    await voiceManager.enableHandsFree();
    console.log('');
    return;
  }

  if (trimmed === '/handsfree off') {
    voiceManager.disableHandsFree();
    console.log('');
    return;
  }

  // Check if this is a voice command
  if (voiceManager.voiceMode) {
    const isVoiceCmd = await voiceManager.processVoiceCommand(trimmed);
    if (isVoiceCmd) {
      console.log('');
      return;
    }

    // Listen for voice input
    const voiceText = await voiceManager.listenOnce();
    if (voiceText) {
      // Process the transcribed text
      await processCommand(voiceText, messages, voiceManager);
      console.log('');
      return;
    }
  }

  // Process regular command
  await processCommand(trimmed, messages, voiceManager);
  console.log('');
}

async function processCommand(input, messages, voiceManager) {
  const trimmed = input.trim();
  if (!trimmed) return;

  // Check for /t prefix (one-time tool mode)
  let useTool = currentMode === MODES.TOOL;
  let cmdInput = trimmed;
  if (trimmed.startsWith('/t ')) {
    useTool = true;
    cmdInput = trimmed.slice(3);
  }

  // STEP 1: Check if we should execute tools (direct intent match)
  if (useTool || currentMode === MODES.TOOL) {
    const intent = extractIntent(cmdInput);

    if (intent) {
      // Execute the intent directly (could be bash or any tool type)
      if (intent.type === 'bash') {
        console.log(`\n🎯 Intent: ${intent.command} (confidence: ${intent.confidence})`);
      } else {
        console.log(`\n🎯 Tool: ${intent.type} (confidence: ${intent.confidence})`);
      }
      console.log('🔧 Executing...');

      const result = await executeTool(intent, false, { cwd: currentWorkingDir });
      
      // If cd command succeeded, update working directory
      if (intent.command.startsWith('cd ') && result.success) {
        currentWorkingDir = result.output;
        console.log(`📍 Changed to: ${currentWorkingDir}`);
      }
      
      console.log(`📋 Result: ${result.output}`);

      if (voiceManager && voiceManager.speakResponses) {
        await voiceManager.speakResponse(`Executed: ${result.output.split('\n')[0]}`);
      }

      messages.length = 0;
      return;
    }
  }

  // STEP 1.5: Check for code-specific intents
  const codeIntent = extractCodeIntent(cmdInput);
  if (codeIntent && (currentMode === MODES.PLAN || currentMode === MODES.CHAT)) {
    console.log(`\n🎯 Code Intent: ${codeIntent.type}`);
    
    switch (codeIntent.type) {
      case 'run_tests':
        console.log('🧪 Running tests...');
        const testResult = await executeTool({ type: 'run_tests' });
        console.log(`📋 ${testResult.output}`);
        messages.length = 0;
        return;
      
      case 'build':
        console.log('🔨 Building...');
        const buildResult = await executeTool({ type: 'build' });
        console.log(`📋 ${buildResult.output}`);
        messages.length = 0;
        return;
      
      case 'code_search':
        console.log(`🔍 Searching for: ${codeIntent.query}`);
        const searchResult = await executeTool({ type: 'code_search', query: codeIntent.query });
        console.log(`📋 ${searchResult.output}`);
        messages.length = 0;
        return;
    }
  }

  // STEP 2: Check for complex task (planning mode)
  if (needsPlanning(cmdInput) || currentMode === MODES.PLAN) {
    const summary = await handleComplexTask(cmdInput);
    if (summary) {
      console.log(`\n💬 Summary:\n${summary}`);
      if (voiceManager && voiceManager.speakResponses) {
        await voiceManager.speakResponse(summary.split('\n')[0]);
      }
    }
    messages.length = 0;
    return;
  }

  // STEP 3: Chat mode - conversation
  messages.push({ role: 'user', content: cmdInput });
  console.log('🤔 Thinking...');

  try {
    const response = await callLLM(messages);
    const { reasoning, content: finalResponse, full } = response;
    
    // Show reasoning if present
    if (reasoning) {
      console.log(`\n💭 Thinking: ${reasoning.split('\n').slice(0, 3).join(' ')}...`);
    }
    
    console.log(`\n💬 ${finalResponse}`);
    
    // NEW: Check if model response IS a shell command
    const trimmedResponse = finalResponse.trim();
    const isShellCommand = /^(ls|cat|pwd|date|echo|mkdir|touch|rm|cp|mv|cd|grep|find|head|tail|wc|ps|free|df|du|uptime|whoami|hostname|git|npm|node|python|bash|sh|dir|Get-ChildItem|Get-Content|Get-Location|type|findstr|more|tasklist|taskkill|md|del|copy|move)\b/i.test(trimmedResponse);
    
    if (isShellCommand) {
      // Translate Unix commands to Windows equivalents
      let command = translateToWindows(trimmedResponse);
      
      if (command !== trimmedResponse) {
        console.log(`\n   🔄 Translated: ${trimmedResponse} → ${command}`);
      }
      
      console.log(`\n🎯 Model output is a command, executing...`);
      const result = await executeTool({ type: 'bash', command }, false, { cwd: currentWorkingDir });
      
      // If cd command succeeded, update working directory
      if (command.startsWith('cd ') && result.success) {
        currentWorkingDir = result.output;
        console.log(`📍 Changed to: ${currentWorkingDir}`);
      }
      
      console.log(`📋 Result: ${result.output}`);
      messages.length = 0;
      return;
    }
    
    // NEW: Check if model triggered any tools
    const toolResults = await executeModelToolCalls(response, executeTool);
    if (toolResults) {
      console.log(`\n📋 Tool Results:`);
      toolResults.forEach((tr, i) => {
        console.log(`   ${i + 1}. ${tr.result.output.split('\n')[0]}`);
      });
      
      // Feed results back to model for summary
      console.log('\n🔄 Generating summary...');
      const summary = await callLLM([
        ...messages,
        { role: 'assistant', content: full },
        { role: 'user', content: `Tools executed:\n${toolResults.map(tr => tr.result.output).join('\n')}\n\nSummarize what was done.` }
      ]);
      console.log(`\n💬 Summary: ${summary.content}`);
    }
    
    messages.push({ role: 'assistant', content: full });

    if (voiceManager && voiceManager.speakResponses) {
      await voiceManager.speakResponse(finalResponse);
    }
  } catch (e) {
    console.log(`❌ Error: ${e.message}`);
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

runAgentLoop().catch(error => {
  console.error('💥 Fatal:', error.message);
  process.exit(1);
});
