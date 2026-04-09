#!/usr/bin/env node
/**
 * micro-nanobot API Server with Tool Support
 * OpenAI-compatible proxy for llama-server with tool execution
 */

import { createServer } from 'http';
import { exec } from 'child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { promisify } from 'util';
import { join } from 'path';

const PROXY_PORT = 8080;
const LLAMA_PORT = 8081;
// Model name from env var or hardcoded default (update when model changes)
const MODEL_NAME = 'Qwen3.5-4B-heretic.Q4_K_M.gguf';
const execAsync = promisify(exec);

// ── Tool definitions ─────────────────────────────────────────────
const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'run_shell_command',
            description: 'Execute a shell command',
            parameters: {
                type: 'object',
                properties: {
                    command: { type: 'string', description: 'Command to execute' }
                },
                required: ['command']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_directory',
            description: 'List directory contents',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Directory path' }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'read_file',
            description: 'Read file contents',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'File path' }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'grep_search',
            description: 'Search for text in files',
            parameters: {
                type: 'object',
                properties: {
                    pattern: { type: 'string', description: 'Search pattern' },
                    path: { type: 'string', description: 'Directory to search in' }
                },
                required: ['pattern']
            }
        }
    }
];

// ── Execute tool ─────────────────────────────────────────────────
async function executeTool(name, args) {
    try {
        switch (name) {
            case 'run_shell_command': {
                const { stdout } = await execAsync(args.command, { maxBuffer: 1024 * 1024 * 10 });
                return { success: true, output: stdout };
            }
            case 'list_directory': {
                const path = args.path || '.';
                if (!existsSync(path)) return { success: false, output: `Path not found: ${path}` };
                const files = readdirSync(path);
                return { success: true, output: files.join('\n') };
            }
            case 'read_file': {
                if (!existsSync(args.path)) return { success: false, output: `File not found: ${args.path}` };
                const content = readFileSync(args.path, 'utf-8');
                return { success: true, output: content.substring(0, 10000) };
            }
            case 'grep_search': {
                const pattern = args.pattern;
                const path = args.path || '.';
                const { stdout } = await execAsync(`findstr /s /i "${pattern}" *`, { 
                    cwd: path, 
                    maxBuffer: 1024 * 1024 * 10 
                });
                return { success: true, output: stdout.substring(0, 10000) || 'No matches' };
            }
            default:
                return { success: false, output: `Unknown tool: ${name}` };
        }
    } catch (error) {
        return { success: false, output: error.message };
    }
}

// ── Chat completion with tool support ────────────────────────────
async function chatCompletion(body) {
    // Add tools to request
    body.tools = TOOLS;
    if (!body.tool_choice) body.tool_choice = 'auto';

    // Request to llama-server
    const res1 = await fetch(`http://127.0.0.1:${LLAMA_PORT}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const data1 = await res1.json();

    // Check if model wants to use tools (structured format)
    const message = data1.choices?.[0]?.message;
    if (message?.tool_calls) {
        console.log(`🔧 Tool call: ${message.tool_calls.length} tools`);

        // Execute each tool
        for (const toolCall of message.tool_calls) {
            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments);

            console.log(`   → ${toolName}(${JSON.stringify(toolArgs)})`);
            const result = await executeTool(toolName, toolArgs);
            console.log(`   ← ${result.success ? '✓' : '✗'} ${result.output.substring(0, 100)}`);

            // Add tool result to conversation
            body.messages.push(message);
            body.messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: result.output
            });
        }

        // Second request with tool results
        const res2 = await fetch(`http://127.0.0.1:${LLAMA_PORT}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        return res2.json();
    }

    // Check for text-based tool calls: [tool_call: name for 'args']
    if (message?.content?.includes('[tool_call:')) {
        const toolMatch = message.content.match(/\[tool_call:\s*(\w+)\s+for\s+'([^']+)'\s*(?:with\s+(\w+):\s*(\w+))?\]/);
        if (toolMatch) {
            const toolName = toolMatch[1];
            const toolArg = toolMatch[2];
            
            console.log(`🔧 Text tool call: ${toolName}('${toolArg}')`);

            // Map to tool execution
            let result;
            if (toolName === 'run_shell_command') {
                result = await executeTool('run_shell_command', { command: toolArg });
            } else if (toolName === 'read_file') {
                result = await executeTool('read_file', { path: toolArg });
            } else if (toolName === 'list_directory' || toolName === 'dir') {
                result = await executeTool('list_directory', { path: toolArg });
            } else {
                result = { success: false, output: `Unknown text tool: ${toolName}` };
            }

            console.log(`   ← ${result.success ? '✓' : '✗'} ${result.output.substring(0, 100)}`);

            // Add tool result and get final response
            body.messages.push(message);
            body.messages.push({
                role: 'user',
                content: `Tool result:\n\`\`\`\n${result.output}\n\`\`\``
            });

            const res2 = await fetch(`http://127.0.0.1:${LLAMA_PORT}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            return res2.json();
        }
    }

    return data1;
}

// ── Proxy to llama-server ────────────────────────────────────────
async function proxy(req, res) {
    const targetUrl = `http://127.0.0.1:${LLAMA_PORT}${req.url}`;
    let body = '';
    req.on('data', c => body += c);
    await new Promise(r => req.on('end', r));

    try {
        // Handle chat completions with tools
        if (req.url.includes('/chat/completions') && body) {
            const parsed = JSON.parse(body);
            parsed.model = MODEL_NAME;  // Replace with actual loaded model name
            const result = await chatCompletion(parsed);

            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify(result));
            return;
        }

        // Replace model name with actual loaded model
        if (body) {
            try {
                const parsed = JSON.parse(body);
                parsed.model = MODEL_NAME;
                body = JSON.stringify(parsed);
            } catch {}
        }

        const llamaRes = await fetch(targetUrl, {
            method: req.method,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': req.headers.authorization || ''
            },
            body: body || undefined
        });

        res.writeHead(llamaRes.status, {
            'Content-Type': llamaRes.headers.get('content-type') || 'application/json',
            'Access-Control-Allow-Origin': '*'
        });

        const text = await llamaRes.text();
        res.end(text);
    } catch (err) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
    }
}

// ── HTTP Server ──────────────────────────────────────────────────
const server = createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        res.end();
        return;
    }

    res.setHeader('Access-Control-Allow-Origin', '*');

    // ── Models list ─────────────────────────────────────────
    if (req.url === '/v1/models' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            object: 'list',
            data: [{ id: MODEL_NAME, object: 'model', created: Math.floor(Date.now() / 1000), owned_by: 'llamacpp' }]
        }));
        return;
    }

    if (req.url === '/health' && req.method === 'GET') {
        try {
            const llamaRes = await fetch(`http://127.0.0.1:${LLAMA_PORT}/health`);
            const data = await llamaRes.json();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', llama: data }));
        } catch {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: 'llama-server not responding' }));
        }
        return;
    }

    proxy(req, res);
});

// ── Start ────────────────────────────────────────────────────────
server.listen(PROXY_PORT, () => {
    console.log(`[DEBUG] MODEL_NAME env = "${process.env.MODEL_NAME}"`);
    console.log('══════════════════════════════════════════════');
    console.log('══════════════════════════════════════════════');
    console.log('  micro-nanobot Server (with Tool Support)');
    console.log('══════════════════════════════════════════════');
    console.log(`  URL: http://127.0.0.1:${PROXY_PORT}`);
    console.log(`  Backend: http://127.0.0.1:${LLAMA_PORT}`);
    console.log('');
    console.log('  Qwen Code config:');
    console.log(`    baseUrl: http://127.0.0.1:${PROXY_PORT}/v1`);
    console.log('');
    console.log('  Available Tools:');
    console.log('  • run_shell_command  - Execute commands');
    console.log('  • list_directory     - List files');
    console.log('  • read_file          - Read files');
    console.log('  • grep_search        - Search text');
    console.log('══════════════════════════════════════════════');
});

process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    server.close(() => process.exit(0));
});
