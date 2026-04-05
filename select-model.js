#!/usr/bin/env node
// Model selector for micro-nanobot - launches agent.js after model selection

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODELS_DIR = path.join(__dirname, '..', 'models');
const AGENT_PATH = path.join(__dirname, 'agent.js');

function getAvailableModels() {
    if (!fs.existsSync(MODELS_DIR)) return [];
    return fs.readdirSync(MODELS_DIR)
        .filter(f => f.endsWith('.gguf'))
        .map((name, i) => ({
            index: i + 1,
            name,
            path: path.join(MODELS_DIR, name),
            size: (fs.statSync(path.join(MODELS_DIR, name)).size / 1024 / 1024 / 1024).toFixed(2) + ' GB'
        }));
}

function showMenu(models) {
    console.clear();
    console.log('🤖 micro-nanobot - Model Selector\n');
    console.log('Available Models:');
    console.log('─'.repeat(50));
    models.forEach(m => {
        console.log(`  ${m.index}. ${m.name} (${m.size})`);
    });
    console.log('─'.repeat(50));
    console.log('\n  d. Download new model');
    console.log('  0. Exit');
    console.log('\nSelect a model to load and start the agent:');
}

function main() {
    const models = getAvailableModels();

    if (models.length === 0) {
        console.log('No .gguf models found in:', MODELS_DIR);
        console.log('\n💡 Options:');
        console.log('   1) Run ./download-model.sh to download a model');
        console.log('   2) Place GGUF files in', MODELS_DIR);
        process.exit(1);
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    showMenu(models);

    rl.question('Enter choice (0-' + models.length + '): ', (answer) => {
        const choice = parseInt(answer.trim());

        if (choice === 0) {
            console.log('Goodbye!');
            rl.close();
            process.exit(0);
        }

        if (choice === -1 || choice.toString().toLowerCase() === 'd') {
            console.log('\n📥 Starting model downloader...');
            rl.close();
            spawn('./download-model.sh', { stdio: 'inherit', shell: true });
            return;
        }

        if (choice < 1 || choice > models.length) {
            console.log('Invalid choice');
            rl.close();
            process.exit(1);
        }

        const selectedModel = models[choice - 1];
        console.log(`\n🚀 Starting micro-nanobot with: ${selectedModel.name}`);
        console.log('─'.repeat(50));

        rl.close();

        // Start llama.cpp server first, then agent
        console.log('📡 Starting llama.cpp server on port 8080...');
        
        const llamaServer = process.env.LLAMA_SERVER || 'llama.cpp/build/bin/llama-server';
        const server = spawn(llamaServer, [
            '-m', selectedModel.path,
            '--port', '8080',
            '--ctx-size', '32768'
        ], { stdio: 'inherit' });

        server.on('error', (err) => {
            console.error('❌ Failed to start llama-server:', err.message);
            console.error('   Make sure llama.cpp is built at: llama.cpp/build/bin/llama-server');
            process.exit(1);
        });

        // Wait for server to start, then launch agent
        setTimeout(() => {
            console.log('\n🤖 Starting agent...\n');
            const agent = spawn('node', [AGENT_PATH], { stdio: 'inherit' });
            
            agent.on('close', (code) => {
                console.log(`\nAgent exited with code ${code}`);
                server.kill();
                process.exit(code);
            });
        }, 3000);

        server.on('close', (code) => {
            console.log(`\nllama-server exited with code ${code}`);
            process.exit(code);
        });
    });
}

main();
