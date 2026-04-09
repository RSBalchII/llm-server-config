#!/usr/bin/env node

/**
 * End-to-End Test Suite for micro-nanobot
 * Tests all tools with different models to ensure universal compatibility
 */

import { spawn } from 'child_process';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

const MODELS_DIR = 'C:\\Users\\rsbiiw\\Projects\\models';
const LLAMA_SERVER = 'C:\\Users\\rsbiiw\\llama.cpp\\build\\bin\\Release\\llama-server.exe';

// Test models - Qwen 4B, Gemma, new Qwen 7B distill
const TEST_MODELS = [
  { id: 1, name: 'Qwen3.5-4B-Q4_K_M', file: 'Qwen3.5-4B-heretic.Q4_K_M.gguf' },
  { id: 6, name: 'Gemma-4-E4B-Heretic', file: 'gemma-4-E4B-it-Heretic-ARA-Refusals5_Q4_K_M.gguf' },
  { id: 2, name: 'Qwen7B-Obliteratus-IQ4', file: 'DeepSeek-R1-Distill-Qwen-7B-abliterated-obliteratus.IQ4_XS.gguf' },
];

// Test suite
const TOOL_TESTS = [
  {
    category: 'Directory Navigation',
    tests: [
      {
        name: 'Current directory',
        input: 'what directory are we in?',
        expectCmd: /^pwd$/i,
        expectSuccess: true,
      },
      {
        name: 'Change directory',
        input: 'cd ..',
        expectCmd: /^cd\s+\.\./i,
        expectSuccess: true,
      },
      {
        name: 'List directory contents',
        input: 'ls',
        expectCmd: /^ls|dir/i,
        expectSuccess: true,
      },
    ],
  },
  {
    category: 'File Operations',
    tests: [
      {
        name: 'Read file contents',
        input: 'read package.json',
        expectCmd: /cat|type.*package\.json/i,
        expectSuccess: true,
      },
      {
        name: 'Create new file',
        input: 'create a file called test.txt with "hello world"',
        expectCmd: /echo.*test\.txt/i,
        expectSuccess: true,
      },
      {
        name: 'Append to file',
        input: 'append "new line" to test.txt',
        expectType: 'append_file',
        expectSuccess: true,
      },
    ],
  },
  {
    category: 'Code Search',
    tests: [
      {
        name: 'Search for function',
        input: 'search for "function" in all JS files',
        expectCmd: /grep|findstr.*function/i,
        expectSuccess: true,
      },
      {
        name: 'Find specific file',
        input: 'find all JSON config files',
        expectCmd: /find|dir.*\.json/i,
        expectSuccess: true,
      },
    ],
  },
  {
    category: 'Git Operations',
    tests: [
      {
        name: 'Git status',
        input: 'check git status',
        expectCmd: /^git\s+status/i,
        expectSuccess: true,
      },
      {
        name: 'Git log',
        input: 'show recent git commits',
        expectCmd: /^git\s+log/i,
        expectSuccess: true,
      },
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

async function callLLM(port, prompt, maxTokens = 256) {
  const response = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: `You are a local coding agent.

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

function extractCommand(response) {
  let text = response.content.trim();
  
  // Remove markdown code blocks
  text = text.replace(/```(?:\w+)?\s*([\s\S]*?)\s*```/g, '$1');
  
  // Remove inline backticks
  text = text.replace(/`([^`]+)`/g, '$1');
  
  // Extract first line that looks like a command
  const lines = text.split('\n').filter(l => l.trim());
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Check if line starts with a command
    const commands = [
      'ls', 'cat', 'pwd', 'date', 'echo', 'mkdir', 'touch', 'rm', 'cp', 'mv', 'cd',
      'grep', 'find', 'head', 'tail', 'wc', 'ps', 'free', 'df', 'du', 'uptime',
      'whoami', 'hostname', 'git', 'npm', 'node', 'python', 'bash', 'sh',
      'dir', 'Get-ChildItem', 'Get-Content', 'Get-Location', 'type', 'findstr', 'more'
    ];
    
    for (const cmd of commands) {
      if (trimmed.toLowerCase().startsWith(cmd.toLowerCase())) {
        // Return just the command line, not the full response
        return { type: 'bash', command: trimmed };
      }
    }
  }
  
  // Check for "I'll X: command" pattern
  const match = text.match(/I'll\s+\w+[^:]*:\s*(.+)/i);
  if (match) {
    return { type: 'bash', command: match[1].trim() };
  }
  
  return null;
}

async function testModel(model, port) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`Testing: ${model.name}`);
  console.log(`${'═'.repeat(70)}\n`);
  
  const results = { model: model.name, passed: 0, failed: 0, tests: [] };
  
  for (const category of TOOL_TESTS) {
    console.log(`\n📂 ${category.category}`);
    console.log('─'.repeat(60));
    
    for (const test of category.tests) {
      process.stdout.write(`  ${test.name}... `);
      
      try {
        const response = await callLLM(port, test.input);
        const cmd = extractCommand(response);
        
        if (!cmd) {
          console.log(`❌ FAIL (no command detected)`);
          results.failed++;
          results.tests.push({ ...test, passed: false, error: 'No command detected' });
          continue;
        }
        
        if (test.expectCmd && !test.expectCmd.test(cmd.command)) {
          console.log(`❌ FAIL (wrong command: "${cmd.command}")`);
          results.failed++;
          results.tests.push({ ...test, passed: false, error: `Wrong command: ${cmd.command}` });
          continue;
        }
        
        console.log(`✅ PASS ("${cmd.command}")`);
        results.passed++;
        results.tests.push({ ...test, passed: true, command: cmd.command });
      } catch (error) {
        console.log(`❌ ERROR: ${error.message}`);
        results.failed++;
        results.tests.push({ ...test, passed: false, error: error.message });
      }
    }
  }
  
  return results;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   End-to-End Test Suite for micro-nanobot              ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  
  const allResults = [];
  
  for (const model of TEST_MODELS) {
    const modelPath = join(MODELS_DIR, model.file);
    if (!existsSync(modelPath)) {
      console.log(`⚠️  Skipping ${model.name} - not found`);
      continue;
    }
    
    const port = 8090 + TEST_MODELS.indexOf(model);
    console.log(`\n🚀 Starting server for ${model.name} on port ${port}...`);
    
    const server = spawn(LLAMA_SERVER, [
      '-m', modelPath, '--port', String(port), '--ctx-size', '8192', '--threads', '4'
    ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    
    const ready = await waitForServer(`http://127.0.0.1:${port}`);
    if (!ready) {
      console.log(`❌ Failed to start ${model.name}`);
      server.kill();
      continue;
    }
    console.log(`✅ Server ready\n`);
    
    const results = await testModel(model, port);
    allResults.push(results);
    
    server.kill();
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Summary
  console.log('\n\n' + '═'.repeat(70));
  console.log('OVERALL RESULTS');
  console.log('═'.repeat(70));
  
  let totalPassed = 0, totalFailed = 0;
  
  for (const result of allResults) {
    console.log(`\n📊 ${result.model}`);
    console.log(`   Passed: ${result.passed}/${result.passed + result.failed}`);
    console.log(`   Success Rate: ${((result.passed / (result.passed + result.failed)) * 100).toFixed(1)}%`);
    totalPassed += result.passed;
    totalFailed += result.failed;
  }
  
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`Total: ${totalPassed + totalFailed} | Passed: ${totalPassed} | Failed: ${totalFailed}`);
  console.log(`Overall Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);
  console.log('═'.repeat(70));
  
  // Save results
  const outputDir = resolve('test-results');
  if (!existsSync(outputDir)) mkdirSync(outputDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(join(outputDir, `e2e-${timestamp}.json`), JSON.stringify(allResults, null, 2));
  
  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch(console.error);
