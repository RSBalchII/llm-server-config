# Token Streaming & SSE Protocol

## Triggers
- streaming, SSE, server-sent events, onToken, token callback, detokenize, stream response, chat completions stream

## Core Concepts

### OpenAI-Compatible Streaming
Server sends tokens one-by-one using Server-Sent Events (SSE) protocol.

**SSE Format:**
```
data: {"id":"chatcmpl-123","object":"chat.completion.chunk","choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","choices":[{"delta":{"content":" world"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","choices":[{"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

**Key Rules:**
- Each message prefixed with `data: `
- Messages separated by `\n\n`
- Final message: `data: [DONE]`
- `finish_reason: null` → more coming
- `finish_reason: "stop"` → complete

### Token Streaming in node-llama-cpp
```javascript
// CORRECT: True token-by-token streaming
let buffer = '';
await session.prompt(userMsg, {
  maxTokens: 2048,
  onToken: (tokens) => {
    // Detokenize to get full text so far
    const fullText = llama.detokenize(tokens);
    // Extract only NEW tokens since last callback
    const newPart = fullText.slice(buffer.length);
    buffer = fullText;
    
    // Send only the new tokens
    res.write(`data: ${JSON.stringify({
      choices: [{ delta: { content: newPart } }]
    })}\n\n`);
  }
});

// Send final chunk
res.write(`data: ${JSON.stringify({
  choices: [{ delta: {}, finish_reason: "stop" }]
})}\n\n`);
res.write('data: [DONE]\n\n');
res.end();
```

### Common Pitfalls (Stumps Small Models)
❌ **WRONG**: Send entire generated text in one SSE message  
✅ **CORRECT**: Send incremental tokens as they arrive via `onToken` callback

❌ **WRONG**: `onToken` receives text strings  
✅ **CORRECT**: `onToken` receives token IDs; must `detokenize()` to get text

❌ **WRONG**: Buffer accumulates all tokens  
✅ **CORRECT**: Track position in buffer; send only `newPart = fullText.slice(buffer.length)`

❌ **WRONG**: Omit `finish_reason` in final chunk  
✅ **CORRECT**: Must send `finish_reason: "stop"` before `[DONE]`

### SSE Headers
```javascript
res.writeHead(200, {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'Access-Control-Allow-Origin': '*'
});
```

**Required Headers:**
- `Content-Type: text/event-stream` → Browser knows it's streaming
- `Cache-Control: no-cache` → Prevent buffering
- `Connection: keep-alive` → Maintain connection

### Token vs Text Callbacks
```javascript
// Token callback (receives integer IDs):
onToken: (tokens: number[]) => {
  // tokens = [12345, 67890, 11111]
  const text = llama.detokenize(tokens);
}

// Text callback (if available):
onText: (text: string) => {
  // text = "Hello world"
}
```

**Why detokenize?**
- Token IDs are model-specific integers
- Detokenizer converts back to human-readable text
- Must track cumulative text to extract new portions

### Timing & Performance
**Expected token delivery:**
- Every 10-50ms for fast models (4B-8B)
- Every 40-50ms for large models (30B-35B)
- Consistent intervals indicate healthy streaming

**Red flags:**
- All tokens arrive at once → not streaming (waiting for full generation)
- Long gaps between tokens → model struggling or OOM
- Connection drops mid-stream → server error or timeout

### Client-Side Consumption
```javascript
// Browser/Node.js client
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ stream: true })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') break;
      
      const parsed = JSON.parse(data);
      const token = parsed.choices[0]?.delta?.content || '';
      process.stdout.write(token); // Streaming output
    }
  }
}
```

### HTTP Headers for Streaming
| Header | Value | Purpose |
|--------|-------|---------|
| Content-Type | `text/event-stream` | SSE protocol |
| Cache-Control | `no-cache` | Prevent proxy buffering |
| Connection | `keep-alive` | Maintain connection |
| X-Accel-Buffering | `no` | Disable nginx buffering |
| Transfer-Encoding | `chunked` | HTTP/1.1 chunked transfer |

### Error Handling in Streams
```javascript
try {
  await session.prompt(userMsg, { onToken: ... });
  // Success - send final chunk
  res.write(`data: ${JSON.stringify({
    choices: [{ delta: {}, finish_reason: "stop" }]
  })}\n\n`);
} catch (err) {
  // Error mid-stream
  if (!res.headersSent) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  } else {
    // Headers already sent, send error as SSE
    res.write(`data: ${JSON.stringify({
      error: err.message,
      finish_reason: "error"
    })}\n\n`);
  }
}
res.write('data: [DONE]\n\n');
res.end();
```

### Non-Streaming Mode
```javascript
// Synchronous - wait for full generation
const text = await session.prompt(userMsg, {
  maxTokens: 2048,
  temperature: 0.6
});

// Return complete response
res.writeHead(200, { 'Content-Type': 'application/json' });
res.end(JSON.stringify({
  choices: [{ message: { content: text }, finish_reason: "stop" }]
}));
```

**When to use non-streaming:**
- Research harness (process full response)
- Batch processing
- When client doesn't support streaming

### Timing Fields
Include timing in response for debugging:
```javascript
{
  id: 'chatcmpl-' + Date.now(),
  created: Math.floor(Date.now() / 1000),
  usage: {
    prompt_tokens: promptLength,
    completion_tokens: generatedLength,
    total_tokens: promptLength + generatedLength
  }
}
```

### Troubleshooting
**Problem**: Client sees no output until generation complete  
**Solution**: Check `onToken` callback is firing; ensure `res.write()` not `res.send()`

**Problem**: Tokens appear in batches, not one-by-one  
**Solution**: Disable response buffering; check `res.flush()` if using compression

**Problem**: Stream cuts off mid-token  
**Solution**: Increase timeout; check for server errors or OOM

**Problem**: `[DONE]` never arrives  
**Solution**: Ensure `res.end()` called after final chunk; check for uncaught exceptions

## Safe
true

## Description
Token streaming with SSE protocol, onToken callbacks, detokenization, real-time delivery