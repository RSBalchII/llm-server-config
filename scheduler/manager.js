#!/usr/bin/env node

// Schedule storage and management

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { parseSchedule } from './parser.js';

const SCHEDULES_FILE = 'schedules.json';

export function loadSchedules() {
  try {
    if (!existsSync(SCHEDULES_FILE)) {
      return [];
    }
    const data = readFileSync(SCHEDULES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('⚠️  Could not load schedules:', error.message);
    return [];
  }
}

export function saveSchedules(schedules) {
  try {
    writeFileSync(SCHEDULES_FILE, JSON.stringify(schedules, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Could not save schedules:', error.message);
    return false;
  }
}

export function addSchedule(input, command) {
  // Parse natural language
  const parsed = parseSchedule(input);
  
  if (!parsed.success) {
    return { success: false, error: parsed.error };
  }
  
  // Create schedule object
  const schedule = {
    id: `sched_${Date.now()}`,
    name: parsed.human,
    cron: parsed.cron,
    command: command,
    enabled: true,
    created: new Date().toISOString(),
    lastRun: null,
    runCount: 0,
  };
  
  // Save
  const schedules = loadSchedules();
  schedules.push(schedule);
  saveSchedules(schedules);
  
  return { success: true, schedule };
}

export function listSchedules() {
  return loadSchedules();
}

export function removeSchedule(id) {
  const schedules = loadSchedules();
  const filtered = schedules.filter(s => s.id !== id);
  
  if (filtered.length === schedules.length) {
    return { success: false, error: 'Schedule not found' };
  }
  
  saveSchedules(filtered);
  return { success: true };
}

export function toggleSchedule(id, enabled) {
  const schedules = loadSchedules();
  const schedule = schedules.find(s => s.id === id);
  
  if (!schedule) {
    return { success: false, error: 'Schedule not found' };
  }
  
  schedule.enabled = enabled;
  saveSchedules(schedules);
  return { success: true, schedule };
}

export function formatSchedule(schedule) {
  const status = schedule.enabled ? '✓' : '✗';
  return `${status} [${schedule.id}] ${schedule.name}
   Cron: ${schedule.cron}
   Command: ${schedule.command}
   Runs: ${schedule.runCount} times`;
}
