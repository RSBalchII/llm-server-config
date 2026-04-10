# Physics Tag Walker & Context Inflation

## Triggers
- physics walker, radial inflation, context inflator, tag walker, graph traversal, temporal decay, atom positions, molecule inflation

## Core Concepts

### Physics Tag Walker: Graph-Based Search
The core search algorithm in Anchor Engine. Uses physics-inspired metaphors for knowledge retrieval.

**Key Metaphors:**
- **Atoms**: Individual knowledge fragments (bytes/positions in molecules)
- **Molecules**: Complete documents/content blocks
- **Compounds**: Collections of molecules (files/directories)
- **Tags**: Semantic labels on atoms/molecules
- **Buckets**: Logical groupings (like folders)
- **Provenance**: Content origin (internal/external/quarantine)

### Radial Inflation (Atom Search)
```
Query → Find matching atoms → Expand radially → Collect context
```

**How it works:**
1. Find atoms matching query terms (byte-level positions)
2. "Inflate" outward from atom positions to capture surrounding context
3. Merge overlapping regions to avoid duplication
4. Score and rank inflated results

**Parameters:**
- `max_chars`: Maximum characters to return (default ~205)
- `max_results`: Max atoms to inflate (default ~150)
- `context_bytes`: Context window around atom (default ~20)

### Context Inflator
Expands atoms into readable context by fetching surrounding bytes from molecules.

```sql
-- Simplified inflation query:
SELECT m.content, 
       a.start_byte - :context AS start,
       a.end_byte + :context AS end
FROM atoms a
JOIN molecules m ON a.molecule_id = m.id
WHERE a.tag = :query_tag
```

### Physics Walker Algorithm
Uses graph traversal with physics-inspired scoring:

**1. Temporal Decay:**
```
score = base_score * e^(-λ * age_days)
```
Newer content ranks higher by default (configurable λ)

**2. Tag Propagation:**
- Tags spread through graph connections
- Connected nodes inherit partial tag weights
- Distance from source affects tag strength

**3. Proximity Scoring:**
- Nodes closer to query source score higher
- Graph distance matters, not just text similarity
- Multi-hop connections decay exponentially

### Search Pipeline (Two-Pass)
```
Query → Parse Terms → Atom Search (Radial) → Molecule Search (FTS) → Merge & Dedup → Rank → Return
```

**Pass 1: Atom Search (Lightweight)**
- Fast byte-level position lookup
- Returns precise spans of matching content
- Uses radial inflation for context

**Pass 2: Molecule Search (Full-Text)**
- BM25-style ranking on full documents
- Catches atoms missed by position lookup
- Broader but less precise

### Key Tables in Anchor DB
```sql
-- Atom Positions (lazy molecule inflation)
CREATE TABLE atom_positions (
    atom_id TEXT,
    molecule_id TEXT,
    start_byte INT,
    end_byte INT,
    tag TEXT,
    buckets TEXT[],
    provenance TEXT
);

-- Molecules (document sentences/blocks)
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

-- Engrams (lexical sidecar)
CREATE TABLE engrams (
    fingerprint TEXT PRIMARY KEY,
    content_hash TEXT,
    metadata JSONB
);
```

### Common Pitfalls (Stumps Small Models)
❌ **WRONG**: "Physics walker is vector search"  
✅ **CORRECT**: It's graph traversal with temporal decay, NOT embeddings/semantic search

❌ **WRONG**: "Atom = molecule = compound"  
✅ **CORRECT**: Atom ⊂ Molecule ⊂ Compound (hierarchical containment)

❌ **WRONG**: "Radial inflation increases token count"  
✅ **CORRECT**: It expands byte ranges to capture context, not tokens

❌ **WRONG**: "Tags are like keywords"  
✅ **CORRECT**: Tags are semantic labels computed during ingestion, not just TF-IDF

### Query Flow Example
```
Query: "How does search work?"

1. Parse → ["search", "work"]
2. Atom Lookup:
   - "search" → atom_123 (bytes 45-51 in molecule_456)
   - "search" → atom_789 (bytes 120-126 in molecule_012)
   - "work" → atom_345 (bytes 88-92 in molecule_456)
3. Radial Inflation:
   - atom_123 → bytes 25-71 (±20 context)
   - atom_789 → bytes 100-146 (±20 context)
   - atom_345 → bytes 68-112 (±20 context)
4. Merge Overlaps:
   - bytes 25-112 (atoms 123+345 overlap → merged)
   - bytes 100-146 (atom 789, separate)
5. Return ranked results with temporal decay
```

### Performance Characteristics
| Operation | Complexity | Notes |
|-----------|------------|-------|
| Atom Lookup | O(log n) | B-tree index on tags |
| Radial Inflation | O(k * context) | k atoms, context bytes each |
| Molecule FTS | O(log n) | Full-text search index |
| Temporal Decay | O(n) | Applied to all results |
| Dedup | O(n²) worst, O(n log n) optimized | Range merging |

### Configuration Parameters
```json
{
  "physics_walker": {
    "damping_factor": 0.85,      // Like PageRank damping
    "min_threshold": 0.0001,     // Minimum score to include
    "max_hops": 3,               // Graph traversal depth
    "temporal_lambda": 0.1       // Decay rate (higher = faster decay)
  },
  "context_inflator": {
    "max_chars": 205,            // Default result size
    "use_provenance": true       // Include source metadata
  }
}
```

### Troubleshooting
**Problem**: Search returns no results despite matching content  
**Solution**: Check atom_positions table; content may not be atomized yet (run ingestion)

**Problem**: Results are too short/fragmented  
**Solution**: Increase context_bytes in inflator config (default 20)

**Problem**: Search is slow on large databases  
**Solution**: Ensure indexes exist on `atom_positions(tag)` and `molecules(compound_id)`

**Problem**: Duplicate results appearing  
**Solution**: Check dedup logic; overlapping byte ranges should merge during inflation

### Integration with Search Orchestrator
Physics Walker and Context Inflator are used by `search.ts`:

```typescript
// From search.ts (simplified):
const atoms = await ContextInflator.inflateFromAtomPositions(
  term, 
  150,  // max results
  20,   // context bytes
  undefined, 
  { buckets, provenance }
);

// Results merged with molecule FTS and deduplicated
const anchors = [...atomResults, ...moleculeResults];
```

## Safe
true

## Description
Physics Tag Walker graph search, radial inflation, context inflator, atom/molecule/compound hierarchy