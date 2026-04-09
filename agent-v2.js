#!/usr/bin/env node
/**
 * micro-nanobot Agent v2
 * Structured tool calling (OpenAI format) - like Qwen Code
 */

import { exec } from 'child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, appendFileSync } from 'fs';
import { createInterface } from 'readline';
import { promisify } from 'util';
import { resolve, dirname, basename, join } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const rl = createInterface({ input: process.stdin, output: process.stdout });

// ============================================================================
// CONFIG
// ============================================================================

const CONFIG = {
  llmUrl: process.env.LLAMA_URL || 'http://127.0.0.1:8080',  // Proxy, not llama-server
  systemPrompt: `You are a local coding agent with access to filesystem tools.

When the user asks you to do something:
- Use the appropriate tool to accomplish the task
- After seeing tool results, provide a concise summary
- No explanations about what you "will" do - just act
- Keep responses brief and focused`,
  maxTurns: 10  // Prevent infinite loops
};

// ============================================================================
// TOOL DEFINITIONS (OpenAI format - exactly like Qwen Code sends)
// ============================================================================

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'run_shell_command',
      description: 'Execute a shell command and return the output',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to execute'
          },
          cwd: {
            type: 'string',
            description: 'Working directory for the command (optional)'
          }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: 'List the contents of a directory. Returns filenames and directories.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Directory path to list (absolute or relative)'
          }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file. Use for viewing file contents.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path to read'
          }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file. Creates the file if it does not exist, overwrites if it exists.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path to write'
          },
          content: {
            type: 'string',
            description: 'Content to write to the file'
          }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'grep_search',
      description: 'Search for a pattern in files. Like grep.',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Search pattern (regex supported)'
          },
          path: {
            type: 'string',
            description: 'Directory to search in (default: current directory)'
          },
          glob: {
            type: 'string',
            description: 'File glob pattern to filter (e.g., "*.js")'
          }
        },
        required: ['pattern']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'glob_search',
      description: 'Find files matching a glob pattern.',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Glob pattern (e.g., "**/*.js", "src/**/*.ts")'
          },
          path: {
            type: 'string',
            description: 'Directory to search in (default: current directory)'
          }
        },
        required: ['pattern']
      }
    }
  }
];

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

const TOOL_HANDLERS = {
  async run_shell_command(args) {
    try {
      const cwd = args.cwd || process.cwd();
      const { stdout, stderr } = await execAsync(args.command, {
        timeout: 30000,
        maxBuffer: 1024 * 1024 * 10,
        cwd
      });
      return { success: true, output: stdout || stderr || '(no output)' };
    } catch (error) {
      return { success: false, output: error.stderr || error.message };
    }
  },

  async list_directory(args) {
    try {
      const absPath = resolve(args.path);
      if (!existsSync(absPath)) {
        return { success: false, output: `Path not found: ${args.path}` };
      }
      if (!statSync(absPath).isDirectory()) {
        return { success: false, output: `Not a directory: ${args.path}` };
      }
      const entries = readdirSync(absPath, { withFileTypes: true });
      const lines = entries.map(e => {
        const type = e.isDirectory() ? '📁' : '📄';
        return `${type} ${e.name}`;
      });
      return { success: true, output: `Contents of ${absPath}:\n${lines.join('\n')}` };
    } catch (error) {
      return { success: false, output: error.message };
    }
  },

  async read_file(args) {
    try {
      const absPath = resolve(args.path);
      if (!existsSync(absPath)) {
        return { success: false, output: `File not found: ${args.path}` };
      }
      const stat = statSync(absPath);
      if (stat.size > 100000) {
        return { success: false, output: `File too large (${stat.size} bytes). Use grep_search instead.` };
      }
      const content = readFileSync(absPath, 'utf-8');
      return { success: true, output: content };
    } catch (error) {
      return { success: false, output: error.message };
    }
  },

  async write_file(args) {
    try {
      const absPath = resolve(args.path);
      const dir = dirname(absPath);
      if (!existsSync(dir)) {
        return { success: false, output: `Directory not found: ${dir}` };
      }
      writeFileSync(absPath, args.content, 'utf-8');
      return { success: true, output: `Written ${args.path} (${args.content.length} bytes)` };
    } catch (error) {
      return { success: false, output: error.message };
    }
  },

  async grep_search(args) {
    try {
      const searchPath = args.path || '.';
      const globArg = args.glob ? `--glob "${args.glob}"` : '';
      const cmd = `cd "${searchPath}" && grep -rn "${args.pattern}" . ${globArg} | head -100`;
      const { stdout } = await execAsync(cmd, {
        timeout: 10000,
        maxBuffer: 1024 * 1024 * 5
      });
      return { success: true, output: stdout || 'No matches found' };
    } catch (error) {
      return { success: false, output: error.stderr || error.message };
    }
  },

  async glob_search(args) {
    try {
      const searchPath = args.path || '.';
      const { stdout } = await execAsync(`cd "${searchPath}" && dir /s /b "${args.pattern}"`, {
        timeout: 10000,
        maxBuffer: 1024 * 1024 * 5
      });
      const files = stdout.trim().split('\n').filter(f => f);
      return { success: true, output: files.length > 0
        ? `Found ${files.length} files:\n${files.join('\n')}`
        : 'No files found' };
    } catch (error) {
      return { success: false, output: 'No files found' };
    }
  }
};

// ============================================================================
// LLM CLIENT (structured tool calling)
// ============================================================================

async function callLLM(messages) {
  // Get model name from proxy endpoint
  let modelName = 'model.gguf';
  try {
    const res = await fetch(`${CONFIG.llmUrl}/v1/models`);
    if (res.ok) {
      const data = await res.json();
      modelName = data.data?.[0]?.id || modelName;
    }
  } catch {}

  const response = await fetch(`${CONFIG.llmUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: 'system', content: CONFIG.systemPrompt },
        ...messages
      ],
      tools: TOOLS,
      tool_choice: 'auto',
      stream: false,
      temperature: 0.4,
      max_tokens: 4096
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM HTTP ${response.status}: ${err}`);
  }

  return response.json();
}

// ============================================================================
// TOOL EXECUTION LOOP (exactly like Qwen Code)
// ============================================================================

async function toolLoop(userInput) {
  const messages = [{ role: 'user', content: userInput }];
  let turnCount = 0;

  while (turnCount < CONFIG.maxTurns) {
    turnCount++;

    // Step 1: Call LLM with tools
    const data = await callLLM(messages);
    const message = data.choices?.[0]?.message;
    if (!message) {
      console.log('❌ No response from model');
      return;
    }

    // Step 2: Check for tool calls
    const toolCalls = message.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      // No tools - final response, print it
      if (message.content) {
        console.log('\n' + message.content);
      }
      return;
    }

    // Step 3: Execute each tool
    console.log(`\n📞 Turn ${turnCount}: ${toolCalls.length} tool(s)`);

    // Add assistant message with tool_calls
    messages.push(message);

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);

      console.log(`   🔧 ${toolName}(${JSON.stringify(toolArgs)})`);

      // Execute tool
      const handler = TOOL_HANDLERS[toolName];
      if (!handler) {
        console.log(`   ❌ Unknown tool: ${toolName}`);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: `Error: Unknown tool "${toolName}"`
        });
        continue;
      }

      const result = await handler(toolArgs);
      console.log(`   ${result.success ? '✅' : '❌'} ${result.output.substring(0, 80)}...`);

      // Feed result back
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result.output
      });
    }

    // Loop continues - LLM will see tool results and either:
    // - Call more tools
    // - Generate final response
  }

  console.log(`\n⚠️  Max turns (${CONFIG.maxTurns}) reached`);
}

// ============================================================================
// REPL
// ============================================================================

async function main() {
  console.log('══════════════════════════════════════════════');
  console.log('  micro-nanobot Agent v2');
  console.log('══════════════════════════════════════════════');
  console.log(`  LLM: ${CONFIG.llmUrl}`);
  console.log(`  Tools: ${TOOLS.length} available`);
  console.log('');
  console.log('  Available Tools:');
  for (const tool of TOOLS) {
    const fn = tool.function;
    console.log(`  • ${fn.name.padEnd(20)} ${fn.description}`);
  }
  console.log('══════════════════════════════════════════════');
  console.log('');

  while (true) {
    const input = await new Promise(resolve => {
      rl.question('> ', answer => resolve(answer.trim()));
    });

    if (!input) continue;
    if (input === 'quit' || input === 'exit') break;

    try {
      await toolLoop(input);
    } catch (error) {
      console.log(`\n❌ Error: ${error.message}`);
    }

    console.log('');
  }

  rl.close();
}

main().catch(e => { console.error(e); process.exit(1); });
