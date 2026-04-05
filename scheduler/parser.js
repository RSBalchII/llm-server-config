#!/usr/bin/env node

// Natural Language Schedule Parser
// Converts "every day at 8am" → "0 8 * * *"

const DAY_NAMES = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
  weekdays: '1-5', weekends: '0,6',
};

const TIME_PATTERNS = [
  // "every day at 8am" / "every day at 8:30pm"
  {
    pattern: /every\s+day\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
    handler: (m) => ({
      cron: `${m[2] || '0'} ${to24h(m[1], m[3])} * * *`,
      human: `Every day at ${formatTime(m[1], m[2], m[3])}`,
    }),
  },

  // "every weekday at 9am"
  {
    pattern: /every\s+weekday\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
    handler: (m) => ({
      cron: `${m[2] || '0'} ${to24h(m[1], m[3])} * * 1-5`,
      human: `Every weekday at ${formatTime(m[1], m[2], m[3])}`,
    }),
  },

  // "every weekend at 10am"
  {
    pattern: /every\s+weekend\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
    handler: (m) => ({
      cron: `${m[2] || '0'} ${to24h(m[1], m[3])} * * 0,6`,
      human: `Every weekend at ${formatTime(m[1], m[2], m[3])}`,
    }),
  },

  // "every monday at 8am" (specific day)
  {
    pattern: /every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
    handler: (m) => ({
      cron: `${m[3] || '0'} ${to24h(m[2], m[4])} * * ${DAY_NAMES[m[1].toLowerCase()]}`,
      human: `Every ${capitalize(m[1])} at ${formatTime(m[2], m[3], m[4])}`,
    }),
  },

  // "every morning" (ambiguous - default to 8am)
  {
    pattern: /every\s+morning/i,
    handler: (m) => ({
      cron: `0 8 * * *`,
      human: `Every morning at 8:00 AM (default)`,
      ambiguous: true,
      suggestions: ['6am', '7am', '8am', '9am'],
    }),
  },

  // "every night" (ambiguous - default to 10pm)
  {
    pattern: /every\s+night/i,
    handler: (m) => ({
      cron: `0 22 * * *`,
      human: `Every night at 10:00 PM (default)`,
      ambiguous: true,
      suggestions: ['8pm', '9pm', '10pm', '11pm'],
    }),
  },

  // "every hour"
  {
    pattern: /every\s+hour/i,
    handler: (m) => ({
      cron: `0 * * * *`,
      human: `Every hour`,
    }),
  },

  // "every 5 minutes" / "every 10 minutes"
  {
    pattern: /every\s+(\d+)\s+minute/i,
    handler: (m) => {
      const mins = parseInt(m[1]);
      if (mins < 1 || mins > 59) return null;
      return {
        cron: `*/${mins} * * * *`,
        human: `Every ${mins} minute${mins > 1 ? 's' : ''}`,
      };
    },
  },

  // "every 2 hours"
  {
    pattern: /every\s+(\d+)\s+hour/i,
    handler: (m) => {
      const hours = parseInt(m[1]);
      if (hours < 1 || hours > 23) return null;
      return {
        cron: `0 */${hours} * * *`,
        human: `Every ${hours} hour${hours > 1 ? 's' : ''}`,
      };
    },
  },

  // "every week" / "weekly"
  {
    pattern: /every\s+week|weekly/i,
    handler: (m) => ({
      cron: `0 0 * * 0`,
      human: `Every week on Sunday at 12:00 AM`,
    }),
  },

  // "every month" / "monthly"
  {
    pattern: /every\s+month|monthly/i,
    handler: (m) => ({
      cron: `0 0 1 * *`,
      human: `Every month on the 1st at 12:00 AM`,
    }),
  },

  // "every year" / "yearly" / "annually"
  {
    pattern: /every\s+year|yearly|annually/i,
    handler: (m) => ({
      cron: `0 0 1 1 *`,
      human: `Every year on January 1st at 12:00 AM`,
    }),
  },

  // "at 8am" (assumes daily)
  {
    pattern: /^at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i,
    handler: (m) => ({
      cron: `${m[2] || '0'} ${to24h(m[1], m[3])} * * *`,
      human: `Daily at ${formatTime(m[1], m[2], m[3])}`,
    }),
  },

  // "midnight"
  {
    pattern: /at\s+midnight/i,
    handler: (m) => ({
      cron: `0 0 * * *`,
      human: `Every day at midnight (12:00 AM)`,
    }),
  },

  // "noon" / "midday"
  {
    pattern: /at\s+(noon|midday)/i,
    handler: (m) => ({
      cron: `0 12 * * *`,
      human: `Every day at noon (12:00 PM)`,
    }),
  },
];

function to24h(hour, ampm) {
  let h = parseInt(hour);
  if (ampm) {
    const isPm = ampm.toLowerCase() === 'pm';
    if (isPm && h < 12) h += 12;
    if (!isPm && h === 12) h = 0;
  }
  return h.toString();
}

function formatTime(hour, min, ampm) {
  const h = parseInt(hour);
  const m = min || '00';
  if (ampm) {
    return `${h}:${m.padStart(2, '0')} ${ampm.toUpperCase()}`;
  }
  return `${h}:${m.padStart(2, '0')}`;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function isValidCron(cron) {
  const parts = cron.split(/\s+/);
  if (parts.length !== 5) return false;

  const [min, hour, day, month, dow] = parts;

  // Basic validation
  if (!/^\d{1,2}$|^\*|^\d+-\d+$|^\d+,\d+$|^\*\/\d+$/.test(min)) return false;
  if (!/^\d{1,2}$|^\*|^\d+-\d+$|^\d+,\d+$|^\*\/\d+$/.test(hour)) return false;
  if (!/^\d{1,2}$|^\*|^\d+-\d+$|^\d+,\d+$|^\?/.test(day)) return false;
  if (!/^\d{1,2}$|^\*|^\d+-\d+$|^\d+,\d+$/.test(month)) return false;
  if (!/^\d{1}$|^\*|^\d+-\d+$|^\d+,\d+$/.test(dow)) return false;

  return true;
}

export function parseSchedule(input) {
  // Try pattern matching first
  for (const tp of TIME_PATTERNS) {
    const match = input.match(tp.pattern);
    if (match) {
      const result = tp.handler(match);
      if (result) {
        if (!isValidCron(result.cron)) {
          return {
            success: false,
            error: `Invalid cron expression generated: ${result.cron}`
          };
        }
        return { success: true, ...result };
      }
    }
  }

  // No pattern matched
  return {
    success: false,
    error: 'Could not parse schedule. Try formats like: "every day at 8am", "every 5 minutes", "every weekday at 9:30am"'
  };
}

export function getSuggestions(input) {
  // For ambiguous inputs, return suggestions
  if (/every\s+(morning|night|afternoon)/i.test(input)) {
    const time = /morning/i.test(input) ? '8am' : '10pm';
    return {
      ambiguous: true,
      message: `Please specify a time. Did you mean "every day at ${time}"?`,
      suggestions: TIME_PATTERNS
        .filter(p => p.pattern.toString().includes('every\\s+day'))
        .map(p => {
          const match = 'every day at 8am'.match(p.pattern);
          return match ? p.handler(match).human : null;
        })
        .filter(Boolean),
    };
  }
  return { ambiguous: false };
}
