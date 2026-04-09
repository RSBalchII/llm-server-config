# File Operations

## Triggers
- list files
- show directories
- create file
- read file
- show file contents
- append to file
- prepend to file
- replace in file
- move/rename file
- copy file

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

### Append to file
Pattern: `\b(append|add)\s+(.+?)\s+to\s+(.+)\s*$`
Type: `append_file`
Path: `{{match3}}`
Content: `{{match2}}`

### Prepend to file
Pattern: `\b(prepend|add to top of)\s+(.+?)\s+to\s+(.+)\s*$`
Type: `prepend_file`
Path: `{{match3}}`
Content: `{{match2}}`

### Replace in file
Pattern: `\b(replace|substitute)\s+(.+?)\s+with\s+(.+?)\s+in\s+(.+)\s*$`
Type: `replace_in_file`
Path: `{{match4}}`
Search: `{{match2}}`
Replace: `{{match3}}`

### Move/Rename file
Pattern: `\b(move|rename)\s+(.+?)\s+to\s+(.+)\s*$`
Type: `move_file`
Source: `{{match2}}`
Dest: `{{match3}}`

### Copy file
Pattern: `\b(copy|duplicate)\s+(.+?)\s+to\s+(.+)\s*$`
Type: `copy_file`
Source: `{{match2}}`
Dest: `{{match3}}`

## Safe
true

## Description
File and directory operations, including append, prepend, replace, move, and copy
