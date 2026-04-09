#!/usr/bin/env node

/**
 * Automated Test V2 - Using CODE tasks instead of daily routines
 */

import { spawn } from 'child_process';
import { existsSync, writeFileSync } from 'fs';

const LLAMA_SERVER = 'C:\\Users\\rsbiiw\\llama.cpp\\build\\bin\\Release\\llama-server.exe';
const MODEL = 'C:\\Users\\rsbiiw\\Projects\\models\\Qwen3.5-4B-heretic.Q4_K_M.gguf';
const PORT = 8086;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// CODE-related test cases
const TEST_CASES = [
  {
    name: 'List project files',
    input: 'show me all files and directories in this project',
    expectPlanning: true,
    minSteps: 1,
  },
  {
    name: 'Find config files',
    input: 'find all JSON config files and show their contents',
    expectPlanning: true,
    minSteps: 2,
  },
  {
    name: 'Check git status',
    input: 'check git status and show recent commits',
    expectPlanning: true,
    minSteps: 2,
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
        { role: 'system', content: 'You are a coding assistant. When asked to do multiple things, give numbered commands.' },
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

function parsePlan(llmResponse) {
  const steps = [];
  const lines = llmResponse.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    const match = trimmed.match(/^\s*(\d+)[\.\)\-]\s*(.+)$/);
    if (match) {
      let cmd = match[2].trim();
      cmd = cmd.replace(/\s*\(.*?\)\s*$/, '').trim();
      cmd = cmd.replace(/\*\*/g, '').replace(/`/g, '').trim();
      
      if (cmd.length < 3 || cmd.length > 200) continue;
      
      const commandStarters = /^(ls|find|cat|grep|git|dir|echo|cd|mkdir|touch|rm|cp|mv|Get-ChildItem|Select-String|Get-Content|xargs|head|tail|wc|pwd)\b/i;
      
      if (commandStarters.test(cmd)) {
        steps.push(cmd);
      }
    }
  }

  return steps;
}

function needsPlanning(input) {
  const triggers = [
    /\b(and|then|after|before|while)\b/i,
    /\b(show|tell|explain)\s+(me\s+)?(how|what|where|why|all)\b/i,
    /\b(all\s+(files?|items?|contents?|directories?))\b/i,
    /\b(find|locate|search).+\b(and|then)\b/i,
    /\b(explore|investigate|analyze|debug)\b/i,
    /\b(setup|install|configure|build|deploy)\b/i,
  ];
  return triggers.some(p => p.test(input));
}

async function runTest(testCase, testNum) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST ${testNum}: ${testCase.name}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`👤 Input: "${testCase.input}"`);
  console.log(`🎯 Expected planning: ${testCase.expectPlanning ? 'YES' : 'NO'}`);

  const detectedPlanning = needsPlanning(testCase.input);
  console.log(`🧠 Planning detected: ${detectedPlanning ? 'YES' : 'NO'}`);

  if (!testCase.expectPlanning || !detectedPlanning) {
    if (!testCase.expectPlanning && !detectedPlanning) {
      console.log(`✅ PASS: Correctly identified as simple`);
      return { name: testCase.name, passed: true };
    } else {
      console.log(`❌ FAIL: Planning mismatch`);
      return { name: testCase.name, passed: false };
    }
  }

  try {
    console.log('\n📝 Requesting plan...');
    const planResponse = await callLLM(
      `Task: ${testCase.input}\n\nGive me numbered shell commands to do this:\n\n1. <first command>\n2. <second command>\n\nStart with the numbered list. No explanations.`,
      512
    );
    
    console.log(`\n💬 Response (${planResponse.content.length} chars, reasoning: ${planResponse.reasoning.length} chars):`);
    const displayContent = planResponse.content || planResponse.reasoning || '(EMPTY)';
    console.log(`${displayContent.split('\n').slice(0, 10).join('\n')}`);
    
    // Parse from BOTH content AND reasoning
    const steps = parsePlan(planResponse.full);
    console.log(`\n📋 Parsed ${steps.length} step(s):`);
    steps.forEach((step, i) => console.log(`   ${i + 1}. ${step}`));
    
    writeFileSync(`test-v2-output-${testNum}.txt`, planResponse.full);
    
    const passed = steps.length >= testCase.minSteps;
    console.log(`\n${passed ? '✅ PASS' : '❌ FAIL'}: ${passed ? `Got ${steps.length} steps` : `Expected >= ${testCase.minSteps}, got ${steps.length}`}`);
    
    return { name: testCase.name, passed, steps: steps.length, details: steps };
  } catch (error) {
    console.log(`\n❌ ERROR: ${error.message}`);
    return { name: testCase.name, passed: false, error: error.message };
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Automated Planning Test V2 - CODE TASKS              ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (!existsSync(MODEL)) {
    console.log(`❌ Model not found: ${MODEL}`);
    process.exit(1);
  }

  console.log('🚀 Starting llama-server...');
  const server = spawn(LLAMA_SERVER, [
    '-m', MODEL, '--port', String(PORT), '--ctx-size', '8192', '--threads', '4',
  ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });

  const ready = await waitForServer(BASE_URL);
  if (!ready) {
    console.log('❌ Server failed to start');
    server.kill();
    process.exit(1);
  }
  console.log('✅ Server ready\n');

  const results = [];
  for (let i = 0; i < TEST_CASES.length; i++) {
    results.push(await runTest(TEST_CASES[i], i + 1));
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n\n' + '═'.repeat(70));
  console.log('TEST SUMMARY');
  console.log('═'.repeat(70));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  results.forEach((r, i) => {
    console.log(`${r.passed ? '✅' : '❌'} Test ${i + 1}: ${r.name}`);
    if (r.steps !== undefined) console.log(`   → ${r.steps} step(s)`);
  });
  
  console.log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log('═'.repeat(70));

  server.kill();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
