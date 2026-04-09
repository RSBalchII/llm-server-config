#!/usr/bin/env node
/**
 * A/B test: server-v3.js with node-llama-cpp
 * Tests model loading and basic chat without interactive prompts
 */

import {
    getLlama,
    LlamaChatSession,
    QwenChatWrapper,
    GemmaChatWrapper,
    GeneralChatWrapper,
    defineChatSessionFunction
} from 'node-llama-cpp';
import { createServer } from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';

const MODEL_DIR = 'C:\\Users\\rsbiiw\\Projects\\models';
const PORT = 8888;
const execAsync = promisify(exec);

// Models to test (most likely to work first)
const MODELS = [
    { name: 'Qwen3.5-4B-heretic.Q4_K_M.gguf', gpuLayers: 'auto' },
    { name: 'Qwen3.5-4B-heretic-v2.Q4_K_M.gguf', gpuLayers: 'auto' },
];

// 6 tools
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
                const { stdout } = await execAsync(params.command, { maxBuffer: 1024 * 1024 * 10 });
                return stdout || '(empty output)';
            } catch (err) {
                return `Error: ${err.message}`;
            }
        }
    })
};

function detectChatWrapper(modelName) {
    const lower = modelName.toLowerCase();
    if (lower.includes('qwen')) return new QwenChatWrapper();
    if (lower.includes('gemma')) return new GemmaChatWrapper();
    return new GeneralChatWrapper();
}

async function testModel(modelConfig) {
    const modelPath = `${MODEL_DIR}\\${modelConfig.name}`;
    if (!existsSync(modelPath)) {
        console.log(`  ⏭️  Model not found: ${modelConfig.name}`);
        return false;
    }

    console.log(`\n📦 Testing: ${modelConfig.name}`);
    console.log(`   GPU layers: ${modelConfig.gpuLayers}`);

    try {
        console.log('   ⏳ Loading model...');
        const llama = await getLlama({ gpu: 'cuda' });
        const model = await llama.loadModel({
            modelPath: modelPath,
            gpuLayers: modelConfig.gpuLayers
        });
        console.log(`   ✅ Model loaded (GPU layers: ${model.gpuLayers})`);

        console.log('   ⏳ Creating context...');
        const context = await model.createContext({
            contextSize: Math.min(16384, model.trainContextSize || 16384)
        });
        const sequence = context.getSequence();
        console.log('   ✅ Context created');

        const chatWrapper = detectChatWrapper(modelConfig.name);
        const session = new LlamaChatSession({
            contextSequence: sequence,
            chatWrapper: chatWrapper,
            systemPrompt: 'You are a helpful coding assistant.',
            modelFunctions: Object.keys(TOOLS).map(name => ({
                name,
                ...TOOLS[name]
            }))
        });
        console.log('   ✅ Chat session created');

        // Quick chat test
        console.log('   ⏳ Sending test message...');
        const response = await session.prompt('Say hello in 5 words or less.', {
            maxTokens: 64,
            temperature: 0.7
        });
        console.log(`   ✅ Response: ${response.trim()}`);

        // Start HTTP server
        const server = createServer(async (req, res) => {
            if (req.url === '/v1/models') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    object: 'list',
                    data: [{ id: modelConfig.name, object: 'model', created: Date.now(), owned_by: 'node-llama-cpp' }]
                }));
            } else if (req.url === '/health') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', model: modelConfig.name }));
            } else if (req.url.includes('/chat/completions')) {
                let body = '';
                req.on('data', c => body += c);
                await new Promise(r => req.on('end', r));
                try {
                    const parsed = JSON.parse(body);
                    const userMsg = parsed.messages?.[parsed.messages.length - 1]?.content || '';
                    const response = await session.prompt(userMsg, { maxTokens: 512, temperature: 0.7 });
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        id: 'chatcmpl-' + Date.now(),
                        object: 'chat.completion',
                        created: Date.now(),
                        model: modelConfig.name,
                        choices: [{ index: 0, message: { role: 'assistant', content: response }, finish_reason: 'stop' }]
                    }));
                } catch (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: { message: err.message } }));
                }
            } else {
                res.writeHead(404);
                res.end('not found');
            }
        });

        await new Promise((resolve, reject) => {
            server.listen(PORT, resolve);
            server.on('error', reject);
        });
        console.log(`   ✅ HTTP server running on port ${PORT}`);
        console.log(`\n🎉 SUCCESS! Server is ready.`);
        console.log(`   Test: curl http://127.0.0.1:${PORT}/health`);
        console.log(`   Test: curl -X POST http://127.0.0.1:${PORT}/v1/chat/completions -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"hi"}]}'`);

        // Keep running
        process.on('SIGINT', () => {
            console.log('\n👋 Shutting down...');
            server.close(() => process.exit(0));
        });
        return true;

    } catch (err) {
        console.log(`   ❌ FAILED: ${err.message}`);
        return false;
    }
}

// Main: try models in order until one works
async function main() {
    console.log('══════════════════════════════════════════════');
    console.log('  A/B Test: server-v3.js with node-llama-cpp');
    console.log('══════════════════════════════════════════════');

    for (const modelConfig of MODELS) {
        const success = await testModel(modelConfig);
        if (success) return; // Server is now running
        console.log(`\n   Trying next model...\n`);
    }

    console.log('\n❌ All models failed');
    process.exit(1);
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
