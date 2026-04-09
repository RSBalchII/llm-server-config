#!/usr/bin/env node

/**
 * A/B Test for Planning Mode
 * Tests if the agent can properly create and execute a plan
 */

import { readFileSync } from 'fs';

const TEST_CASES = [
  {
    name: 'Simple daily routine',
    input: 'brush teeth and clean room in the morning',
    expectedSteps: 2,
  },
  {
    name: 'List project files',
    input: 'show me all files in this directory',
    expectedSteps: 1,
  },
  {
    name: 'Find specific file',
    input: 'find all markdown files',
    expectedSteps: 1,
  },
];

async function testPlanningMode() {
  console.log('=== A/B Test: Planning Mode ===\n');
  console.log('This documents the expected behavior for manual testing.\n');
  
  let testNum = 0;

  for (const test of TEST_CASES) {
    testNum++;
    console.log(`\n📋 Test ${testNum}: ${test.name}`);
    console.log(`👤 Input: "${test.input}"`);
    console.log('─'.repeat(60));
    
    console.log('\n✅ Expected behavior:');
    console.log(`   1. Detect as complex task`);
    console.log(`   2. Create numbered plan with ~${test.expectedSteps} steps`);
    console.log(`   3. Execute each step`);
    console.log(`   4. Show summary`);
    console.log('');
    console.log('🔍 Run manually:');
    console.log(`   .\\start.bat`);
    console.log(`   👤 You: ${test.input}`);
    console.log('');
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Total tests: ${TEST_CASES.length}`);
  console.log('Run these tests manually and verify the output matches.');
  console.log('='.repeat(60));
}

testPlanningMode().catch(console.error);
