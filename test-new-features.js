#!/usr/bin/env node

// Test script for new features

import { loadSkills } from './skills/loader.js';
import { parseSchedule } from './scheduler/parser.js';

console.log('🧪 Testing micro-nanobot enhancements\n');

// Test 1: Skill loading
console.log('📚 Test 1: Loading skills...');
const skills = loadSkills();
console.log(`   ✓ Loaded ${skills.length} patterns from skills`);

// Test 2: Schedule parsing
console.log('\n📅 Test 2: Schedule parsing...');
const scheduleTests = [
  'every day at 8am',
  'every weekday at 9:30am',
  'every 5 minutes',
  'every monday at 10am',
  'every morning',
  'at midnight',
];

for (const test of scheduleTests) {
  const result = parseSchedule(test);
  if (result.success) {
    console.log(`   ✓ "${test}" → ${result.cron} (${result.human})`);
  } else {
    console.log(`   ❌ "${test}" → ${result.error}`);
  }
}

console.log('\n✅ All tests complete!\n');
