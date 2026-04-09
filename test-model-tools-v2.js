#!/usr/bin/env node
/**
 * Model Tool Compatibility Tester v2
 * Direct llama-server spawning (no batch file)
 */

import { exec, spawn } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { promisify } from 'util';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Model configs: [menu_number, gguf_name]
const MODELS = [
    { num: 14, gguf: 'Qwen3.5-4B-heretic.Q4_K_M.gguf',          arch: 'qwen', desc: 'Qwen 3.5 4B' },
    { num: 6,  gguf: 'gemma-4-E4B-it-Heretic-ARA-Refusals5_Q4_K_M.gguf', arch: 'gemma', desc: 'Gemma 4 E4B' },
    { num: 2,  gguf: 'DeepSeek-R1-0528-Qwen3-8B-IQ4_XS.gguf',   arch: 'deepseek-qwen', desc: 'DeepSeek-R1 8B' },
];

const TOOLS = [{
    type: 'function',
    function: {
        name: 'run_shell_command',
        description: 'Execute shell command',
        parameters: {
            type: 'object',
            properties: { command: { type: 'string' } },
            required: ['command']
        }
    }
}];

const LLAMA_SERVER = 'C:\\Users\\rsbiiw\\llama.cpp\\build\\bin\\Release\\llama-server.exe';
const LLAMA_DIR = 'C:\\Users\\rsbiiw\\llama.cpp\\build\\bin\\Release';
const MODEL_DIR = 'C:\\Users\\rsbiiw\\Projects\\models';

async function startModel(gguf) {
    const modelPath = join(MODEL_DIR, gguf);
    if (!existsSync(modelPath)) {
        console.log(`   ❌ Model file not found: ${modelPath}`);
        return null;
    }
    
    console.log(`\n🚀 Starting: ${gguf}`);
    
    // Kill existing
    try { await execAsync('taskkill /F /IM llama-server.exe 2>nul'); } catch {}
    await new Promise(r => setTimeout(r, 2000));
    
    const proc = spawn(LLAMA_SERVER, [
        '-m', modelPath,
        '--port', '8081',
        '--ctx-size', '8192',
        '--threads', '4',
        '--gpu-layers', '99'
    ], { cwd: LLAMA_DIR, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    
    let output = '';
    proc.stdout.on('data', d => { output += d.toString(); });
    proc.stderr.on('data', d => { output += d.toString(); });
    
    // Wait for ready
    console.log('   ⏳ Loading...');
    for (let i = 0; i < 180; i++) {
        try {
            const res = await fetch('http://127.0.0.1:8081/health');
            if (res.ok) {
                console.log('   ✅ Server ready');
                return proc;
            }
        } catch {}
        await new Promise(r => setTimeout(r, 1000));
        if (i % 15 === 0 && i > 0) process.stdout.write('.');
    }
    
    console.log('   ❌ Timeout');
    proc.kill();
    return null;
}

async function testTool(actualModelName, testName, prompt) {
    try {
        const res = await fetch('http://127.0.0.1:8081/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: actualModelName,
                messages: [{ role: 'user', content: prompt }],
                tools: TOOLS,
                tool_choice: 'auto',
                stream: false
            })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            console.log(`   ❌ ${testName}: HTTP ${res.status} - ${data.error?.message || 'unknown'}`);
            return { test: testName, passed: false, httpStatus: res.status, error: data.error?.message };
        }
        
        const msg = data.choices?.[0]?.message || {};
        const toolCalls = msg.tool_calls || [];
        const content = msg.content || '';
        
        const hasToolCalls = toolCalls.length > 0;
        const mentionsTool = content.toLowerCase().includes('tool') ||
                           content.toLowerCase().includes('command') ||
                           content.toLowerCase().includes('run') ||
                           content.toLowerCase().includes('exec');
        
        const passed = hasToolCalls || mentionsTool;
        
        console.log(`   ${passed ? '✅' : '❌'} ${testName}`);
        if (hasToolCalls) {
            console.log(`      📞 Called: ${toolCalls.map(t => t.function.name).join(', ')}`);
        }
        if (content) {
            console.log(`      📝 ${content.substring(0, 120)}`);
        }
        
        return { test: testName, passed, hasToolCalls, contentPreview: content.substring(0, 200), toolCalls };
        
    } catch (err) {
        console.log(`   ❌ ${testName}: ${err.message}`);
        return { test: testName, passed: false, error: err.message };
    }
}

async function main() {
    console.log('══════════════════════════════════════════════');
    console.log('  Model Tool Compatibility Tests v2');
    console.log('══════════════════════════════════════════════');
    console.log(`Models: ${MODELS.length} | Tests/model: 2\n`);
    
    const results = [];
    
    for (const m of MODELS) {
        console.log(`\n${'─'.repeat(50)}`);
        console.log(`  ${m.desc} (${m.arch})`);
        console.log(`${'─'.repeat(50)}`);
        
        const proc = await startModel(m.gguf);
        if (!proc) {
            results.push({ model: m.desc, arch: m.arch, error: 'Failed to start' });
            continue;
        }
        
        // Get actual model name
        const modelsRes = await fetch('http://127.0.0.1:8081/v1/models');
        const modelsData = await modelsRes.json();
        const actualName = modelsData.models?.[0]?.id || modelsData.data?.[0]?.id || m.gguf;
        console.log(`   📋 API name: ${actualName}`);
        
        const tests = [
            await testTool(actualName, 'echo', 'Run: echo TOOL_WORKS'),
            await testTool(actualName, 'whoami', 'Execute: whoami')
        ];
        
        results.push({
            model: m.desc,
            arch: m.arch,
            gguf: m.gguf,
            tests,
            passed: tests.filter(t => t.passed).length,
            total: tests.length
        });
        
        // Cleanup
        try { await execAsync('taskkill /F /IM llama-server.exe 2>nul'); } catch {}
        await new Promise(r => setTimeout(r, 2000));
    }
    
    // Summary
    console.log(`\n\n${'═'.repeat(50)}`);
    console.log('  RESULTS');
    console.log(`${'═'.repeat(50)}\n`);
    
    for (const r of results) {
        if (r.error) {
            console.log(`${r.model} (${r.arch}): ❌ ${r.error}`);
        } else {
            console.log(`${r.model} (${r.arch}): ${r.passed}/${r.total} passed`);
            for (const t of r.tests) {
                console.log(`  ${t.passed ? '✅' : '❌'} ${t.test}`);
            }
        }
    }
    
    const totalP = results.reduce((s, r) => s + (r.passed || 0), 0);
    const totalT = results.reduce((s, r) => s + (r.total || 0), 0);
    console.log(`\nTotal: ${totalP}/${totalT}`);
    
    // Save
    const dir = join(__dirname, 'test-results');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'tool-compatibility-v2.json'), JSON.stringify(results, null, 2));
    console.log(`\n📄 ${join(dir, 'tool-compatibility-v2.json')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
