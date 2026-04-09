// Quick API test - does the model respond at all?

const PORT = 8087;
const MODEL = 'C:\\Users\\rsbiiw\\Projects\\models\\Qwen3.5-4B-heretic.Q4_K_M.gguf';
const LLAMA_SERVER = 'C:\\Users\\rsbiiw\\llama.cpp\\build\\bin\\Release\\llama-server.exe';

import { spawn } from 'child_process';

console.log('Starting server on port', PORT);

const server = spawn(LLAMA_SERVER, [
  '-m', MODEL, '--port', String(PORT), '--ctx-size', '4096', '--threads', '4'
], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });

// Wait for server
for (let i = 0; i < 30; i++) {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/health`);
    if (res.ok) break;
  } catch (e) {}
  process.stdout.write('.');
  await new Promise(r => setTimeout(r, 1000));
}
console.log('\n✅ Server ready\n');

// Test 1: Simple chat
console.log('Test 1: Simple greeting');
const response1 = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hi! How are you?' }
    ],
    stream: false,
    max_tokens: 128,
    temperature: 0.4,
  }),
});

const data1 = await response1.json();
console.log('Status:', response1.status);
console.log('Response:', JSON.stringify(data1, null, 2));
console.log('Content:', data1.choices?.[0]?.message?.content || '(EMPTY)');

// Test 2: Numbered list request
console.log('\n\nTest 2: Numbered commands');
const response2 = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'system', content: 'You are a coding assistant. Give numbered shell commands.' },
      { role: 'user', content: 'Show me how to list files and check git status' }
    ],
    stream: false,
    max_tokens: 256,
    temperature: 0.4,
  }),
});

const data2 = await response2.json();
console.log('Status:', response2.status);
console.log('Content:', data2.choices?.[0]?.message?.content || '(EMPTY)');

server.kill();
