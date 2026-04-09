#!/usr/bin/env node

/**
 * A/B Test: Model-Triggered Tool Use
 * Tests if the model can naturally decide to use tools
 * by parsing its responses for tool call patterns
 */

import { spawn } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const LLAMA_SERVER = 'C:\\Users\\rsbiiw\\llama.cpp\\build\\bin\\Release\\llama-server.exe';
const MODEL = 'C:\\Users\\rsbiiw\\Projects\\models\\Qwen3.5-4B-heretic.Q4_K_M.gguf';
const PORT = 8089;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Test cases: situations where model SHOULD trigger tools
const TOOL_TRIGGER_TESTS = [
  {
    name: 'File listing request',
    input: 'show me the contents of my current directory',
    expectedTool: 'list_files',
    toolPatterns: [
      /ls\s+-la/i,
      /dir/i,
      /Get-ChildItem/i,
      /list\s+files/i,
    ],
  },
  {
    name: 'File reading request',
    input: 'read the contents of package.json',
    expectedTool: 'read_file',
    toolPatterns: [
      /cat\s+package\.json/i,
      /read.*package\.json/i,
      /show.*package\.json/i,
    ],
  },
  {
    name: 'Search request',
    input: 'search for "function" in all JS files',
    expectedTool: 'code_search',
    toolPatterns: [
      /grep.*function/i,
      /rg.*function/i,
      /search.*function/i,
      /find.*function/i,
    ],
  },
  {
    name: 'Git status request',
    input: 'what is the git status?',
    expectedTool: 'git_status',
    toolPatterns: [
      /git\s+status/i,
      /check.*git.*status/i,
    ],
  },
  {
    name: 'File creation request',
    input: 'create a file called test.txt with hello world',
    expectedTool: 'write_file',
    toolPatterns: [
      /echo.*>.*test\.txt/i,
      /create.*test\.txt/i,
      /write.*test\.txt/i,
    ],
  },
];

async function waitForServer(url, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return true;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 1000));
    process.stdout.write('.');
  }
  return false;
}

async function callLLM(prompt, maxTokens = 512) {
  const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: `You are a local coding agent. You have access to these tools:

TOOL INSTRUCTIONS:
- To list files: say "I'll list files" then use: ls -la OR Get-ChildItem
- To read file: say "I'll read" then use: cat filename OR Get-Content filename
- To search: say "I'll search" then use: grep -r "pattern" .
- To create file: say "I'll create" then use: echo "content" > filename
- To run tests: say "I'll run tests" then use: npm test OR pytest
- To build: say "I'll build" then use: npm run build

When the user asks you to do something, first state what tool you'll use, then give the command.

Example:
User: show me files
Assistant: I'll list files: ls -la

User: read config.json
Assistant: I'll read: cat config.json`
        },
        { role: 'user', content: prompt }
      ],
      stream: false,
      max_tokens: maxTokens,
      temperature: 0.4,
    }),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const reasoning = data.choices[0].message.reasoning_content || '';
  const content = data.choices[0].message.content || '';
  return { reasoning, content, full: reasoning + '\n' + content };
}

// Parse model response for tool calls
function extractToolCall(response) {
  const text = response.full;
  
  // Look for tool trigger patterns
  const toolPatterns = [
    // "I'll list files: ls -la"
    /I'll\s+(list|read|search|create|run|build)[^:]*:\s*(.+)/i,
    // "I will use: command"
    /I\s+will\s+(?:use|run|execute)[^:]*:\s*(.+)/i,
    // Direct command in backticks
    /`([^`]+)`/,
    // "First, let me run: command"
    /let\s+me\s+(run|list|read|search|create)[^:]*:\s*(.+)/i,
  ];
  
  for (const pattern of toolPatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        action: match[1],
        command: match[2] || match[0],
        full: match[0],
      };
    }
  }
  
  return null;
}

// Run a single test
async function runTest(testCase, testNum) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST ${testNum}: ${testCase.name}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`👤 Input: "${testCase.input}"`);
  console.log(`🎯 Expected tool: ${testCase.expectedTool}`);
  console.log('─'.repeat(70));

  try {
    // Get model response
    console.log('\n📡 Calling LLM...');
    const response = await callLLM(testCase.input, 512);
    
    console.log(`\n💬 Response (${response.content.length} chars):`);
    console.log(response.content.split('\n').slice(0, 8).join('\n'));
    
    // Extract tool call
    const toolCall = extractToolCall(response);
    
    if (toolCall) {
      console.log(`\n🔧 Tool call detected:`);
      console.log(`   Action: ${toolCall.action}`);
      console.log(`   Command: ${toolCall.command}`);
      
      // Check if it matches expected patterns
      const matched = testCase.toolPatterns.some(p => p.test(response.full));
      
      if (matched) {
        console.log(`\n✅ PASS: Model triggered tool correctly`);
        return { name: testCase.name, passed: true, toolCall };
      } else {
        console.log(`\n❌ FAIL: Tool detected but didn't match expected patterns`);
        return { name: testCase.name, passed: false, toolCall };
      }
    } else {
      console.log(`\n❌ FAIL: No tool call detected in response`);
      return { name: testCase.name, passed: false };
    }
  } catch (error) {
    console.log(`\n❌ ERROR: ${error.message}`);
    return { name: testCase.name, passed: false, error: error.message };
  }
}

// Main test runner
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   A/B Test: Model-Triggered Tool Use                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (!existsSync(MODEL)) {
    console.log(`❌ Model not found: ${MODEL}`);
    process.exit(1);
  }

  // Start llama-server
  console.log('🚀 Starting llama-server...');
  console.log(`   Model: Qwen3.5-4B-heretic`);
  console.log(`   Port: ${PORT}\n`);

  const server = spawn(LLAMA_SERVER, [
    '-m', MODEL, '--port', String(PORT), '--ctx-size', '8192', '--threads', '4'
  ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });

  const ready = await waitForServer(BASE_URL);
  if (!ready) {
    console.log('❌ Server failed to start');
    server.kill();
    process.exit(1);
  }
  console.log('✅ Server ready\n');

  // Run tests
  const results = [];
  for (let i = 0; i < TOOL_TRIGGER_TESTS.length; i++) {
    results.push(await runTest(TOOL_TRIGGER_TESTS[i], i + 1));
    await new Promise(r => setTimeout(r, 2000));
  }

  // Summary
  console.log('\n\n' + '═'.repeat(70));
  console.log('TEST SUMMARY');
  console.log('═'.repeat(70));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  results.forEach((r, i) => {
    console.log(`${r.passed ? '✅' : '❌'} Test ${i + 1}: ${r.name}`);
    if (r.toolCall) console.log(`   → Action: ${r.toolCall.action}`);
    if (r.error) console.log(`   → Error: ${r.error}`);
  });
  
  console.log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log('═'.repeat(70));

  // Save results
  writeFileSync('test-tool-trigger-results.json', JSON.stringify(results, null, 2));
  console.log('\n📁 Results saved to: test-tool-trigger-results.json');

  server.kill();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
