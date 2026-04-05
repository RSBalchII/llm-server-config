# Git Operations

## Triggers
- git status
- git log
- git diff
- git branch
- git checkout
- git pull
- git push
- git add
- git commit

## Pattern
`\bgit\s+(status|st|log|diff|branch|checkout|pull|push|add|commit|merge|fetch|remote)\b(.*)$`

## Command
`git {{match1}} {{match2}}`

## Safe
true

## Description
Git version control operations
