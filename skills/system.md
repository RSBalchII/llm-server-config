# System Information

## Triggers
- what is my user
- show date
- disk usage
- memory usage
- cpu info
- show processes

## Patterns

### User info
Pattern: `\bwhat\s+(is|'s)\s+(my|the|your)\s+(user|username|name)\s*$`
Command: `whoami`

### Current directory
Pattern: `\bwhat\s+(is|'s)\s+(my|the|your)\s+(pwd|directory|current\s+dir)\s*$`
Command: `pwd`

### Date/Time
Pattern: `\b(what'?s|what\s+is|show|check|get)\s+(my\s+|the\s+|your\s+)?(date|time)\s*$`
Command: `date`

### Hostname
Pattern: `\b(what'?s|what\s+is|show|check|get)\s+(my\s+|the\s+|your\s+)?(hostname|host|computer\s+name)\s*$`
Command: `hostname`

### Disk usage
Pattern: `\b(disk|storage)\s+(info|usage|free|space|status)?\s*$`
Command: `df -h /data`

### Memory usage
Pattern: `\b(memory|ram)\s+(info|usage|free|status)?\s*$`
Command: `free -h`

### CPU info
Pattern: `\bcpu\s+(info|usage|status)?\s*$`
Command: `top -bn1 | head -5`

### Processes
Pattern: `\b(processes|procs|running)\s*$`
Command: `ps aux | head -15`

### Uptime
Pattern: `\b(what'?s|what\s+is|show|check|get)\s+(my\s+|the\s+|your\s+)?uptime\s*$`
Command: `uptime`

### PATH
Pattern: `\b(what'?s|what\s+is|show|check|get)\s+(my\s+|the\s+|your\s+)?path\s*$`
Command: `echo $PATH`

### Home directory
Pattern: `\b(what'?s|what\s+is|show|check|get)\s+(my\s+|the\s+|your\s+)?home\s*$`
Command: `echo $HOME`

## Safe
true

## Description
System information and status commands
