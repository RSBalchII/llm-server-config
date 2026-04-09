#!/usr/bin/env node
/**
 * Model Tool Compatibility Tester
 * Tests if different model types can execute tools via API
 */

import { exec, spawn } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { promisify } from 'util';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Models to test
const MODELS = [
    { num: 14, name: 'Qwen3.5-4B-heretic', arch: 'qwen', desc: 'Qwen 3.5 4B (baseline)' },
    { num: 6,  name: 'gemma-4-E4B-it-Heretic', arch: 'gemma', desc: 'Gemma 4 E4B (Google)' },
    { num: 4,  name: 'gemma-4-26B-A4B-it-heretic', arch: 'gemma-moe', desc: 'Gemma 4 26B MoE' },
    { num: 2,  name: 'DeepSeek-R1-0528-Qwen3-8B', arch: 'deepseek-qwen', desc: 'DeepSeek-R1 distilled' },
    { num: 3,  name: 'DeepSeek-R1-Distill-Qwen-7B', arch: 'deepseek-qwen', desc: 'DeepSeek-R1 7B' },
    { num: 15, name: 'Stable-DiffCoder-8B', arch: 'diffusion-coder', desc: 'Diffusion Coder' },
];

const TOOLS = [
    {
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
    }
];

async function startModel(modelNum) {
    console.log(`\n🚀 Starting model #${modelNum}...`);
    
    // Kill ONLY llama-server (not all node processes!)
    try {
        await execAsync('taskkill /F /IM llama-server.exe 2>nul');
    } catch {}
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Start model
    const bat = spawn('cmd.exe', ['/c', `echo ${modelNum} | start.bat`], {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    bat.stdout.on('data', d => {
        output += d.toString();
        process.stdout.write(d.toString().substring(0, 200));
    });
    bat.stderr.on('data', d => {
        output += d.toString();
    });
    
    // Wait for server to be ready by polling health
    console.log('   ⏳ Waiting for server...');
    for (let i = 0; i < 120; i++) {
        try {
            const res = await fetch(`http://127.0.0.1:${8081}/health`);
            if (res.ok) {
                console.log('   ✅ Server ready');
                return bat;
            }
        } catch {}
        await new Promise(r => setTimeout(r, 1000));
        if (i % 10 === 0) process.stdout.write('.');
    }
    
    throw new Error('Server did not start within 120 seconds');
}

async function testTools(modelName) {
    // Get actual model name from llama-server
    const modelsRes = await fetch('http://127.0.0.1:8081/v1/models');
    const modelsData = await modelsRes.json();
    const actualModelName = modelsRes.ok ? (modelsData.models?.[0]?.id || modelsData.data?.[0]?.id || modelName) : modelName;
    console.log(`   📋 Model name: ${actualModelName}`);
    
    const tests = [
        {
            name: 'echo_command',
            messages: [{ role: 'user', content: 'Execute: echo TOOL_TEST_PASSED' }]
        },
        {
            name: 'dir_command',
            messages: [{ role: 'user', content: 'Run: dir C:\\Users\\rsbiiw\\Projects\\micro-nano-bot /b' }]
        }
    ];
    
    const results = [];
    
    for (const test of tests) {
        try {
            console.log(`   🧪 Testing: ${test.name}`);
            
            const res = await fetch('http://127.0.0.1:8081/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: actualModelName,
                    messages: test.messages,
                    tools: TOOLS,
                    tool_choice: 'auto',
                    stream: false
                })
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                console.log(`      ❌ HTTP ${res.status}: ${JSON.stringify(data).substring(0, 200)}`);
                results.push({ test: test.name, passed: false, error: `HTTP ${res.status}`, response: data });
                continue;
            }
            
            const message = data.choices?.[0]?.message;
            const hasToolCalls = message?.tool_calls?.length > 0;
            const content = message?.content || '';
            const mentionsTool = content.includes('tool') || 
                               content.includes('command') ||
                               content.includes('TOOL_TEST_PASSED') ||
                               content.includes('dir');
            
            const passed = hasToolCalls || mentionsTool;
            
            results.push({
                test: test.name,
                passed,
                hasToolCalls,
                contentPreview: content.substring(0, 200),
                toolCalls: message?.tool_calls || null
            });
            
            console.log(`      ${passed ? '✅ PASS' : '❌ FAIL'}`);
            if (hasToolCalls) {
                console.log(`      📞 Tool calls: ${message.tool_calls.map(t => t.function.name).join(', ')}`);
            }
            if (content) {
                console.log(`      📝 Content: ${content.substring(0, 150)}`);
            }
            
        } catch (error) {
            results.push({
                test: test.name,
                passed: false,
                error: error.message
            });
            console.log(`      ❌ ERROR: ${error.message}`);
        }
    }
    
    return results;
}

async function main() {
    console.log('══════════════════════════════════════════════');
    console.log('  Model Tool Compatibility Test Suite');
    console.log('══════════════════════════════════════════════');
    console.log(`Models: ${MODELS.length}`);
    console.log('══════════════════════════════════════════════\n');
    
    const allResults = [];
    
    for (const model of MODELS) {
        console.log(`\n${'═'.repeat(60)}`);
        console.log(`  Testing: ${model.name} (${model.desc})`);
        console.log(`${'═'.repeat(60)}`);
        
        let serverProcess;
        try {
            serverProcess = await startModel(model.num);
            const testResults = await testTools(model.name);
            
            allResults.push({
                model: model.name,
                arch: model.arch,
                tests: testResults,
                passed: testResults.filter(t => t.passed).length,
                total: testResults.length
            });
            
        } catch (error) {
            console.log(`   ❌ Failed to start: ${error.message}`);
            allResults.push({
                model: model.name,
                arch: model.arch,
                error: error.message
            });
        }
        
        // Cleanup - only llama-server
        try {
            await execAsync('taskkill /F /IM llama-server.exe 2>nul');
        } catch {}
        await new Promise(r => setTimeout(r, 3000));
    }
    
    // Summary
    console.log('\n\n══════════════════════════════════════════════');
    console.log('  RESULTS SUMMARY');
    console.log('══════════════════════════════════════════════\n');
    
    for (const r of allResults) {
        const status = r.error ? '❌ ERROR' : `${r.passed}/${r.total} passed`;
        console.log(`${r.model} (${r.arch}): ${status}`);
    }
    
    const totalPassed = allResults.reduce((sum, r) => sum + (r.passed || 0), 0);
    const totalTests = allResults.reduce((sum, r) => sum + (r.total || 0), 0);
    console.log(`\nOverall: ${totalPassed}/${totalTests} tests passed`);
    
    // Save results
    const reportDir = join(__dirname, 'test-results');
    mkdirSync(reportDir, { recursive: true });
    writeFileSync(
        join(reportDir, 'model-tool-compatibility.json'),
        JSON.stringify(allResults, null, 2)
    );
    console.log(`\n📄 Report: test-results/model-tool-compatibility.json`);
}

main().catch(console.error);
