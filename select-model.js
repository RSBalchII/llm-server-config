#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODELS_DIR = path.join(__dirname, '..', 'models');
const SERVER_PATH = path.join(__dirname, 'server.js');

function getAvailableModels() {
    if (!fs.existsSync(MODELS_DIR)) return [];
    return fs.readdirSync(MODELS_DIR)
        .filter(f => f.endsWith('.gguf'))
        .map((name, i) => ({
            index: i + 1,
            name,
            size: (fs.statSync(path.join(MODELS_DIR, name)).size / 1024 / 1024 / 1024).toFixed(2) + ' GB'
        }));
}

function showMenu(models) {
    console.clear();
    console.log('🦙 Llama Model Server - Model Selector\n');
    console.log('Available Models:');
    console.log('─'.repeat(50));
    models.forEach(m => {
        console.log(`  ${m.index}. ${m.name} (${m.size})`);
    });
    console.log('─'.repeat(50));
    console.log('\n  0. Exit');
    console.log('\nSelect a model to load and start the server:');
}

function main() {
    const models = getAvailableModels();
    
    if (models.length === 0) {
        console.log('No .gguf models found in:', MODELS_DIR);
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

        if (choice < 1 || choice > models.length) {
            console.log('Invalid choice');
            rl.close();
            process.exit(1);
        }

        const selectedModel = models[choice - 1];
        console.log(`\n🚀 Starting server with: ${selectedModel.name}`);
        console.log('─'.repeat(50));
        
        rl.close();

        const server = spawn('node', [SERVER_PATH], {
            env: { ...process.env, PRELOAD_MODEL: selectedModel.path }
        });

        server.stdout.on('data', (data) => {
            console.log(data.toString());
        });

        server.stderr.on('data', (data) => {
            console.error(data.toString());
        });

        server.on('close', (code) => {
            console.log(`Server exited with code ${code}`);
        });
    });
}

main();
