#!/usr/bin/env node

/**
 * A/B Test: Bare Command Detection
 * Tests if the system correctly identifies when the model outputs a raw shell command
 * and executes it instead of treating it as chat.
 */

import { spawn } from 'child_process';
import { existsSync, writeFileSync } from 'fs';

const LLAMA_SERVER = 'C:\\Users\\rsbiiw\\llama.cpp\\build\\bin\\Release\\llama-server.exe';
const MODEL = 'C:\\Users\\rsbiiw\\Projects\\models\\Qwen3.5-4B-heretic.Q4_K_M.gguf';
const PORT = 8090;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Test cases: model should output a bare command
const BARE_COMMAND_TESTS = [
  {
    name: 'Current directory',
    input: 'what directory are we in?',
    expectedCmd: /^pwd$/i,
    isCommand: true,
  },
  {
    name: 'List files',
    input: 'list the files here',
    expectedCmd: /^ls\s+-la/i,
    isCommand: true,
  },
  {
    name: 'Git status',
    input: 'check git status',
    expectedCmd: /^git\s+status/i,
    isCommand: true,
  },
  {
    name: 'Show date',
    input: 'what is the current date?',
    expectedCmd: /^date/i,
    isCommand: true,
  },
  {
    name: 'Greeting (NOT a command)',
    input: 'hi! how are you?',
    expectedCmd: null,
    isCommand: false,
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

async function callLLM(prompt, maxTokens = 128) {
  const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: `You are a local coding agent. Be direct and concise.

For tool execution: output ONLY the shell command, nothing else.
For conversation: output ONLY your response.

User: list files
Assistant: ls -la

User: what directory are we in
Assistant: pwd

User: hi
Assistant: Hello! How can I help?`
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

// Check if response is a shell command
function isShellCommand(response) {
  const trimmed = response.trim();
  const commands = [
    'ls', 'cat', 'pwd', 'date', 'echo', 'mkdir', 'touch', 'rm', 'cp', 'mv', 'cd',
    'grep', 'find', 'head', 'tail', 'wc', 'ps', 'free', 'df', 'du', 'uptime',
    'whoami', 'hostname', 'git', 'npm', 'node', 'python', 'bash', 'sh',
    'dir', 'Get-ChildItem', 'Get-Content', 'Get-Location'
  ];
  return commands.some(cmd => trimmed.toLowerCase().startsWith(cmd.toLowerCase()));
}

// Run test
async function runTest(testCase, testNum) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST ${testNum}: ${testCase.name}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`👤 Input: "${testCase.input}"`);
  console.log(`🎯 Expected command: ${testCase.isCommand ? 'YES' : 'NO'}`);
  console.log('─'.repeat(70));

  try {
    const response = await callLLM(testCase.input, 128);
    
    console.log(`\n💭 Reasoning: ${response.reasoning ? 'YES (' + response.reasoning.length + ' chars)' : 'NO'}`);
    console.log(`\n💬 Response (${response.content.length} chars):`);
    console.log(`   "${response.content.trim()}"`);
    
    const detected = isShellCommand(response.content);
    console.log(`\n🔧 Detected as command: ${detected ? 'YES' : 'NO'}`);
    
    if (testCase.isCommand) {
      if (detected) {
        console.log(`✅ PASS: Correctly identified as command`);
        return { name: testCase.name, passed: true, content: response.content.trim() };
      } else {
        console.log(`❌ FAIL: Should be command but wasn't detected`);
        return { name: testCase.name, passed: false, content: response.content.trim() };
      }
    } else {
      if (!detected) {
        console.log(`✅ PASS: Correctly identified as NOT a command`);
        return { name: testCase.name, passed: true, content: response.content.trim() };
      } else {
        console.log(`❌ FAIL: Should NOT be command but was detected as one`);
        return { name: testCase.name, passed: false, content: response.content.trim() };
      }
    }
  } catch (error) {
    console.log(`\n❌ ERROR: ${error.message}`);
    return { name: testCase.name, passed: false, error: error.message };
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   A/B Test: Bare Command Detection                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (!existsSync(MODEL)) {
    console.log(`❌ Model not found: ${MODEL}`);
    process.exit(1);
  }

  console.log('🚀 Starting llama-server...');
  const server = spawn(LLAMA_SERVER, [
    '-m', MODEL, '--port', String(PORT), '--ctx-size', '4096', '--threads', '4'
  ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });

  const ready = await waitForServer(BASE_URL);
  if (!ready) {
    console.log('❌ Server failed to start');
    server.kill();
    process.exit(1);
  }
  console.log('✅ Server ready\n');

  const results = [];
  for (let i = 0; i < BARE_COMMAND_TESTS.length; i++) {
    results.push(await runTest(BARE_COMMAND_TESTS[i], i + 1));
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n\n' + '═'.repeat(70));
  console.log('TEST SUMMARY');
  console.log('═'.repeat(70));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  results.forEach((r, i) => {
    console.log(`${r.passed ? '✅' : '❌'} Test ${i + 1}: ${r.name}`);
    console.log(`   → "${r.content}"`);
    if (r.error) console.log(`   → Error: ${r.error}`);
  });
  
  console.log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log('═'.repeat(70));

  writeFileSync('test-bare-command-results.json', JSON.stringify(results, null, 2));
  console.log('\n📁 Results saved to: test-bare-command-results.json');

  server.kill();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
