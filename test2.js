#!/usr/bin/env node

// Test with lenient parser for small models

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const config = {
  llmUrl: 'http://127.0.0.1:8080',
  systemPrompt: `You are a command executor. Respond with ONLY a shell command, nothing else.

Examples:
User: list files → ls -la  
User: show date → date
User: make dir → mkdir newdir`
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
      max_tokens: 64,
      temperature: 0.1,  // Low temp for more deterministic output
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

function isCommand(text) {
  // Simple heuristic: short responses without sentences are likely commands
  const lower = text.toLowerCase();
  const hasSentence = text.includes('.') || text.includes('I ') || text.includes('you ') || text.includes('can ') || text.includes('will ');
  const isShort = text.length < 50;
  const hasCommonCmd = /^(ls|cat|echo|pwd|date|touch|mkdir|rm|cp|mv|cd|whoami|uptime|free|df|ps|kill|git|npm|node|python|bash|sh|vim|nano|less|head|tail|grep|find|wc|sort|uniq|cut|awk|sed)\b/.test(lower);
  
  return isShort && !hasSentence && hasCommonCmd;
}

async function test() {
  console.log('🧪 Testing Qwen 3.5 for command generation\n');
  
  const tests = [
    'list files',
    'show current date',
    'show me your environment'
  ];
  
  for (const prompt of tests) {
    console.log(`\n📝 Prompt: ${prompt}`);
    console.log('🤔 Thinking...');
    
    try {
      const response = await callLLM(prompt);
      console.log(`🤖 Response: "${response}"`);
      
      if (isCommand(response)) {
        console.log('✅ Detected as command');
        try {
          const { stdout, stderr } = await execAsync(response);
          console.log(`📋 Output: ${(stdout || stderr || '(no output)').split('\n')[0]}`);
        } catch (e) {
          console.log(`⚠️  Command error: ${e.message.split('\n')[0]}`);
        }
      } else {
        console.log('❌ Not recognized as command (too chatty)');
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n✅ Test complete!');
}

test();
