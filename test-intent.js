#!/usr/bin/env node

// Test intent parser

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const INTENT_PATTERNS = [
  { pattern: /\b(list|show|see|find|look\s+at|get|display)\s*(files|dir|directory|contents|items)?\s*(in\s+)?(current\s+)?(dir|directory)?\s*$/i, 
    handler: (m) => `ls -la` },
  { pattern: /\b(list|show)\s+(dirs|directories|folders)\s*(in\s+)?(current\s+)?(dir|directory)?\s*$/i,
    handler: (m) => `find . -maxdepth 1 -type d` },
  { pattern: /\b(show|read|display|cat)\s+(the\s+)?(contents?|file)?\s*(of\s+)?([^\s.]+\.[^\s.]+|\S+)\s*$/i,
    handler: (m) => `cat ${m[5].trim()}` },
  { pattern: /\b(create|make|write|save)\s+(a\s+)?file\s+(called|named|as)?\s+(\S+)\s+(with|containing|that\s+says)\s+(.+)\s*$/i,
    handler: (m) => `echo "${m[6]}" > ${m[4]}` },
  { pattern: /\b(create|make|touch)\s+(a\s+)?(file\s+)?(called|named|as)?\s+(\S+)\s*$/i,
    handler: (m) => `touch ${m[5]}` },
  // "create X with Y" without "file" keyword
  { pattern: /\b(create|make)\s+(\S+)\s+with\s+(.+)\s*$/i,
    handler: (m) => `echo "${m[3]}" > ${m[2]}` },
  // "what is my X" pattern
  { pattern: /\bwhat\s+(is|'s)\s+(my|the|your)\s+(user|name|username|hostname|pwd|directory|path|home|ip|address)\s*$/i,
    handler: (m) => ({ user: 'whoami', username: 'whoami', name: 'whoami', hostname: 'hostname', pwd: 'pwd', directory: 'pwd', path: 'echo $PATH', home: 'echo $HOME', ip: 'hostname -I 2>/dev/null || echo "N/A"', address: 'hostname -I 2>/dev/null || echo "N/A"' }[m[3].toLowerCase()]) },
  { pattern: /\b(what'?s|what\s+is|show|check|get)\s+(my\s+|the\s+|your\s+)?(user|whoami|pwd|date|time|hostname|system|os|uptime|path|home)\b/i,
    handler: (m) => ({ user: 'whoami', whoami: 'whoami', pwd: 'pwd', date: 'date', time: 'date +%T', hostname: 'hostname', system: 'uname -a', os: 'cat /etc/os-release 2>/dev/null || echo Android', uptime: 'uptime', path: 'echo $PATH', home: 'echo $HOME' }[m[3]?.toLowerCase()]) },
  { pattern: /\b(disk|storage|memory|ram|cpu|processes?)\s*(info|usage|free|space)?/i,
    handler: (m) => ({ disk: 'df -h /data', storage: 'df -h /data', memory: 'free -h', ram: 'free -h', cpu: 'top -bn1 | head -5', processes: 'ps aux | head -10' }[m[1]?.toLowerCase()]) },
  { pattern: /\b(help|what\s+can\s+(you|u)\s+do|commands)\b/i,
    handler: (m) => 'echo "Commands: list files, show <file>, create <file> with <content>, system info, disk/memory/cpu"' },
];

function extractIntent(userText) {
  for (const intent of INTENT_PATTERNS) {
    const match = userText.match(intent.pattern);
    if (match) {
      const command = intent.handler(match);
      if (command) return { type: 'bash', command, confidence: 'high' };
    }
  }
  const trimmed = userText.trim();
  if (/^(ls|cat|pwd|date|echo|mkdir|touch|rm|cp|mv|cd|grep|find|head|tail|wc|ps|free|df|du|uptime|whoami|git|npm|node)\b/.test(trimmed)) {
    return { type: 'bash', command: trimmed, confidence: 'medium' };
  }
  return null;
}

async function test(prompt) {
  console.log(`\n📝 User: ${prompt}`);
  const intent = extractIntent(prompt);
  if (intent) {
    console.log(`🎯 Intent: ${intent.command} (${intent.confidence})`);
    try {
      const { stdout, stderr } = await execAsync(intent.command);
      console.log(`📋 Output: ${(stdout || stderr || '(no output)').trim()}`);
    } catch (e) {
      console.log(`⚠️  Error: ${e.message.split('\n')[0]}`);
    }
  } else {
    console.log('❌ No intent matched');
  }
}

console.log('🧪 Testing Intent Parser\n');
await test('list files');
await test('show directories');
await test('what is my user');
await test('disk usage');
await test('create test.txt with hello world');
await test('help');
console.log('\n✅ Done!');
