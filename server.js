const { spawn } = require('child_process');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const LLAMA_SERVER_PORT = 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let llamaProcess = null;
let currentModelPath = null;

const MODELS_DIR = path.join(__dirname, '..', 'models');

function getAvailableModels() {
    if (!fs.existsSync(MODELS_DIR)) return [];
    return fs.readdirSync(MODELS_DIR)
        .filter(f => f.endsWith('.gguf'))
        .map(name => ({
            name,
            path: path.join(MODELS_DIR, name),
            size: fs.statSync(path.join(MODELS_DIR, name)).size
        }));
}

async function startLlamaServer(modelPath) {
    return new Promise((resolve, reject) => {
        if (llamaProcess) {
            llamaProcess.kill();
        }

        const llamaBin = path.join(__dirname, 'llama-bin', 'llama-server.exe');
        const args = [
            '-m', modelPath,
            '--port', LLAMA_SERVER_PORT.toString(),
            '--ctx-size', '262144',  // 256K context for Qwen 3.5
            '--n-predict', '8192',   // Max output tokens
            '--threads', '4',
            '--gpu-layers', '99'     // Full GPU offload when available
        ];

        console.log('Starting llama.cpp server:', args.join(' '));
        
        llamaProcess = spawn(llamaBin, args);

        llamaProcess.stdout.on('data', (data) => {
            const output = data.toString();
            if (output.includes('HTTP server listening')) {
                resolve({ success: true });
            }
            console.log('[llama.cpp]', output.trim());
        });

        llamaProcess.stderr.on('data', (data) => {
            console.error('[llama.cpp]', data.toString().trim());
        });

        llamaProcess.on('error', (err) => {
            reject(new Error(`Failed to start: ${err.message}. Make sure llama-server.exe exists.`));
        });

        llamaProcess.on('exit', (code) => {
            console.log(`llama.cpp server exited with code ${code}`);
            llamaProcess = null;
            currentModelPath = null;
        });

        // Timeout if server doesn't start
        setTimeout(() => {
            if (llamaProcess) resolve({ success: true, message: 'Server starting...' });
        }, 10000);
    });
}

async function stopLlamaServer() {
    if (llamaProcess) {
        llamaProcess.kill();
        llamaProcess = null;
        currentModelPath = null;
        return { success: true, message: 'Server stopped' };
    }
    return { success: false, message: 'No server running' };
}

// Proxy to llama.cpp server
async function proxyToLlama(method, endpoint, body = null) {
    const url = `http://localhost:${LLAMA_SERVER_PORT}${endpoint}`;
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);
    
    const res = await fetch(url, options);
    return res.json();
}

app.get('/api/models', (req, res) => {
    res.json({
        models: getAvailableModels(),
        currentModel: currentModelPath ? path.basename(currentModelPath) : null
    });
});

app.post('/api/load', async (req, res) => {
    const { modelPath } = req.body;
    if (!modelPath) return res.status(400).json({ error: 'modelPath required' });
    const fullPath = path.join(MODELS_DIR, modelPath);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Model not found' });
    
    try {
        await startLlamaServer(fullPath);
        currentModelPath = fullPath;
        res.json({ success: true, message: `Loaded ${path.basename(fullPath)}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/unload', async (req, res) => {
    res.json(await stopLlamaServer());
});

app.post('/api/chat', async (req, res) => {
    if (!currentModelPath) return res.status(400).json({ error: 'No model loaded' });
    const { prompt, maxTokens = 256, temperature = 0.7 } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });

    try {
        const result = await proxyToLlama('POST', '/completion', {
            prompt,
            n_predict: maxTokens,
            temperature
        });
        res.json({ response: result.content || '' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/completions', async (req, res) => {
    if (!currentModelPath) return res.status(400).json({ error: { message: 'No model loaded' } });
    const { messages, max_tokens = 256, temperature = 0.7 } = req.body;
    
    try {
        // Convert to chat format
        let prompt = '';
        for (const msg of messages) {
            prompt += `${msg.role}: ${msg.content}\n`;
        }
        prompt += 'assistant:';
        
        const result = await proxyToLlama('POST', '/completion', {
            prompt,
            n_predict: max_tokens,
            temperature
        });
        
        res.json({
            id: 'chatcmpl-' + Date.now(),
            object: 'chat.completion',
            created: Date.now(),
            model: currentModelPath ? path.basename(currentModelPath) : 'unknown',
            choices: [{
                index: 0,
                message: { role: 'assistant', content: result.content || '' },
                finish_reason: 'stop'
            }],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        });
    } catch (err) {
        res.status(500).json({ error: { message: err.message } });
    }
});

app.get('/health', async (req, res) => {
    try {
        await fetch(`http://localhost:${LLAMA_SERVER_PORT}/health`);
        res.json({ status: 'ok', modelLoaded: true, currentModel: currentModelPath ? path.basename(currentModelPath) : null });
    } catch {
        res.json({ status: 'ok', modelLoaded: false, currentModel: null });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🦙 Llama Server running on http://localhost:${PORT}`);
    console.log(`   Models directory: ${MODELS_DIR}`);
    console.log(`   Available models: ${getAvailableModels().map(m => m.name).join(', ') || 'None'}`);
    console.log('\n   Endpoints:');
    console.log('   GET  /api/models      - List available models');
    console.log('   POST /api/load        - Load a model');
    console.log('   POST /api/unload      - Unload current model');
    console.log('   POST /api/chat        - Chat with loaded model');
    console.log('   POST /api/completions - OpenAI-compatible chat');
    console.log('   GET  /health          - Server health check\n');
});
