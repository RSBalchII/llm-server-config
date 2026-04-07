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
import MemoryManager from './memory.js';
import ContextManager from './context-manager.js';

const execAsync = promisify(exec);

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG = {
  llmUrl: 'http://127.0.0.1:8080',
  model: 'qwen-3.5-2b',
  maxContext: 10,
  systemPrompt: `COMMAND MODE ONLY. Output ONLY the shell command. NO words before or after.

User: list files
Assistant: ls -la

User: show date
Assistant: date

User: current directory
Assistant: pwd

User: ${new Date().toLocaleTimeString()}
Assistant:`,
  temperature: 0.01,  // Nearly deterministic
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

async function callLLM(contextManager, currentInput) {
  try {
    // Get chunked context
    const context = contextManager.getContextForLLM(currentInput);
    
    const response = await fetch(`${config.llmUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: context }
        ],
        stream: false,
        max_tokens: 512,  // Reduced for faster response
        temperature: config.temperature || 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
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
  // Create file without "file" keyword
  { pattern: /\b(create|make)\s+(\S+)\s+with\s+(.+)\s*$/i,
    handler: (m) => `echo "${m[2]}" > ${m[3]}` },
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
      const command = intent.handler(match);
      if (command) {
        return { type: 'bash', command, confidence: 'high' };
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

async function toolBash(command) {
  try {
    const { stdout, stderr } = await execAsync(command, { 
      timeout: 30000,
      maxBuffer: 1024 * 1024 
    });
    return { success: true, output: stdout || stderr };
  } catch (error) {
    return { 
      success: false, 
      output: error.message || stderr 
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

async function executeTool(toolCall, skipSafetyCheck = false) {
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
      return await toolBash(toolCall.command);
    case 'read_file':
      return await toolReadFile(toolCall.path);
    case 'write_file':
      return await toolWriteFile(toolCall.path, toolCall.content);
    default:
      return { success: false, output: 'Unknown tool type' };
  }
}

// ============================================================================
// PLANNING MODE DETECTION
// ============================================================================

const PLANNING_TRIGGERS = [
  /\b(and|then|after|before|while)\b/i,           // Multi-step connectors
  /\b(show|tell|explain)\s+(me\s+)?(how|what|where|why)\b/i,  // Exploration
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

function needsPlanning(input) {
  return PLANNING_TRIGGERS.some(p => p.test(input));
}

function parsePlan(llmResponse) {
  // Extract numbered steps from LLM response
  const steps = [];
  const lines = llmResponse.split('\n');
  
  for (const line of lines) {
    // Match: "1. ls -la" or "1) ls -la" or "- ls -la"
    const match = line.match(/^\s*[\d\-\*]\.?\s*(.+)$/);
    if (match) {
      const cmd = match[1].trim();
      // Extract command if it's in format "ls -la (description)"
      const cmdMatch = cmd.match(/^([a-z]+\s+.+?)\s*\(/i);
      if (cmdMatch) {
        steps.push(cmdMatch[1].trim());
      } else if (!cmd.includes('(') && cmd.length < 100) {
        steps.push(cmd);
      }
    }
  }
  
  return steps;
}

async function executePlan(originalInput, steps) {
  console.log(`\n📋 Executing ${steps.length} step plan...\n`);
  
  const results = [];
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`\n[Step ${i + 1}/${steps.length}] ${step}`);
    
    try {
      const result = await executeTool({ type: 'bash', command: step });
      console.log(`📋 ${result.output.split('\n')[0] || '(executed)'}`);
      results.push({ step, success: result.success, output: result.output });
      
      // Check if we should continue (ask LLM)
      if (i < steps.length - 1) {
        const checkResponse = await callLLM([{
          role: 'user',
          content: `Task: ${originalInput}\nCompleted step ${i + 1}/${steps.length}\nResult: ${result.output}\n\nShould we continue with remaining steps? Reply ONLY "yes" or "no".`
        }]);
        
        if (checkResponse.toLowerCase().includes('no')) {
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
  const planPrompt = await callLLM([{
    role: 'user',
    content: `Task: ${input}

Create a step-by-step plan with shell commands to accomplish this task.
Format each step as: command (brief explanation)

Example:
1. find . -type d -name "AEN" (find the project directory)
2. cd ./AEN && ls -la (enter and list contents)
3. ls -d */ (show subdirectories)

Keep commands simple and safe. Maximum 5 steps.`
  }]);
  
  console.log('📝 Plan:\n', planPrompt.split('\n').slice(0, 10).join('\n'));
  
  // Step 2: Parse the plan
  const steps = parsePlan(planPrompt);
  
  if (steps.length === 0) {
    console.log('⚠️  Could not parse plan from LLM response');
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
${results.map((r, i) => `${i + 1}. ${r.step}\n   Result: ${r.output.slice(0, 200)}`).join('\n')}

Provide a clear, helpful summary of what was found/accomplished.`
  }]);
  
  return summary;
}

function truncateContext(messages, maxMessages) {
  if (messages.length <= maxMessages) {
    return messages;
  }
  // Keep the most recent messages
  return messages.slice(-maxMessages);
}

function saveSession(sessionId, contextManager) {
  try {
    const timestamp = new Date().toISOString();
    const stats = contextManager.getStats();
    appendFileSync('sessions.log', 
      `\n=== ${sessionId} @ ${timestamp} ===\n` +
      `Total turns: ${stats.totalTurns}, Estimated tokens: ${stats.estimatedTokens}\n`
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

  const contextManager = new ContextManager({
    maxActive: 3,
    maxSummarized: 7,
  });
  
  const voiceManager = new VoiceManager({ processInput: null });
  const memoryManager = new MemoryManager({
    aen: {
      baseUrl: 'http://127.0.0.1:3160',
      agentUrl: 'http://127.0.0.1:3161',
    },
    maxShortTerm: 10,
  });

  // Initialize memory and context
  await memoryManager.initialize();

  console.log('🤖 micro-nanobot v0.1.0');
  console.log(`📡 LLM: ${config.llmUrl} (${config.model})`);
  console.log('💡 Commands: /quit, /clear, /config, /tool, /plan, /chat');
  console.log('📅 Schedule: /schedule, /schedules, /unschedule');
  console.log('🎤 Voice: /voice, /speak, /handsfree');
  console.log('🧠 Memory: /memory (show stats)');
  console.log('📊 Context: /context (show token estimate)\n');
  console.log('📍 Mode: /tool (execute), /plan (multi-step), /chat (conversation)\n');

  const sessionId = `session-${Date.now()}`;

  // Create agent reference for voice manager
  const agent = {
    processInput: async (input) => {
      const trimmed = input.trim();
      await handleUserInput(trimmed, rl, contextManager, voiceManager, memoryManager);
    }
  };
  voiceManager.agent = agent;

  rl.on('close', () => {
    saveSession(sessionId, contextManager);
    console.log('\n👋 Goodbye!');
    process.exit(0);
  });

  while (true) {
    const userInput = await new Promise(resolve => {
      rl.question('👤 You: ', resolve);
    });

    await handleUserInput(userInput, rl, contextManager, voiceManager, memoryManager);
  }
}

async function handleUserInput(userInput, rl, contextManager, voiceManager, memoryManager) {
  const trimmed = userInput.trim();

  // Handle special commands
  if (trimmed === '/quit' || trimmed === '/exit') {
    rl.close();
    return;
  }

  if (trimmed === '/clear') {
    contextManager.clear();
    memoryManager.clear();
    console.log('🗑️  Context and memory cleared\n');
    return;
  }

  if (trimmed === '/context') {
    const stats = contextManager.getStats();
    console.log('📊 Context Stats:');
    console.log(`   Total turns: ${stats.totalTurns}`);
    console.log(`   Active (full): ${stats.activeTurns} turns`);
    console.log(`   Summarized: ${stats.summarizedTurns} turns`);
    console.log(`   Estimated tokens: ${stats.estimatedTokens}`);
    console.log(`   System prompt: ~${stats.systemPromptTokens} tokens`);
    console.log('');
    return;
  }

  if (trimmed === '/config') {
    console.log('📋 Current config:', JSON.stringify(config, null, 2), '\n');
    return;
  }

  if (trimmed === '/memory') {
    const stats = await memoryManager.stats();
    console.log('🧠 Memory Stats:');
    console.log(`   Short-term: ${stats.shortTerm} turns`);
    if (stats.markdown) {
      console.log(`   Markdown: ${stats.markdown.totalTurns || 0} turns, ${stats.markdown.fileSize || '0 KB'}`);
    }
    if (stats.aen) {
      console.log(`   AEN: ${JSON.stringify(stats.aen, null, 2)}`);
    }
    console.log('');
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
      await processCommand(voiceText, contextManager, voiceManager, memoryManager);
      console.log('');
      return;
    }
  }

  // Process regular command
  await processCommand(trimmed, contextManager, voiceManager, memoryManager);
  console.log('');
}

async function processCommand(input, contextManager, voiceManager, memoryManager) {
  const trimmed = input.trim();
  if (!trimmed) return;

  // Check for /t prefix (one-time tool mode)
  let useTool = currentMode === MODES.TOOL;
  let cmdInput = trimmed;
  if (trimmed.startsWith('/t ')) {
    useTool = true;
    cmdInput = trimmed.slice(3);
  }

  // STEP 1: Check if we should execute tools
  if (useTool || currentMode === MODES.TOOL) {
    const intent = extractIntent(cmdInput);

    if (intent) {
      // We understood the intent - execute directly
      console.log(`\n🎯 Intent: ${intent.command} (confidence: ${intent.confidence})`);
      console.log('🔧 Executing...');

      const result = await executeTool({ type: 'bash', command: intent.command });
      console.log(`📋 Result: ${result.output}`);

      // Add to context manager
      await contextManager.addTurn(cmdInput, `Executed: ${intent.command}\nResult: ${result.output.split('\n')[0]}`);

      // Store in memory
      if (memoryManager) {
        await memoryManager.storeTurn(cmdInput, `Executed: ${intent.command}\nResult: ${result.output.split('\n')[0]}`);
      }

      // Speak response if enabled
      if (voiceManager && voiceManager.speakResponses) {
        await voiceManager.speakResponse(`Command executed: ${intent.command}. ${result.output.split('\n')[0]}`);
      }

      return;
    } else {
      // Debug: No intent matched
      // console.log(`[DEBUG] No intent matched for: ${cmdInput}`);
    }
  }

  // STEP 2: Check for complex task (planning mode)
  if (needsPlanning(cmdInput) || currentMode === MODES.PLAN) {
    const summary = await handleComplexTask(cmdInput);
    if (summary) {
      console.log(`\n💬 Summary:\n${summary}`);
      
      // Add to context
      await contextManager.addTurn(cmdInput, summary);
      
      // Speak summary if enabled
      if (voiceManager && voiceManager.speakResponses) {
        await voiceManager.speakResponse(summary.split('\n')[0]);
      }
    }
    return;
  }

  // STEP 3: Chat mode - just conversation
  console.log('🤔 Thinking...');
  
  try {
    const response = await callLLM(contextManager, cmdInput);
    console.log(`\n💬 ${response}`);
    
    // Add to context
    await contextManager.addTurn(cmdInput, response);
    
    // Store in memory
    if (memoryManager) {
      await memoryManager.storeTurn(cmdInput, response);
    }
    
    // Speak response if enabled
    if (voiceManager && voiceManager.speakResponses) {
      await voiceManager.speakResponse(response);
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
