#!/usr/bin/env node

const config = {
  llmUrl: 'http://127.0.0.1:8080',
  systemPrompt: `You have terminal access. Respond ONLY with exact format:

I'll run: <command>

Example user request: "list files"
Your response: I'll run: ls -la

Example user request: "show /etc/hosts"  
Your response: I'll run: cat /etc/hosts

Always start with "I'll run:" followed by the command.`
};

async function test() {
  console.log('🧪 Testing LLM connection...\n');
  
  try {
    const response = await fetch(`${config.llmUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: config.systemPrompt },
          { role: 'user', content: 'List the files in the current directory' }
        ],
        stream: false,
        max_tokens: 256,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Response:', data.choices[0].message.content);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();
