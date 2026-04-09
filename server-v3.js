#!/usr/bin/env node
/**
 * micro-nanobot Server v0.3.0
 * Uses node-llama-cpp directly - no external llama-server needed
 */

import { createServer } from 'http';
import { exec } from 'child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { promisify } from 'util';
import { join } from 'path';
import readline from 'readline';
import {
    getLlama,
    LlamaChatSession,
    QwenChatWrapper,
    GemmaChatWrapper,
    GeneralChatWrapper,
    defineChatSessionFunction
} from 'node-llama-cpp';

const PROXY_PORT = 8888;
const MODEL_DIR = 'C:\\Users\\rsbiiw\\Projects\\models';
const execAsync = promisify(exec);

// ── Tool definitions ─────────────────────────────────────────────
const TOOLS = {
    run_shell_command: defineChatSessionFunction({
        description: 'Execute a shell command and return the output',
        parameters: {
            type: 'object',
            properties: {
                command: { type: 'string', description: 'Command to execute' }
            },
            required: ['command']
        },
        async execute(params) {
            try {
                const { stdout, stderr } = await execAsync(params.command, {
                    maxBuffer: 1024 * 1024 * 10,
                    cwd: process.cwd()
                });
                return stdout || stderr || '(empty output)';
            } catch (err) {
                return `Error: ${err.message}`;
            }
        }
    }),
    list_directory: defineChatSessionFunction({
        description: 'List the contents of a directory. Returns filenames and directories.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Directory path to list' }
            },
            required: ['path']
        },
        async execute(params) {
            const dirPath = params.path || '.';
            if (!existsSync(dirPath)) return `Path not found: ${dirPath}`;
            try {
                const items = readdirSync(dirPath);
                const dirs = [], files = [];
                for (const item of items) {
                    const full = join(dirPath, item);
                    if (statSync(full).isDirectory()) dirs.push(item + '/');
                    else files.push(item);
                }
                return [...dirs.sort(), ...files.sort()].join('\n') || '(empty directory)';
            } catch (err) {
                return `Error: ${err.message}`;
            }
        }
    }),
    read_file: defineChatSessionFunction({
        description: 'Read the contents of a file. Use for viewing file contents.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path to read' }
            },
            required: ['path']
        },
        async execute(params) {
            if (!existsSync(params.path)) return `File not found: ${params.path}`;
            try {
                const content = readFileSync(params.path, 'utf-8');
                const maxLen = 15000;
                return content.length > maxLen
                    ? content.substring(0, maxLen) + `\n\n... (truncated, ${content.length - maxLen} more chars)`
                    : content;
            } catch (err) {
                return `Error: ${err.message}`;
            }
        }
    }),
    write_file: defineChatSessionFunction({
        description: 'Write content to a file. Creates the file if it does not exist, overwrites if it exists.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path to write' },
                content: { type: 'string', description: 'Content to write' }
            },
            required: ['path', 'content']
        },
        async execute(params) {
            try {
                const { writeFile } = await import('fs/promises');
                await writeFile(params.path, params.content, 'utf-8');
                return `✓ Written ${params.path} (${params.content.length} bytes)`;
            } catch (err) {
                return `Error: ${err.message}`;
            }
        }
    }),
    grep_search: defineChatSessionFunction({
        description: 'Search for a pattern in files. Like grep.',
        parameters: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'Search pattern' },
                path: { type: 'string', description: 'Directory to search in (default: current)' }
            },
            required: ['pattern']
        },
        async execute(params) {
            const searchPath = params.path || '.';
            try {
                const isWin = process.platform === 'win32';
                const cmd = isWin
                    ? `findstr /s /n /i "${params.pattern}" "${searchPath}\\*.*"`
                    : `grep -rn "${params.pattern}" "${searchPath}"`;
                const { stdout } = await execAsync(cmd, { maxBuffer: 1024 * 1024 * 10 });
                const lines = stdout.trim().split('\n').filter(Boolean);
                const maxLines = 50;
                if (lines.length > maxLines) {
                    return lines.slice(0, maxLines).join('\n') + `\n\n... (${lines.length - maxLines} more matches)`;
                }
                return lines.join('\n') || 'No matches found';
            } catch (err) {
                return err.stdout?.trim() || `No matches found for: ${params.pattern}`;
            }
        }
    }),
    glob_search: defineChatSessionFunction({
        description: 'Find files matching a glob pattern.',
        parameters: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'Glob pattern (e.g., **/*.js)' },
                path: { type: 'string', description: 'Base directory to search in' }
            },
            required: ['pattern']
        },
        async execute(params) {
            const searchPath = params.path || '.';
            try {
                const { glob } = await import('glob');
                const files = await glob(params.pattern, {
                    cwd: searchPath,
                    nodir: true
                });
                return files.slice(0, 50).join('\n') || 'No files found';
            } catch {
                // Fallback without glob package
                try {
                    const isWin = process.platform === 'win32';
                    const cmd = isWin
                        ? `dir /b /s "${searchPath}\\${params.pattern}"`
                        : `find "${searchPath}" -name "${params.pattern}" -type f`;
                    const { stdout } = await execAsync(cmd, { maxBuffer: 1024 * 1024 * 10 });
                    const files = stdout.trim().split('\n').filter(Boolean);
                    return files.slice(0, 50).join('\n') || 'No files found';
                } catch (err2) {
                    return `Error: ${err2.message}`;
                }
            }
        }
    })
};

const TOOL_NAMES = Object.keys(TOOLS);

// ── Discover models ──────────────────────────────────────────────
function scanModels() {
    if (!existsSync(MODEL_DIR)) return [];
    const models = [];
    for (const file of readdirSync(MODEL_DIR)) {
        if (file.endsWith('.gguf')) {
            const path = join(MODEL_DIR, file);
            const size = statSync(path).size;
            const sizeGB = (size / (1024 ** 3)).toFixed(1);
            models.push({ name: file, path, sizeGB });
        }
    }
    return models.sort((a, b) => a.name.localeCompare(b.name));
}

// ── Auto-detect chat wrapper ────────────────────────────────────
function detectChatWrapper(modelName) {
    const lower = modelName.toLowerCase();
    if (lower.includes('qwen') || lower.includes('diffcoder') || lower.includes('deepseek')) return new QwenChatWrapper();
    if (lower.includes('gemma')) return new GemmaChatWrapper();
    return new GeneralChatWrapper();
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
    // Keep one readline instance alive for the whole session
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true
    });
    rl.on('close', () => {});  // Prevent exit on close

    function ask(prompt) {
        return new Promise(resolve => rl.question(prompt, resolve));
    }

    const models = scanModels();
    if (models.length === 0) {
        console.error(`❌ No .gguf models found in ${MODEL_DIR}`);
        process.exit(1);
    }

    console.log('\n══════════════════════════════════════════════');
    console.log('  micro-nanobot Server v0.3.0');
    console.log('  node-llama-cpp (no external llama-server)');
    console.log('══════════════════════════════════════════════\n');

    // Model selection
    console.log('Available models:');
    for (let i = 0; i < models.length; i++) {
        console.log(`  ${i + 1}) ${models[i].name} (${models[i].sizeGB}GB)`);
    }
    console.log(`  0) Cancel\n`);

    const answer = await ask('Select model (number): ');

    const choice = parseInt(answer);
    if (choice < 1 || choice > models.length) {
        console.log('Cancelled.');
        rl.close();
        process.exit(0);
    }

    const selectedModel = models[choice - 1];
    console.log(`\n📦 Model: ${selectedModel.name}`);

    // GPU layers selection
    const gpuAnswer = await ask('GPU layers (number, "auto", or "max", default: auto): ');

    let gpuLayers;
    if (gpuAnswer.toLowerCase() === 'auto' || gpuAnswer === '') {
        gpuLayers = 'auto';
    } else if (gpuAnswer.toLowerCase() === 'max') {
        gpuLayers = 'max';
    } else {
        gpuLayers = parseInt(gpuAnswer);
        if (isNaN(gpuLayers)) {
            console.log('Invalid number, using auto');
            gpuLayers = 'auto';
        }
    }

    console.log(`🎮 GPU layers: ${gpuLayers}`);
    console.log('⏳ Loading model...\n');

    // Load model using node-llama-cpp
    const llama = await getLlama({ gpu: 'cuda' });
    const model = await llama.loadModel({
        modelPath: selectedModel.path,
        gpuLayers: gpuLayers
    });

    const context = await model.createContext({
        // Respect model's training context limit
        contextSize: Math.min(16384, model.trainContextSize || 16384)
    });

    // Get the default sequence
    const sequence = context.getSequence();

    const chatWrapper = detectChatWrapper(selectedModel.name);

    const session = new LlamaChatSession({
        contextSequence: sequence,
        chatWrapper: chatWrapper,
        systemPrompt: 'You are a helpful coding assistant. Use tools when appropriate.',
        modelFunctions: TOOL_NAMES.map(name => ({
            name,
            ...TOOLS[name]
        }))
    });

    // Show actual GPU layers used
    console.log(`✅ Model loaded (GPU layers: ${model.gpuLayers})\n`);

    // ── HTTP Server ──────────────────────────────────────────
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

        // ── Models endpoint ─────────────────────────────
        if (req.url === '/v1/models' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                object: 'list',
                data: [{
                    id: selectedModel.name,
                    object: 'model',
                    created: Math.floor(Date.now() / 1000),
                    owned_by: 'node-llama-cpp'
                }]
            }));
            return;
        }

        // ── Health endpoint ─────────────────────────────
        if (req.url === '/health' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', model: selectedModel.name, gpuLayers: model.gpuLayers }));
            return;
        }

        // ── Chat completions ────────────────────────────
        if (req.url.includes('/chat/completions') && req.method === 'POST') {
            let body = '';
            req.on('data', c => body += c);
            await new Promise(r => req.on('end', r));

            try {
                const parsed = JSON.parse(body);
                const messages = parsed.messages || [];
                const lastMsg = messages[messages.length - 1];

                // Handle both string and array content (multimodal)
                let userMsg = '';
                if (typeof lastMsg?.content === 'string') {
                    userMsg = lastMsg.content;
                } else if (Array.isArray(lastMsg?.content)) {
                    userMsg = lastMsg.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
                }

                if (!userMsg) {
                    throw new Error('Empty prompt');
                }

                console.log(`💬 Chat request: ${userMsg.substring(0, 120)}...`);

                // Always generate response
                const response = await session.prompt(userMsg, {
                    maxTokens: 2048,
                    temperature: 0.7
                });

                const text = typeof response === 'string' ? response : response?.responseText || '';
                console.log(`✅ Response: ${text.substring(0, 80)}...\n`);

                // If client requested streaming, send SSE
                if (parsed.stream) {
                    res.writeHead(200, {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                        'Access-Control-Allow-Origin': '*'
                    });

                    // Send chunks (simulate streaming)
                    const words = text.split(' ');
                    const chunkSize = Math.max(1, Math.floor(words.length / 8));
                    for (let i = 0; i < words.length; i += chunkSize) {
                        const chunk = words.slice(i, i + chunkSize).join(' ');
                        const data = JSON.stringify({
                            id: 'chatcmpl-' + Date.now(),
                            object: 'chat.completion.chunk',
                            created: Math.floor(Date.now() / 1000),
                            model: selectedModel.name,
                            choices: [{
                                index: 0,
                                delta: { content: chunk },
                                finish_reason: null
                            }]
                        });
                        res.write(`data: ${data}\n\n`);
                        await new Promise(r => setTimeout(r, 50));
                    }

                    // Final chunk with finish_reason
                    res.write(`data: ${JSON.stringify({
                        id: 'chatcmpl-' + Date.now(),
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: selectedModel.name,
                        choices: [{
                            index: 0,
                            delta: {},
                            finish_reason: 'stop'
                        }]
                    })}\n\n`);
                    res.write('data: [DONE]\n\n');
                    res.end();
                } else {
                    // Non-streaming response
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        id: 'chatcmpl-' + Date.now(),
                        object: 'chat.completion',
                        created: Math.floor(Date.now() / 1000),
                        model: selectedModel.name,
                        choices: [{
                            index: 0,
                            message: { role: 'assistant', content: text },
                            finish_reason: 'stop'
                        }],
                        usage: { prompt_tokens: 0, completion_tokens: text.split(/\s+/).length, total_tokens: text.split(/\s+/).length }
                    }));
                }
            } catch (err) {
                console.error('❌ Chat error:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: { message: err.message, type: 'internal_error' } }));
            }
            return;
        }

        // ── Fallback ────────────────────────────────────
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    });

    server.listen(PROXY_PORT, () => {
        console.log('══════════════════════════════════════════════');
        console.log(`  Server: http://127.0.0.1:${PROXY_PORT}`);
        console.log(`  Qwen Code baseUrl: http://127.0.0.1:${PROXY_PORT}/v1`);
        console.log('');
        console.log(`  Tools: ${TOOL_NAMES.join(', ')}`);
        console.log('══════════════════════════════════════════════');
        console.log('  Press Ctrl+C to stop\n');
    });

    function gracefulShutdown(signal) {
        console.log(`\n👋 ${signal} - shutting down...`);
        session.dispose?.();
        context.dispose?.();
        model.dispose?.();
        llama.dispose?.();
        server.close(() => {
            console.log('✅ Server closed');
            process.exit(0);
        });
        setTimeout(() => process.exit(1), 5000);
    }

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('uncaughtException', (err) => {
        console.error('❌ Uncaught exception:', err.message);
        process.exit(1);
    });
}

main().catch(err => {
    console.error('❌ Fatal:', err.message);
    console.error(err.stack);
    process.exit(1);
});
