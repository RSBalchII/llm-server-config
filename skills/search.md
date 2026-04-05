# Search and Find

## Triggers
- search for
- find file
- grep text
- look for

## Patterns

### Grep with quotes
Pattern: `\b(search|find|grep|look\s+for)\s+(for\s+)?"([^"]+)"\s+(in|at|within)?\s*(.*)\s*$`
Command: `grep -rn "{{match3}}" {{match5}}`

### Grep in location
Pattern: `\b(search|grep|look\s+for)\s+(for\s+)?(.+?)\s+(in|at|within)\s+(.+)\s*$`
Command: `grep -rn "{{match3}}" {{match5}}`

### Simple grep
Pattern: `\b(search|grep)\s+(for\s+)?(.+)\s*$`
Command: `grep -rn "{{match3}}" .`

### Find directory
Pattern: `\b(find|locate|search\s+for)\s+(the\s+)?(project|dir|directory|folder|file)\s*(called|named|as)?\s*(\S+)\s*$`
Command: `find . -type d -iname "*{{match5}}*"`

### Find by name
Pattern: `\b(find|locate)\s+(.+)\s*$`
Command: `find . -iname "*{{match2}}*"`

## Safe
true

## Description
Search files and directories
