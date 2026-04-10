# Context Serialization & Graph Packaging

## Triggers
- context serializer, graph context, context package, user context, query intent, memory node, assembleContext, serialize graph, prompt wrapper

## Core Concepts

### Context Package Structure
How Anchor Engine packages search results for LLM consumption.

```typescript
interface ContextPackage {
  userContext: UserContext;      // User's session/state
  queryIntent: QueryIntent;      // Parsed query understanding
  memoryNodes: MemoryNode[];     // Retrieved knowledge nodes
  contextString: string;         // Formatted for LLM prompt
}
```

### User Context
Tracks user state across sessions:

```typescript
interface UserContext {
  userId: string;
  sessionId: string;
  buckets: string[];           // User's active buckets
  preferences: Record<string, any>;
  history: { query: string; timestamp: number }[];
}
```

### Query Intent
Parsed understanding of what user wants:

```typescript
interface QueryIntent {
  query: string;               // Original query
  terms: string[];             // Parsed terms
  temporalContext: {           // Time constraints
    before?: number;
    after?: number;
  };
  semanticCategory?: string;   // e.g., "code", "notes", "chat"
  isExpansionReady: boolean;   // Can semantic search help?
}
```

### Memory Node
Individual knowledge unit returned by search:

```typescript
interface MemoryNode {
  id: string;                  // Atom or molecule ID
  content: string;             // Actual content
  source: string;              // File path
  timestamp: number;           // When ingested
  score: number;               // Relevance score (0-1)
  tags: string[];              // Semantic tags
  buckets: string[];           // Logical groupings
  provenance: string;          // internal|external|quarantine
  compound_id?: string;        // Parent compound
  start_byte?: number;         // Byte offset (for atoms)
  end_byte?: number;
}
```

### Graph Context Serializer
Assembles memory nodes into a graph structure for LLM:

```json
{
  "nodes": [
    {
      "id": "node_123",
      "content": "Physics walker uses radial inflation...",
      "score": 0.95,
      "tags": ["search", "physics-walker"],
      "relationships": ["node_456", "node_789"]
    }
  ],
  "edges": [
    { "from": "node_123", "to": "node_456", "weight": 0.8 },
    { "from": "node_123", "to": "node_789", "weight": 0.6 }
  ],
  "metadata": {
    "query": "how does search work",
    "nodeCount": 15,
    "maxScore": 0.95
  }
}
```

### Assemble Context Package
Main function that packages everything:

```typescript
function assembleContextPackage(
  query: string,
  nodes: MemoryNode[],
  userContext: UserContext
): ContextPackage {
  return {
    userContext,
    queryIntent: parseQueryIntent(query),
    memoryNodes: nodes,
    contextString: assembleAndSerialize(nodes)
  };
}
```

### Serialize to Prompt
Convert graph to LLM-readable format:

```typescript
function assembleAndSerialize(nodes: MemoryNode[]): string {
  // Format: Ranked nodes with metadata
  let output = `Knowledge Graph Results (${nodes.length} nodes):\n\n`;
  
  nodes.forEach((node, i) => {
    output += `--- Node ${i + 1} (Score: ${node.score.toFixed(2)}) ---\n`;
    output += `Content: ${node.content}\n`;
    output += `Source: ${node.source}\n`;
    output += `Tags: ${node.tags.join(', ')}\n`;
    output += `Provenance: ${node.provenance}\n\n`;
  });
  
  return output;
}
```

### Prompt Wrapper
How context is injected into LLM prompt:

```typescript
const promptWrapper = `Here is a graph of thoughts from my memory, ranked by mathematical relevance (Time + Logic). Use these nodes to answer my question. Do not use outside knowledge unless necessary.

\`\`\`json
${jsonString}
\`\`\``;
```

### Common Pitfalls (Stumps Small Models)
❌ **WRONG**: "Context package = prompt text"  
✅ **CORRECT**: Context package is structured data; serialized separately for prompt

❌ **WRONG**: "Memory nodes are independent"  
✅ **CORRECT**: Nodes have relationships forming a knowledge graph

❌ **WRONG**: "Query intent is just parsed keywords"  
✅ **CORRECT**: Includes temporal context, semantic category, expansion readiness

❌ **WRONG**: "Higher score = more relevant"  
✅ **CORRECT**: Score combines relevance + recency + tag match

### Context Assembly Strategies

**Strategy 1: Ranked List (Default)**
```
Node 1 (score: 0.95): Content...
Node 2 (score: 0.87): Content...
Node 3 (score: 0.72): Content...
```

**Strategy 2: Grouped by Tag**
```
## Search-Related (3 nodes)
- Node about physics walker
- Node about radial inflation
- Node about context inflator

## Database (2 nodes)
- Node about PGlite
- Node about molecules table
```

**Strategy 3: Graph Format**
```
Nodes:
A → B (weight: 0.8)
A → C (weight: 0.6)
B → D (weight: 0.9)

Content:
A: "Physics walker..."
B: "Radial inflation..."
...
```

### Token Budget Management
Control how much context to send to LLM:

```typescript
function trimToBudget(
  nodes: MemoryNode[], 
  maxTokens: number
): MemoryNode[] {
  let totalTokens = 0;
  const result: MemoryNode[] = [];
  
  for (const node of nodes) {
    const nodeTokens = estimateTokens(node.content);
    if (totalTokens + nodeTokens > maxTokens) break;
    result.push(node);
    totalTokens += nodeTokens;
  }
  
  return result;
}
```

**Default Budgets:**
- Mobile: 2000 tokens
- Desktop: 4000 tokens
- Max-recall: 8000 tokens

### Temporal Decay in Context
Nodes scored with time awareness:

```typescript
const age = now - node.timestamp;
const recencyScore = Math.max(0, 1.0 - (age / oneMonth));
const finalScore = relevanceScore * 0.7 + recencyScore * 0.3;
```

**Effect:**
- Recent nodes get bonus (up to 30% score boost)
- Nodes >1 month old decay to 0 recency
- Configurable via `temporal_lambda`

### Integration with LLM
How context flows to model:

```
User Query → Anchor Search → Context Package → Serialize → LLM Prompt → Response
```

**Example Flow:**
```
1. User: "How does the search system work?"
2. Anchor Search finds 15 nodes about search
3. Context Package assembles nodes + metadata
4. Serialize to: "Knowledge Graph Results (15 nodes)...\n\n--- Node 1..."
5. LLM Prompt: "Here is a graph of thoughts... Use these nodes to answer.\n\n[serialized context]\n\nUser: How does the search system work?"
6. LLM generates informed response using retrieved knowledge
```

### Troubleshooting
**Problem**: LLM ignores provided context  
**Solution**: Check prompt wrapper format; ensure context is clearly separated from query

**Problem**: Context too large for model  
**Solution**: Apply token budget trimming before serialization

**Problem**: Missing metadata in serialized output  
**Solution**: Ensure all node fields (tags, source, provenance) are included in serializer

**Problem**: Duplicate nodes in context  
**Solution**: Run deduplication before assembly; check molecule dedup during ingest

## Safe
true

## Description
Context serialization, graph packaging, user context, query intent, memory nodes, prompt assembly