#!/usr/bin/env node

/**
 * Automated Planning Mode Test
 * Starts the server, sends test prompts, and assesses outputs
 */

import { spawn, exec } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Config
const LLAMA_SERVER = 'C:\\Users\\rsbiiw\\llama.cpp\\build\\bin\\Release\\llama-server.exe';
const MODEL = 'C:\\Users\\rsbiiw\\Projects\\models\\Qwen3.5-4B-heretic.Q4_K_M.gguf';
const PORT = 8085; // Use different port to avoid conflicts
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Test cases
const TEST_CASES = [
  {
    name: 'Simple daily routine',
    input: 'brush teeth and clean room in the morning',
    expectPlanning: true,
    minSteps: 1,
  },
  {
    name: 'List files request',
    input: 'show me all files in this directory',
    expectPlanning: true,
    minSteps: 1,
  },
  {
    name: 'Simple greeting',
    input: 'hi! how are you?',
    expectPlanning: false,
  },
];

// Helper: wait for server to be ready
async function waitForServer(url, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) {
        console.log('✅ Server ready');
        return true;
      }
    } catch (e) {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, 1000));
    process.stdout.write('.');
  }
  console.log('\n❌ Server failed to start');
  return false;
}

// Helper: Call LLM API
async function callLLM(prompt, maxTokens = 512) {
  const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'You are a local coding agent. Think through the problem, then provide your final answer.' },
        { role: 'user', content: prompt }
      ],
      stream: false,
      max_tokens: maxTokens,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM HTTP ${response.status}`);
  }

  const data = await response.json();
  const reasoning = data.choices[0].message.reasoning_content || '';
  const content = data.choices[0].message.content || '';
  return { reasoning, content, full: reasoning + '\n' + content };
}

// Extract thinking and response
function extractThinkingAndResponse(content) {
  let thinking = '';
  let response = content.trim();
  
  const patterns = [
    { open: '<|begin_of_thought|>', close: '<|end_of_thought|>' },
    { open: '<think>', close: '</think' + '>' },
  ];
  
  for (const { open, close } of patterns) {
    if (content.includes(open)) {
      const openIdx = content.indexOf(open);
      const closeIdx = content.indexOf(close, openIdx + open.length);
      if (closeIdx !== -1) {
        thinking = content.slice(openIdx + open.length, closeIdx).trim();
        response = content.slice(closeIdx + close.length).trim();
      }
      break;
    }
  }
  
  return { thinking, response };
}

// Parse plan from response
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
      
      if (cmd.length > 0 && cmd.length < 200) {
        const skipWords = ['okay', 'sure', 'let me', 'i think', 'i should', 'the user', 'looking'];
        const isConversational = skipWords.some(w => cmd.toLowerCase().startsWith(w));
        
        if (!isConversational) {
          steps.push(cmd);
        }
      }
    }
  }

  return steps;
}

// Detect if input needs planning
function needsPlanning(input) {
  const triggers = [
    /\b(and|then|after|before|while)\b/i,
    /\b(show|tell|explain)\s+(me\s+)?(how|what|where|why|all)\b/i,
    /\b(all\s+(files?|items?|contents?))\b/i,
    /\b(find|locate|search).+\b(and|then)\b/i,
    /\b(explore|investigate|analyze|debug)\b/i,
    /\b(setup|install|configure|build|deploy)\b/i,
  ];
  return triggers.some(p => p.test(input));
}

// Run a single test
async function runTest(testCase, testNum) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST ${testNum}: ${testCase.name}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`👤 Input: "${testCase.input}"`);
  console.log(`🎯 Expected planning: ${testCase.expectPlanning ? 'YES' : 'NO'}`);
  console.log('─'.repeat(70));

  try {
    // Step 1: Get LLM response
    console.log('\n📡 Calling LLM...');
    const response = await callLLM(testCase.input, 1024);
    
    console.log(`\n💭 Reasoning: ${response.reasoning ? 'YES (' + response.reasoning.length + ' chars)' : 'NO'}`);
    if (response.reasoning) {
      console.log(`   Preview: ${response.reasoning.split('\n').slice(0, 2).join(' | ')}...`);
    }
    
    console.log(`\n💬 Final response:`);
    console.log(`   ${response.content.split('\n').slice(0, 5).join('\n   ')}`);
    
    // Step 2: Check if planning was expected
    const detectedPlanning = needsPlanning(testCase.input);
    console.log(`\n🧠 Planning detected: ${detectedPlanning ? 'YES' : 'NO'}`);
    
    if (testCase.expectPlanning && detectedPlanning) {
      // Step 3: Ask for plan
      console.log('\n📝 Requesting plan from LLM...');
      const planResponse = await callLLM(
        `Task: ${testCase.input}\n\nGive me numbered shell commands to do this:\n\n1. <first command>\n2. <second command>\n\nUse these commands:\n- ls -la (list files)\n- dir (Windows directory)\n- echo "text" (print text)\n- Get-ChildItem (Windows file list)\n\nStart your response with the numbered list. No explanations.`,
        512
      );
      
      const steps = parsePlan(planResponse.full);  // Parse from FULL response
      console.log(`\n📋 Parsed ${steps.length} step(s):`);
      steps.forEach((step, i) => {
        console.log(`   ${i + 1}. ${step}`);
      });
      
      // Assess
      const passed = steps.length >= (testCase.minSteps || 1);
      console.log(`\n${passed ? '✅ PASS' : '❌ FAIL'}: ${passed ? `Got ${steps.length} steps (>= ${testCase.minSteps})` : `Expected >= ${testCase.minSteps} steps, got ${steps.length}`}`);
      
      // Save full response for debugging
      writeFileSync(`test-output-${testNum}-full.txt`, planResponse.full);
      writeFileSync(`test-output-${testNum}-content.txt`, planResponse.content);
      writeFileSync(`test-output-${testNum}-reasoning.txt`, planResponse.reasoning);
      
      return { name: testCase.name, passed, steps: steps.length, details: steps };
    } else if (!testCase.expectPlanning && !detectedPlanning) {
      console.log(`\n✅ PASS: Correctly identified as simple conversation`);
      return { name: testCase.name, passed: true, steps: 0 };
    } else {
      console.log(`\n❌ FAIL: Planning mismatch (expected: ${testCase.expectPlanning}, detected: ${detectedPlanning})`);
      return { name: testCase.name, passed: false, steps: 0 };
    }
  } catch (error) {
    console.log(`\n❌ ERROR: ${error.message}`);
    return { name: testCase.name, passed: false, error: error.message };
  }
}

// Main test runner
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Automated Planning Mode Test Suite                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Check if model exists
  if (!existsSync(MODEL)) {
    console.log(`❌ Model not found: ${MODEL}`);
    process.exit(1);
  }

  // Start llama-server
  console.log('🚀 Starting llama-server...');
  console.log(`   Model: Qwen3.5-4B-heretic`);
  console.log(`   Port: ${PORT}\n`);

  const server = spawn(LLAMA_SERVER, [
    '-m', MODEL,
    '--port', String(PORT),
    '--ctx-size', '8192',
    '--threads', '4',
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  server.stdout.on('data', (data) => {
    const text = data.toString();
    if (text.includes('starting')) {
      console.log('   Server starting...');
    }
  });

  server.stderr.on('data', (data) => {
    const text = data.toString();
    if (text.includes('error') || text.includes('Error')) {
      console.error(`   ❌ Server error: ${text.trim()}`);
    }
  });

  // Wait for server
  const ready = await waitForServer(BASE_URL);
  if (!ready) {
    console.log('❌ Failed to start server');
    server.kill();
    process.exit(1);
  }

  // Run tests
  console.log('\n' + '─'.repeat(70));
  const results = [];
  
  for (let i = 0; i < TEST_CASES.length; i++) {
    const result = await runTest(TEST_CASES[i], i + 1);
    results.push(result);
    
    // Small delay between tests
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
    if (r.steps) console.log(`   → ${r.steps} step(s) parsed`);
    if (r.error) console.log(`   → Error: ${r.error}`);
  });
  
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log('═'.repeat(70));

  // Cleanup
  console.log('\n🛑 Stopping server...');
  server.kill();
  
  console.log('\n📁 Test outputs saved to:');
  console.log('   - test-output-*-full.txt (full LLM responses)');
  console.log('   - test-output-*-plan.txt (plan generation responses)');
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
