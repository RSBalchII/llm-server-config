# Anchor Engine Architecture

## Triggers
- anchor engine, sovereign context, knowledge graph, ingest, distill, radial distillation, illuminate, BFS traversal, memory system, PGlite

## Core Concepts

### What is Anchor Engine?
A local-first knowledge engine that stores, retrieves, and reasons over ingested content using graph-based search and temporal memory.

**Key Properties:**
- **Local-first**: All data stays on your machine (PGlite embedded DB)
- **Graph-based**: Knowledge stored as interconnected nodes
- **Temporal**: Time-aware search with recency bias
- **Semantic**: Tag-based retrieval, not just keyword matching

### Architecture Components

```
┌─────────────────────────────────────────────────────────┐
│                    Anchor Engine                         │
├──────────┬──────────┬──────────┬──────────┬─────────────┤
│  Ingest  │  Search  │ Distill  │Illuminate│    API      │
│  System  │  System  │  System  │  System  │   Server    │
├──────────┴──────────┴──────────┴──────────┴─────────────┤
│                    PGlite Database                       │
│  (atoms, molecules, compounds, engrams, atom_positions)  │
└─────────────────────────────────────────────────────────┘
```

### Ingestion Pipeline
```
File → Atomize → Fingerprint → Tag → Store → Index
```

**Step 1: Atomize**
- Split content into semantic molecules (sentences/paragraphs)
- Each molecule gets byte positions for atom lookup

**Step 2: Fingerprint**
- Compute content hash + semantic fingerprint
- Check for duplicates (engram lookup)

**Step 3: Tag**
- Extract semantic tags via NLP
- Tags propagate to parent compounds

**Step 4: Store**
- Molecules → `molecules` table
- Atom positions → `atom_positions` table
- Engrams → `engrams` table

**Step 5: Index**
- Full-text search index on molecules
- B-tree indexes on tags, compound_id, buckets

### Database Schema

**Core Tables:**
```sql
-- Atoms (byte-level positions in molecules)
CREATE TABLE atom_positions (
    atom_id TEXT,
    molecule_id TEXT,
    start_byte INT,
    end_byte INT,
    tag TEXT,
    buckets TEXT[],
    provenance TEXT
);

-- Molecules (content blocks)
CREATE TABLE molecules (
    id TEXT,
    compound_id TEXT,
    content TEXT,
    tags TEXT[],
    buckets TEXT[],
    provenance TEXT,
    timestamp BIGINT,
    molecular_signature TEXT,
    start_byte INT,
    end_byte INT
);

-- Compounds (collections)
CREATE TABLE compounds (
    id TEXT,
    path TEXT,
    provenance TEXT,
    buckets TEXT[]
);

-- Engrams (fingerprints)
CREATE TABLE engrams (
    fingerprint TEXT PRIMARY KEY,
    content_hash TEXT,
    metadata JSONB
);
```

### API Endpoints

**System:**
```
POST /v1/system/start              # Start server
POST /v1/system/stop               # Stop server
GET  /v1/system/status             # Current status
GET  /v1/system/health             # Health check
POST /v1/system/ingest-status      # Ingestion progress
```

**Ingestion:**
```
POST /v1/ingest                    # Ingest content
{
  "path": "/path/to/file",
  "content": "raw text",
  "source": "user-session",
  "buckets": ["research"]
}
```

**Search:**
```
POST /v1/memory/search
{
  "query": "how does search work",
  "tokenBudget": 4000,
  "maxHopDistance": 3,
  "includeProvenance": true
}
```

**Distill:**
```
POST /v1/memory/distill
{
  "seed": { "query": "topic", "compound_ids": [...] },
  "radius": 2,
  "output_format": "compound"
}
```

**Explore:**
```
POST /v1/memory/explore
{
  "seed": "quantum computing",
  "depth": 3,
  "max_nodes": 50
}
```

### Search System (Physics Walker)
See skill: `physics-walker.md`

**Key Points:**
- Two-pass: Atom search (radial inflation) + Molecule search (FTS)
- Temporal decay: Newer results score higher
- Tag propagation: Connected nodes share tag weights
- Dedup: Range merging prevents duplicates

### Distillation System
Compresses knowledge into deduplicated summaries.

**Radial Distillation:**
```
Seed Query → Expand Radially → Collect Nodes → Deduplicate → Summarize → Output
```

**Output Formats:**
- `yaml`: Structured YAML summary
- `json`: JSON knowledge graph
- `compound`: Full compound documents

**Example Output:**
```yaml
topic: "AI safety research"
key_concepts:
  - name: "Alignment problem"
    description: "..."
    sources: [file1.md, file2.md]
  - name: "Reward hacking"
    description: "..."
    sources: [file3.md]
related_topics: ["ethics", "robustness", "interpretability"]
```

### Exploration System (BFS)
Explores knowledge graph via Breadth-First Search from seed topic.

**Flow:**
```
Seed → Find Connected Nodes → Expand 1 Hop → Expand 2 Hops → ... → Return Graph
```

**Parameters:**
- `depth`: Max hops from seed (default: 3)
- `max_nodes`: Max nodes to return (default: 50)
- Prevents exponential explosion

### Configuration

**user_settings.json:**
```json
{
  "MEMORY": {
    "heap_pressure_mb": 500,
    "throttle_start_mb": 800,
    "throttle_max_mb": 1200,
    "emergency_stop_mb": 1500
  },
  "SEARCH": {
    "max_chars_default": 2048,
    "token_budget_default": 4000
  },
  "CACHE": {
    "ttl_ms": 60000,
    "max_size": 100
  }
}
```

### Common Pitfalls (Stumps Small Models)
❌ **WRONG**: "Anchor Engine is a vector database"  
✅ **CORRECT**: It's a graph-based system with tag/atom lookup, NOT embeddings

❌ **WRONG**: "Distillation = summarization"  
✅ **CORRECT**: Distillation is radial collection + dedup + compression

❌ **WRONG**: "Search returns exact matches only"  
✅ **CORRECT**: Physics walker finds related nodes via tag propagation

❌ **WRONG**: "PGlite is full PostgreSQL"  
✅ **CORRECT**: PGlite is embedded WASM Postgres; subset of features, in-memory option

### Memory Management

**PGlite Optimization:**
```typescript
// From db.ts
{
  maxMemory: undefined,           // Let Node.js GC manage
  shared_buffers: '128MB',        // Postgres buffer cache
  effective_cache_size: '512MB',  // OS cache estimate  
  work_mem: '16MB',               // Per-operation memory
  maintenance_work_mem: '64MB'    // VACUUM/INDEX memory
}
```

**Heap Pressure Detection:**
```typescript
// Standard 127/134/135
if (heapUsedMB > HEAP_PRESSURE_MB) {
  downgradeMaxRecall();  // Reduce search intensity
}
```

### Integration Points

**Qwen Code:**
```json
// .qwen/settings.json
{
  "providers": {
    "openai": {
      "baseUrl": "http://127.0.0.1:3160/v1",
      "apiKey": "your-anchor-key"
    }
  }
}
```

**Research Harness:**
- Uses `/api/search`, `/api/distill`, `/api/web-search`
- Logs decisions to `/api/decisions`

**MCP Server:**
- Exposes Anchor tools to Qwen Code agents
- Tools: `anchor_search`, `anchor_distill`, `anchor_ingest`

### Troubleshooting
**Problem**: Ingestion stuck at 0%  
**Solution**: Check file paths; ensure files are readable and not gitignored

**Problem**: Search returns empty results  
**Solution**: Verify content was ingested; check atom_positions table for data

**Problem**: PGlite memory grows unbounded  
**Solution**: Enable shared_buffers limit; run VACUUM periodically

**Problem**: API returns 503 Service Unavailable  
**Solution**: Check health endpoint; database may be corrupted or locked

**Problem**: Distill returns empty  
**Solution**: No knowledge exists for seed query; ingest content first

## Safe
true

## Description
Anchor Engine architecture, ingestion, search, distillation, exploration, PGlite, API endpoints