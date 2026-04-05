# File Operations

## Triggers
- list files
- show directories
- create file
- read file
- show file contents

## Patterns

### List files
Pattern: `\b(list|show|see|find|look\s+at|get|display)\s*(files|dir|directory|contents|items)?\s*(in\s+)?(current\s+)?(dir|directory)?\s*$`
Command: `ls -la`

### List files in path
Pattern: `\b(list|show|see|find)\s+(files|items)\s+(in|at)\s+(.+)\s*$`
Command: `ls -la {{match4}}`

### List directories
Pattern: `\b(list|show)\s+(dirs|directories|folders)\s*(in\s+)?(current\s+)?(dir|directory)?\s*$`
Command: `find . -maxdepth 1 -type d`

### Show file contents
Pattern: `\b(show|read|display|cat)\s+(the\s+)?(contents?|file)?\s*(of\s+)?([^\s.]+\.[^\s.]+|\S+)\s*$`
Command: `cat {{match5}}`

### Create file with content
Pattern: `\b(create|make|write|save)\s+(a\s+)?file\s+(called|named|as)?\s+(\S+)\s+(with|containing|that\s+says)\s+(.+)\s*$`
Command: `echo "{{match6}}" > {{match4}}`

### Create empty file
Pattern: `\b(create|make|touch)\s+(a\s+)?(file\s+)?(called|named|as)?\s+(\S+)\s*$`
Command: `touch {{match5}}`

## Safe
true

## Description
File and directory operations
