# Engram System & Lexical Sidecar

## Triggers
- engram, lexical sidecar, fingerprint, content hash, deduplication, semantic fingerprint, molecular signature, hash lookup

## Core Concepts

### What is an Engram?
A compressed, hashed representation of content for fast lookup and deduplication. Like a "memory fingerprint" for knowledge.

**Engram Table:**
```sql
CREATE TABLE engrams (
    fingerprint TEXT PRIMARY KEY,    -- Unique content hash
    content_hash TEXT,               -- SHA-256 of content
    metadata JSONB                   -- Source, timestamp, tags
);
```

### How Engrams Work
```
Content → Fingerprint Algorithm → Unique Hash → Lookup in DB
```

**Creation Flow:**
1. Ingest content (text/code/file)
2. Compute fingerprint (semantic hash)
3. Check if engram exists → skip if duplicate
4. Store new engram + content in molecules

### Fingerprint vs Content Hash
| Type | Description | Properties |
|------|-------------|------------|
| **Content Hash** | SHA-256 of exact bytes | Same content = same hash |
| **Fingerprint** | Semantic hash (structure-aware) | Similar content = similar hash |

**Example:**
```python
# Same content, different formatting:
text1 = "Hello world"
text2 = "  Hello\n  world  "

content_hash(text1) != content_hash(text2)    # Different bytes
fingerprint(text1) ≈ fingerprint(text2)       # Similar semantics
```

### Molecular Signature
Additional metadata on molecules for dedup and retrieval:

```sql
molecules.molecular_signature TEXT  -- JSON with structural info
```

**Contains:**
- Token count
- Language detection (code vs text)
- Structural markers (code blocks, headings)
- Semantic density score

### Engram Lookup Flow
```
Query → Compute fingerprint → Lookup engram → If hit: return content
                                          If miss: compute + store
```

**Benefits:**
1. **Deduplication**: Never store same content twice
2. **Fast Lookup**: Hash lookup O(1) vs full-text search O(n)
3. **Semantic Matching**: Similar fingerprints → similar content

### Common Pitfalls (Stumps Small Models)
❌ **WRONG**: "Engram = embedding vector"  
✅ **CORRECT**: Engram is a hash/fingerprint, not a vector embedding

❌ **WRONG**: "Fingerprint captures semantic similarity"  
✅ **CORRECT**: Fingerprint is structural hash; similarity requires additional algorithms

❌ **WRONG**: "Engrams replace full-text search"  
✅ **CORRECT**: Engrams are for exact/near-exact dedup; FTS handles semantic queries

❌ **WRONG**: "Same fingerprint = identical content"  
✅ **CORRECT**: Similar fingerprints can indicate related but different content

### Integration with Search
Engrams are used as a pre-search filter:

```typescript
// From search.ts (simplified):
const engram = await lookupByEngram(queryFingerprint);
if (engram) {
  // Exact match found - skip full search
  return hydrateEngrams([engram]);
}
// Fall back to full physics walker search
```

### Hydrate Engrams
Convert engram hashes back to full content:

```typescript
async function hydrateEngrams(engrams: Engram[]): Promise<SearchResult[]> {
  // For each engram:
  // 1. Lookup content by fingerprint
  // 2. Fetch molecule content
  // 3. Add metadata (tags, provenance, etc.)
  return results;
}
```

### Use Cases
1. **Ingest Dedup**: Skip files already in memory
2. **Query Cache**: Return cached results for same queries
3. **Similarity Search**: Find content with similar fingerprints
4. **Version Tracking**: Track content changes via hash history

### Troubleshooting
**Problem**: Duplicate content appearing in search  
**Solution**: Check engram creation during ingest; may not be computing fingerprints

**Problem**: Engram lookup misses despite similar content  
**Solution**: Fingerprint algorithm may be too strict; consider similarity threshold

**Problem**: Large engram table slowing queries  
**Solution**: Add index on `fingerprint`; consider archiving old engrams

## Safe
true

## Description
Engram system for content fingerprinting, deduplication, lexical sidecar, molecular signatures