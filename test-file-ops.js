#!/usr/bin/env node

/**
 * Automated Test Suite for File Operations
 * Tests append, prepend, replace, move, copy operations
 */

import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

const TEST_DIR = resolve('test-file-ops-tmp');

// Helper functions
function cleanup() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

function setup() {
  cleanup();
  mkdirSync(TEST_DIR, { recursive: true });
}

function createTestFile(name, content) {
  const path = join(TEST_DIR, name);
  writeFileSync(path, content);
  return path;
}

function readFile(path) {
  return readFileSync(path, 'utf-8');
}

// Tool implementations (copied from agent.js for testing)
async function toolAppendFile(filepath, content) {
  try {
    const { appendFileSync } = await import('fs');
    appendFileSync(filepath, content);
    return { success: true, output: `Appended to: ${filepath}` };
  } catch (error) {
    return { success: false, output: error.message };
  }
}

async function toolPrependFile(filepath, content) {
  try {
    const { readFileSync, writeFileSync, existsSync } = await import('fs');
    const existing = existsSync(filepath) ? readFileSync(filepath, 'utf-8') : '';
    writeFileSync(filepath, content + '\n' + existing);
    return { success: true, output: `Prepended to: ${filepath}` };
  } catch (error) {
    return { success: false, output: error.message };
  }
}

async function toolReplaceInFile(filepath, search, replace) {
  try {
    const { readFileSync, writeFileSync, existsSync } = await import('fs');
    if (!existsSync(filepath)) {
      return { success: false, output: `File not found: ${filepath}` };
    }
    let content = readFileSync(filepath, 'utf-8');
    const count = (content.match(new RegExp(search, 'g')) || []).length;
    content = content.split(search).join(replace);
    writeFileSync(filepath, content);
    return { success: true, output: `Replaced ${count} occurrence(s) in ${filepath}` };
  } catch (error) {
    return { success: false, output: error.message };
  }
}

async function toolCopyFile(source, dest) {
  try {
    const { readFileSync, writeFileSync, existsSync } = await import('fs');
    if (!existsSync(source)) {
      return { success: false, output: `Source not found: ${source}` };
    }
    const content = readFileSync(source);
    writeFileSync(dest, content);
    return { success: true, output: `Copied: ${source} → ${dest}` };
  } catch (error) {
    return { success: false, output: error.message };
  }
}

async function toolMoveFile(source, dest) {
  try {
    const { existsSync, renameSync } = await import('fs');
    if (!existsSync(source)) {
      return { success: false, output: `Source not found: ${source}` };
    }
    renameSync(source, dest);
    return { success: true, output: `Moved: ${source} → ${dest}` };
  } catch (error) {
    return { success: false, output: error.message };
  }
}

// Test cases
const TEST_CASES = [
  {
    name: 'Append to file',
    setup: () => createTestFile('test.txt', 'Hello'),
    run: async (path) => await toolAppendFile(path, ' World'),
    verify: (path) => {
      const content = readFile(path);
      return content === 'Hello World' ? 'PASS' : `FAIL: Got "${content}"`;
    },
  },
  {
    name: 'Prepend to file',
    setup: () => createTestFile('test.txt', 'World'),
    run: async (path) => await toolPrependFile(path, 'Hello'),
    verify: (path) => {
      const content = readFile(path);
      return content.startsWith('Hello\n') ? 'PASS' : `FAIL: Got "${content}"`;
    },
  },
  {
    name: 'Replace in file',
    setup: () => createTestFile('test.txt', 'foo bar foo baz'),
    run: async (path) => await toolReplaceInFile(path, 'foo', 'qux'),
    verify: (path) => {
      const content = readFile(path);
      return content === 'qux bar qux baz' ? 'PASS' : `FAIL: Got "${content}"`;
    },
  },
  {
    name: 'Copy file',
    setup: () => createTestFile('source.txt', 'test content'),
    run: async (path) => {
      const dest = join(TEST_DIR, 'dest.txt');
      return await toolCopyFile(path, dest);
    },
    verify: (path) => {
      const dest = join(TEST_DIR, 'dest.txt');
      if (!existsSync(dest)) return 'FAIL: Dest file not created';
      const src = readFile(path);
      const dst = readFile(dest);
      return src === dst ? 'PASS' : 'FAIL: Content mismatch';
    },
  },
  {
    name: 'Move/rename file',
    setup: () => createTestFile('old.txt', 'test'),
    run: async (path) => {
      const dest = join(TEST_DIR, 'new.txt');
      return await toolMoveFile(path, dest);
    },
    verify: (path) => {
      const dest = join(TEST_DIR, 'new.txt');
      if (!existsSync(dest)) return 'FAIL: Dest file not created';
      if (existsSync(path)) return 'FAIL: Source still exists';
      return 'PASS';
    },
  },
];

// Run tests
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   File Operations Test Suite                            ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  setup();
  
  let passed = 0;
  let failed = 0;

  for (const test of TEST_CASES) {
    console.log(`\n📋 Test: ${test.name}`);
    console.log('─'.repeat(60));
    
    try {
      const path = test.setup();
      const result = await test.run(path);
      
      console.log(`   Result: ${result.output}`);
      
      const verify = test.verify(path);
      if (verify === 'PASS') {
        console.log(`   ✅ PASS`);
        passed++;
      } else {
        console.log(`   ❌ ${verify}`);
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      failed++;
    }
  }

  cleanup();
  
  console.log('\n' + '═'.repeat(60));
  console.log(`Total: ${TEST_CASES.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / TEST_CASES.length) * 100).toFixed(1)}%`);
  console.log('═'.repeat(60));
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('💥 Fatal:', error);
  cleanup();
  process.exit(1);
});
