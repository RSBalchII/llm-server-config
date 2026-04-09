#!/usr/bin/env node
/**
 * micro-nanobot Server v0.3.0
 * node-llama-cpp native - raw completions, no chat session wrappers
 */

import { createServer } from 'http';
import { exec } from 'child_process';
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'fs';
import { promisify } from 'util';
import { join } from 'path';
import readline from 'readline';
import { getLlama } from 'node-llama-cpp';

const PROXY_PORT = 8888;
const MODEL_DIR = 'C:\\Users\\rsbiiw\\Projects\\models';
const execAsync = promisify(exec);

// ── System prompt ────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a helpful AI coding assistant. Respond clearly with proper spacing and formatting.`;

// ── Discover models ──────────────────────────────────────────────
function scanModels() {
    if (!existsSync(MODEL_DIR)) return [];
    return readdirSync(MODEL_DIR)
        .filter(f => f.endsWith('.gguf'))
        .map(file => {
            const path = join(MODEL_DIR, file);
            const size = statSync(path).size;
            return { name: file, path, sizeGB: (size / 1024 ** 3).toFixed(1) };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
}

// ── Detect chat template from model name ─────────────────────────
function detectTemplate(modelName) {
    const n = modelName.toLowerCase();
    if (n.includes('qwen3') || n.includes('deepseek')) return 'qwen3';
    if (n.includes('gemma')) return 'gemma';
    if (n.includes('qwen')) return 'qwen';
    return 'alpaca';
}

// ── Format messages into model-specific chat template ────────────
function formatPrompt(messages, template) {
    let text = '';
    switch (template) {
        case 'qwen3':
        case 'qwen':
            // <|im_start|>system\n...\n<|im_end|>\n<|im_start|>user\n...\n<|im_end|>\n<|im_start|>assistant
            text = '<|im_start|>system\n' + SYSTEM_PROMPT + '<|im_end|>\n';
            for (const msg of messages) {
                const role = msg.role === 'assistant' ? 'assistant' : 'user';
                const content = typeof msg.content === 'string'
                    ? msg.content
                    : msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
                text += `<|im_start|>${role}\n${content}<|im_end|>\n`;
            }
            text += '<|im_start|>assistant\n';
            break;
        case 'gemma':
            // <start_of_turn>user\n...\n<end_of_turn>\n<start_of_turn>model\n
            for (const msg of messages) {
                const role = msg.role === 'assistant' ? 'model' : 'user';
                const content = typeof msg.content === 'string' ? msg.content : msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
                text += `<start_of_turn>${role}\n${content}<end_of_turn>\n`;
            }
            text += '<start_of_turn>model\n';
            break;
        default:
            // Alpaca: ### Instruction:\n...\n\n### Response:
            text = SYSTEM_PROMPT + '\n\n';
            for (const msg of messages) {
                if (msg.role === 'user') text += `### Instruction:\n${typeof msg.content === 'string' ? msg.content : msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n')}\n\n`;
                else if (msg.role === 'assistant') text += `### Response:\n${typeof msg.content === 'string' ? msg.content : msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n')}\n\n`;
            }
            text += '### Response:\n';
    }
    return text;
}

// ── Extract stop tokens per template ─────────────────────────────
function stopTokens(template) {
    switch (template) {
        case 'qwen3':
        case 'qwen':
            return ['<|im_end|>', '<|endoftext|>'];
        case 'gemma':
            return ['<end_of_turn>', '<eos>'];
        default:
            return ['### Instruction:', '### Response:'];
    }
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const ask = prompt => new Promise(resolve => rl.question(prompt, resolve));

    const models = scanModels();
    if (!models.length) {
        console.error(`❌ No .gguf models found in ${MODEL_DIR}`);
        process.exit(1);
    }

    console.log('\n══════════════════════════════════════════════');
    console.log('  micro-nanobot Server v0.3.0');
    console.log('  node-llama-cpp native completions');
    console.log('══════════════════════════════════════════════\n');

    console.log('Available models:');
    models.forEach((m, i) => console.log(`  ${i + 1}) ${m.name} (${m.sizeGB}GB)`));
    console.log('  0) Cancel\n');

    const choice = parseInt(await ask('Select model (number): '));
    if (choice < 1 || choice > models.length) { process.exit(0); }

    const sel = models[choice - 1];
    const sizeGB = parseFloat(sel.sizeGB);
    const maxLayers = Math.min(Math.floor(16 / (sizeGB / 41)), 41);
    console.log(`\n📦 Model: ${sel.name}`);
    console.log(`   Size: ${sel.sizeGB}GB, ~41 layers total`);
    console.log(`   Est. max GPU layers on 16GB VRAM: ~${maxLayers}`);

    const gpuRaw = await ask('GPU layers (number, "auto", or "max", default: auto): ');
    const gpuLayers = gpuRaw.toLowerCase() === 'max' ? 'max'
        : (gpuRaw.toLowerCase() === 'auto' || !gpuRaw) ? 'auto'
        : parseInt(gpuRaw) || 'auto';

    if (typeof gpuLayers === 'number' && sizeGB > 8 && gpuLayers > 33) {
        console.log(`⚠️  ${sel.name} (${sizeGB}GB) may not fit with ${gpuLayers} GPU layers`);
    }

    console.log(`🎮 GPU layers: ${gpuLayers}`);
    console.log('⏳ Loading model...\n');

    const llama = await getLlama({ gpu: 'cuda' });
    const model = await llama.loadModel({ modelPath: sel.path, gpuLayers });
    const ctx = await model.createContext({ contextSize: Math.min(16384, model.trainContextSize || 8192) });
    const seq = ctx.getSequence();
    const template = detectTemplate(sel.name);

    console.log(`✅ Model loaded (GPU layers: ${model.gpuLayers})`);
    console.log(`   Chat template: ${template}`);
    console.log(`   Context: ${ctx.contextSize} tokens\n`);

    const server = createServer(async (req, res) => {
        // CORS
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

        // GET /v1/models
        if (req.url === '/v1/models' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                object: 'list',
                data: [{ id: sel.name, object: 'model', created: Math.floor(Date.now() / 1000), owned_by: 'node-llama-cpp' }]
            }));
            return;
        }

        // GET /health
        if (req.url === '/health' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', model: sel.name, gpuLayers: model.gpuLayers }));
            return;
        }

        // POST /v1/chat/completions
        if (req.url.includes('/chat/completions') && req.method === 'POST') {
            let body = '';
            req.on('data', c => body += c);
            await new Promise(r => req.on('end', r));

            try {
                const parsed = JSON.parse(body);
                const messages = parsed.messages || [];
                if (!messages.length) throw new Error('Empty messages array');

                const prompt = formatPrompt(messages, template);
                const stops = stopTokens(template);
                const stream = parsed.stream || false;

                console.log(`💬 Chat request (${messages.length} messages, template: ${template})`);

                // Non-streaming (default)
                if (!stream) {
                    const result = await seq.complete(prompt, {
                        maxTokens: parsed.max_tokens ?? 2048,
                        temperature: parsed.temperature ?? 0.6,
                        topK: parsed.top_k ?? 40,
                        topP: parsed.top_p ?? 0.9,
                        stopSequences: stops,
                        repeatPenalty: 1.1
                    });

                    const text = typeof result === 'string' ? result : result?.text || '';
                    const tokens = text.split(/\s+/).filter(Boolean).length;

                    console.log(`✅ Response: ${text.substring(0, 100)}...\n`);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        id: 'chatcmpl-' + Date.now(),
                        object: 'chat.completion',
                        created: Math.floor(Date.now() / 1000),
                        model: sel.name,
                        choices: [{
                            index: 0,
                            message: { role: 'assistant', content: text },
                            finish_reason: 'stop'
                        }],
                        usage: { prompt_tokens: 0, completion_tokens: tokens, total_tokens: tokens }
                    }));
                    return;
                }

                // Streaming (SSE) - complete with onToken callback
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'Access-Control-Allow-Origin': '*'
                });

                let fullText = '';
                let tokenCount = 0;

                const result = await seq.complete(prompt, {
                    maxTokens: parsed.max_tokens ?? 2048,
                    temperature: parsed.temperature ?? 0.6,
                    topK: parsed.top_k ?? 40,
                    topP: parsed.top_p ?? 0.9,
                    stopSequences: stops,
                    repeatPenalty: 1.1,
                    onToken: (tokens, ctx) => {
                        // tokens is an array of token strings from the current generation step
                        for (const t of tokens) {
                            fullText += t;
                            tokenCount++;
                            const data = JSON.stringify({
                                id: 'chatcmpl-' + Date.now(),
                                object: 'chat.completion.chunk',
                                created: Math.floor(Date.now() / 1000),
                                model: sel.name,
                                choices: [{
                                    index: 0,
                                    delta: { content: t },
                                    finish_reason: null
                                }]
                            });
                            res.write(`data: ${data}\n\n`);
                        }
                    }
                });

                // Final chunk
                res.write(`data: ${JSON.stringify({
                    id: 'chatcmpl-' + Date.now(),
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: sel.name,
                    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
                })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();

                console.log(`✅ Streamed ${tokenCount} tokens\n`);
            } catch (err) {
                console.error('❌ Chat error:', err.message);
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: { message: err.message, type: 'internal_error' } }));
                }
            }
            return;
        }

        // 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    });

    server.listen(PROXY_PORT, () => {
        console.log('══════════════════════════════════════════════');
        console.log(`  Server: http://127.0.0.1:${PROXY_PORT}`);
        console.log(`  API: http://127.0.0.1:${PROXY_PORT}/v1`);
        console.log('══════════════════════════════════════════════\n');
    });

    const shutdown = (sig) => {
        console.log(`\n👋 ${sig} - shutting down...`);
        ctx?.dispose?.();
        model?.dispose?.();
        llama?.dispose?.();
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(1), 3000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('uncaughtException', err => {
        console.error('❌ Uncaught:', err.message);
        process.exit(1);
    });
}

main().catch(err => {
    console.error('❌ Fatal:', err.message);
    process.exit(1);
});
