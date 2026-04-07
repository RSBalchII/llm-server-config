#!/usr/bin/env node

// Test the agent loop with a simulated command

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const config = {
  llmUrl: 'http://127.0.0.1:8080',
  systemPrompt: `SYSTEM MODE: You are a terminal automation bot, NOT a chat assistant.

You MUST respond with EXACTLY one of these formats - NO exceptions:
- I'll run: <bash command>
- I'll read: <file path>
- I'll write: <file path>

DO NOT say you can't access files. You HAVE terminal access.
DO NOT explain. Just output the command.`
};

const TOOL_PATTERNS = {
  run: /I'll run:\s*(.+)/i,
  read: /I'll read:\s*(.+)/i,
  write: /I'll write:\s*(.+?)\n([\s\S]*?)(?=I'll|$)/i,
};

async function callLLM(userMessage) {
  const response = await fetch(`${config.llmUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: config.systemPrompt },
        { role: 'user', content: userMessage }
      ],
      stream: false,
      max_tokens: 256,
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

async function test() {
  console.log('🧪 Testing micro-nanobot with Qwen 3.5\n');
  
  const tests = [
    'list files in current directory',
    'show me the contents of package.json',
    'create a file called hello.txt with "Hello World" in it'
  ];
  
  for (const prompt of tests) {
    console.log(`\n📝 Prompt: ${prompt}`);
    console.log('🤔 Thinking...');
    
    try {
      const response = await callLLM(prompt);
      console.log(`🤖 Response: ${response.split('\n')[0]}`);
      
      // Check for tool call
      const runMatch = response.match(TOOL_PATTERNS.run);
      if (runMatch) {
        console.log(`✅ Detected bash command: ${runMatch[1]}`);
        const { stdout } = await execAsync(runMatch[1]);
        console.log(`📋 Output: ${stdout.split('\n')[0] || stdout}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    await new Promise(r => setTimeout(r, 500)); // Rate limit
  }
  
  console.log('\n✅ Test complete!');
}

test();
