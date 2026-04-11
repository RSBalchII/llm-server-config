#!/usr/bin/env node
/**
 * micro-nanobot Server v0.3.0
 * node-llama-cpp native - raw completions, no chat session wrappers
 */

import { createServer } from 'http';
import { exec } from 'child_process';
import { readdirSync, statSync, existsSync } from 'fs';
import { promisify } from 'util';
import { join } from 'path';
import readline from 'readline';
import {
    getLlama,
    LlamaChatSession,
    QwenChatWrapper,
    GemmaChatWrapper,
    AlpacaChatWrapper
} from 'node-llama-cpp';

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

// ── Detect chat wrapper from model name ──────────────────────────
function detectWrapper(modelName) {
    const n = modelName.toLowerCase();
    if (n.includes('qwen') || n.includes('deepseek') || n.includes('diffcoder')) return new QwenChatWrapper();
    if (n.includes('gemma')) return new GemmaChatWrapper();
    return new AlpacaChatWrapper();
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

    const choice = await ask('Select model (number): ');
    const trimmed = choice.trim();
    // Handle quoted input like "1"
    let choiceNum = Number(trimmed.replace(/^"|"$/g, '')) || 0;
    console.log(`DEBUG: choice=${choice}, trimmed=${trimmed}, choiceNum=${choiceNum}, typeof=${typeof choiceNum}`);
    if (choiceNum < 1 || choiceNum > models.length) { process.exit(0); }

    const sel = models[choiceNum - 1];
    console.log(`DEBUG: sel=${sel}, sizeGB=${sel.sizeGB}`);
    const sizeGB = parseFloat(sel.sizeGB);
    console.log(`DEBUG: sizeGB=${sizeGB}`);
    const gpuRaw = await ask('GPU layers (number, "auto", or "max", default: auto): ');
    
    // Optimize GPU layers: use 'max' for models <4GB, otherwise respect user selection
    const gpuLayers = sizeGB < 4 ? 'max' : (gpuRaw === 'max' ? 'max' : (gpuRaw === 'auto' || !gpuRaw) ? 'auto' : parseInt(gpuRaw) || 'auto');
    console.log(`\n📦 Model: ${sel.name}`);
    console.log(`   Size: ${sizeGB}GB`);
    console.log(`🎮 GPU layers: ${gpuLayers}`);
    console.log('⏳ Loading model...\n');

    const llama = await getLlama({ gpu: 'cuda', threads: 16 });
    // Flash Attention support for RTX 4090
    const model = await llama.loadModel({ modelPath: sel.path, gpuLayers, flashAttention: true });
    // Increased batchSize to 512 for RTX 4090
    const ctx = await model.createContext({ contextSize: Math.min(16384, model.trainContextSize || 8192), batchSize: 512 });
    const seq = ctx.getSequence();
    const wrapper = detectWrapper(sel.name);

    // LlamaChatSession with correct wrapper - manages history internally
    const session = new LlamaChatSession({
        contextSequence: seq,
        chatWrapper: wrapper
    });

    console.log(`✅ Model loaded (GPU layers: ${model.gpuLayers})`);
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

                const stream = parsed.stream || false;

                console.log(`💬 Chat request (${messages.length} messages)`);

                // Set system prompt from first message if it's a system message
                const systemMsg = messages.find(m => m.role === 'system');
                if (systemMsg && typeof systemMsg.content === 'string') {
                    session.systemPrompt = systemMsg.content;
                }

                // Build conversation history for the session
                // LlamaChatSession expects us to call prompt() with user messages
                // and it manages history internally
                const lastUser = messages.filter(m => m.role !== 'system').pop();
                const userMsg = typeof lastUser?.content === 'string'
                    ? lastUser.content
                    : lastUser?.content?.filter(c => c.type === 'text').map(c => c.text).join('\n') || '';

                if (!userMsg) throw new Error('No user message found');

                // Feed conversation history into session with proper role alternation
                // LlamaChatSession expects alternating user/assistant roles
                const nonSystemMessages = messages.filter(m => m.role !== 'system');
                let lastRole = null;

                for (let i = 0; i < nonSystemMessages.length - 1; i++) { // Skip last (current) message
                    const msg = nonSystemMessages[i];
                    if (msg.role === lastRole) {
                        // Skip duplicate roles - merge with previous if assistant
                        if (msg.role === 'assistant' && typeof msg.content === 'string') {
                            const lastEntry = session._chatHistory[session._chatHistory.length - 1];
                            if (lastEntry && lastEntry.role === 'assistant') {
                                lastEntry.message += '\n' + msg.content;
                            }
                        }
                        continue;
                    }

                    if (msg.role === 'assistant' && typeof msg.content === 'string') {
                        session._chatHistory.push({ role: 'assistant', message: msg.content });
                    } else if (msg.role === 'user' && typeof msg.content === 'string') {
                        session._chatHistory.push({ role: 'user', message: msg.content });
                    }
                    lastRole = msg.role;
                }

                // Ensure the last entry before current prompt is user (not assistant)
                if (session._chatHistory.length > 0 && session._chatHistory[session._chatHistory.length - 1].role === 'assistant') {
                    // This is fine, assistant responded, next will be user
                } else if (session._chatHistory.length > 1 && session._chatHistory[session._chatHistory.length - 1].role === 'user') {
                    // Two users in a row - remove the duplicate
                    session._chatHistory.pop();
                }

                // For thinking models, increase maxTokens to allow both thinking + response
                // Gemma 4, Qwen3.5, DeepSeek all use thinking which can consume 1000-4000 tokens
                const isThinkingModel = sel.name.toLowerCase().includes('gemma') || 
                                        sel.name.toLowerCase().includes('qwen3.5') ||
                                        sel.name.toLowerCase().includes('deepseek') ||
                                        sel.name.toLowerCase().includes('reasoning');
                const defaultMaxTokens = isThinkingModel ? 8192 : 4096;

                // Non-streaming (default) - uses onToken callback for token-by-token streaming
                if (!stream) {
                    res.writeHead(200, {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                        'Access-Control-Allow-Origin': '*'
                    });

                    let thinkingEnded = false;
                    const text = await session.prompt(userMsg, {
                        maxTokens: parsed.max_tokens ?? defaultMaxTokens,
                        temperature: parsed.temperature ?? 0.6,
                        topK: parsed.top_k ?? 40,
                        topP: parsed.top_p ?? 0.9,
                        repeatPenalty: 1.1,
                        onToken: (token) => {
                            try {
                                // Detect thinking end
                                if (typeof token === 'string' && (token.includes('') || token.includes('<channel|>'))) {
                                    thinkingEnded = true;
                                    console.log('💭 Thinking ended, generating response...');
                                }
                                
                                res.write(`data: ${JSON.stringify({
                                    id: 'chatcmpl-' + Date.now(),
                                    object: 'chat.completion.chunk',
                                    created: Math.floor(Date.now() / 1000),
                                    model: sel.name,
                                    choices: [{
                                        index: 0,
                                        delta: { content: token },
                                        finish_reason: null
                                    }]
                                })}\n\n`);
                            } catch (err) {
                                console.error('⚠️ onToken error:', err.message);
                            }
                        }
                    });

                    console.log(`💭 Thinking ended: ${thinkingEnded}`);
                    
                    // Send final chunk with finish_reason
                    res.write(`data: ${JSON.stringify({
                        id: 'chatcmpl-' + Date.now(),
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: sel.name,
                        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
                    })}\n\n`);
                    res.write('data: [DONE]\n\n');
                    res.end();

                    console.log(`✅ Response: ${text.split(/\s+/).length} tokens\n`);
                    return;
                }

                // Streaming (SSE) - true token-by-token streaming using onToken callback
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'Access-Control-Allow-Origin': '*'
                });

                let buffer = '';
                let thinkingEnded = false;
                await session.prompt(userMsg, {
                    maxTokens: parsed.max_tokens ?? defaultMaxTokens,
                    temperature: parsed.temperature ?? 0.6,
                    topK: parsed.top_k ?? 40,
                    topP: parsed.top_p ?? 0.9,
                    repeatPenalty: 1.1,
                    onToken: (tokens) => {
                        try {
                            // Detokenize to get the full text so far
                            const fullText = llama.detokenize(tokens);
                            // Detect thinking end
                            if (fullText.includes('') || fullText.includes('<channel|>')) {
                                if (!thinkingEnded) {
                                    thinkingEnded = true;
                                    console.log('💭 Thinking ended (streaming), generating response...');
                                }
                            }
                            // Extract only the new tokens since last call
                            const newPart = fullText.slice(buffer.length);
                            buffer = fullText;

                            // Send only the new tokens
                            res.write(`data: ${JSON.stringify({
                                id: 'chatcmpl-' + Date.now(),
                                object: 'chat.completion.chunk',
                                created: Math.floor(Date.now() / 1000),
                                model: sel.name,
                                choices: [{
                                    index: 0,
                                    delta: { content: newPart },
                                    finish_reason: null
                                }]
                            })}\n\n`);
                        } catch (err) {
                            console.error('⚠️ onToken error:', err.message);
                        }
                    }
                });

                console.log(`💭 Thinking ended (streaming): ${thinkingEnded}`);

                // Send final chunk with finish_reason
                res.write(`data: ${JSON.stringify({
                    id: 'chatcmpl-' + Date.now(),
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: sel.name,
                    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
                })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();

                console.log(`✅ Streaming Response: ${buffer.split(/\s+/).length} tokens\n`);
                return;
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
