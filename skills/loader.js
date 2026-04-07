#!/usr/bin/env node

// Skill file loader - parses .md skill files into intent patterns

import { readFileSync, readdirSync, watch } from 'fs';
import { join } from 'path';

const SKILLS_DIR = join(process.cwd(), 'skills');

export function loadSkills() {
  const allPatterns = [];
  
  try {
    const files = readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'));
    
    for (const file of files) {
      const content = readFileSync(join(SKILLS_DIR, file), 'utf-8');
      const skill = parseSkillFile(content, file);
      
      if (skill && skill.patterns) {
        allPatterns.push(...skill.patterns);
      }
    }
  } catch (error) {
    console.error(`⚠️  Could not load skills: ${error.message}`);
  }
  
  return allPatterns;
}

function parseSkillFile(content, filename) {
  const skill = {
    name: filename,
    patterns: [],
    safe: true,
    description: '',
  };
  
  const lines = content.split('\n');
  let currentPattern = null;
  let inPatternsSection = false;
  const patterns = [];  // Collect patterns locally
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Parse sections
    if (line.startsWith('## Patterns')) {
      inPatternsSection = true;
      continue;
    }
    
    if (line.startsWith('## ')) {
      inPatternsSection = false;
      
      // Parse single pattern format
      if (line.startsWith('## Pattern')) {
        const patternLine = lines[i + 1]?.trim();
        if (patternLine) {
          currentPattern = { pattern: patternLine.replace(/^`|`$/g, '') };
        }
        continue;
      }
      
      // Parse metadata
      if (line.startsWith('## Command')) {
        if (currentPattern) {
          const cmdLine = lines[i + 1]?.trim();
          if (cmdLine) {
            currentPattern.command = cmdLine.replace(/^`|`$/g, '');
          }
        }
        continue;
      }
      
      if (line.startsWith('## Safe')) {
        const safeLine = lines[i + 1]?.trim().toLowerCase();
        skill.safe = safeLine !== 'false';
        continue;
      }
      
      if (line.startsWith('## Description')) {
        skill.description = lines[i + 1]?.trim() || '';
        continue;
      }
    }
    
    // Parse pattern blocks in Patterns section
    if (inPatternsSection && line.startsWith('Pattern:')) {
      if (currentPattern) {
        patterns.push(currentPattern);
      }
      currentPattern = {
        pattern: line.replace(/^Pattern:\s*/i, '').replace(/^`|`$/g, '').trim(),
      };
      continue;
    }
    
    if (inPatternsSection && line.startsWith('Command:')) {
      if (currentPattern) {
        currentPattern.command = line.replace(/^Command:\s*/i, '').replace(/^`|`$/g, '').trim();
      }
      continue;
    }
  }
  
  // Push last pattern
  if (currentPattern) {
    patterns.push(currentPattern);
  }
  
  // Convert pattern strings to regex handlers
  skill.patterns = patterns.map(p => ({
    pattern: stringToRegex(p.pattern),
    handler: createCommandHandler(p.command),
    safe: skill.safe,
  }));
  
  return skill;
}

function stringToRegex(patternStr) {
  // Extract regex from backticks or use as-is
  const regexStr = patternStr.replace(/^`|`$/g, '').trim();
  try {
    return new RegExp(regexStr, 'i');
  } catch (error) {
    console.error(`⚠️  Invalid regex in pattern: ${regexStr}`);
    return null;
  }
}

function createCommandHandler(commandTemplate) {
  return (match) => {
    let command = commandTemplate;
    
    // Replace {{match1}}, {{match2}}, etc. with capture groups
    for (let i = 1; i < match.length; i++) {
      const placeholder = `{{match${i}}}`;
      const value = match[i] || '';
      command = command.replace(new RegExp(placeholder, 'g'), value);
    }
    
    return command.trim();
  };
}

// Hot reload on file changes
let skillsCache = null;
export function loadSkillsCached() {
  if (!skillsCache) {
    skillsCache = loadSkills();
  }
  return skillsCache;
}

export function watchSkills() {
  try {
    watch(SKILLS_DIR, () => {
      console.log('📚 Skills reloaded');
      skillsCache = loadSkills();
    });
  } catch (error) {
    // Watch not supported
  }
}
