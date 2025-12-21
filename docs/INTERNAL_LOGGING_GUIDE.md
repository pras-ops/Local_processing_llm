# Internal LLM Logging System - Complete Guide

## 🎯 What Was Implemented

You now have a **comprehensive internal logging system** that captures what happens INSIDE the LLM during processing. This solves the major downside of browser-based LLMs: **lack of visibility into internal operations**.

## ✅ Features Implemented

### 1. **Token-by-Token Generation Logging**
- Captures each token as the LLM generates it (if streaming is available)
- Logs cumulative text at each step
- Shows token index and content
- **This is the "insight" you wanted** - you can see the LLM thinking token by token!

### 2. **Prompt Construction Logging**
- Logs how prompts are built
- Shows original vs final prompt
- Tracks options and parameters
- Helps debug prompt engineering issues

### 3. **Inference Lifecycle Logging**
- Start time, duration, token counts
- Performance metrics
- Success/failure tracking
- Error context

### 4. **Validation Logging**
- Rule-based validation steps
- Source text verification
- JSON schema validation
- Hallucination detection

### 5. **Pipeline Execution Logging**
- Each step's input/output
- Step duration
- Pipeline reordering (when clean → extract is enforced)
- Performance summary

### 6. **Regex Pattern Matching Logging**
- Logs when regex patterns match
- Shows what was found
- Tracks hybrid regex + LLM approach

## 📖 How to Use

### Basic Usage

```javascript
import { Preprocessor } from 'client-llm-preprocessor';

const p = new Preprocessor();

// Enable verbose logging to see token-by-token generation
p.setLogging(true, true); // enabled, verbose

await p.loadModel();

// All operations are now logged internally
const cleaned = await p.clean("dirty text");
```

### Access Internal Logs

```javascript
// Get the logger
const logger = p.getLogger();

// Get all logs
const allLogs = logger.getLogs();

// Get logs by category
const inferenceLogs = logger.getLogs({ category: 'INFERENCE' });
const tokenLogs = logger.getLogs({ category: 'TOKEN' });

// Get logs by level
const errors = logger.getLogs({ level: 'error' });

// Get logs since a time
const recentLogs = logger.getLogs({ 
  since: new Date(Date.now() - 60000) // Last minute
});

// Export logs as JSON
const logsJSON = logger.exportLogs();

// Get statistics
const stats = logger.getStats();
console.log(stats);
// {
//   totalLogs: 150,
//   byLevel: { info: 100, debug: 40, warn: 8, error: 2 },
//   byCategory: { INFERENCE: 50, TOKEN: 80, ... },
//   errors: 2,
//   warnings: 8
// }
```

### View Token-by-Token Generation

```javascript
// Enable verbose mode
p.setLogging(true, true);

// Run extraction - you'll see each token as it's generated
const result = await p.extract(text, {
  what: "names and emails",
  format: "json"
});

// Check token logs
const tokenLogs = logger.getLogs({ category: 'TOKEN' });
tokenLogs.forEach(log => {
  console.log(`Token ${log.data.tokenIndex}: "${log.data.token}"`);
  console.log(`Cumulative: "${log.data.cumulativeText.substring(0, 100)}..."`);
});
```

### Monitor Pipeline Execution

```javascript
const result = await p.pipeline(text, [
  "clean",
  "extract"
]);

// Get pipeline logs
const pipelineLogs = logger.getLogs({ category: 'PIPELINE' });
pipelineLogs.forEach(log => {
  console.log(`Step: ${log.message}`);
  console.log(`Duration: ${log.data.duration}`);
  console.log(`Input length: ${log.data.inputLength}`);
  console.log(`Output length: ${log.data.outputLength}`);
});
```

### Custom Log Callback

```javascript
const p = new Preprocessor({
  loggerOptions: {
    onLogCallback: (logEntry) => {
      // Send to external service
      // Store in database
      // Display in UI
      console.log('Custom handler:', logEntry);
    }
  }
});
```

## 🔍 What You Can See Now

### 1. **Token Generation Process**
```
[DEBUG] [TOKEN] Generated token 1: "The"
[DEBUG] [TOKEN] Generated token 2: " text"
[DEBUG] [TOKEN] Generated token 3: " has"
[DEBUG] [TOKEN] Generated token 4: " been"
...
```

### 2. **Prompt Construction**
```
[DEBUG] [PROMPT] Constructing prompt
  operation: "extract"
  originalLength: 50
  finalLength: 200
  options: { format: "json", fields: ["name", "email"] }
  promptPreview: "Extract names and emails from the following text in JSON format..."
```

### 3. **Inference Details**
```
[INFO] [INFERENCE] Starting LLM inference
  promptLength: 200
  temperature: 0.3
  maxTokens: 512

[INFO] [INFERENCE] LLM inference completed
  responseLength: 150
  duration: "2345ms"
  estimatedTokens: 38
```

### 4. **Validation Steps**
```
[INFO] [VALIDATION] Validation: extract
  inputPreview: "Contact John at john@example.com"
  outputPreview: {"name": "John", "email": "john@example.com"}
  isValid: true
```

### 5. **Pipeline Execution**
```
[INFO] [PIPELINE] Starting pipeline execution
  stepCount: 2
  steps: ["clean", "extract"]

[INFO] [PIPELINE] Pipeline step 1: clean
  inputLength: 500
  outputLength: 450
  duration: "1200ms"

[INFO] [PIPELINE] Pipeline step 2: extract
  inputLength: 450
  outputLength: 200
  duration: "2100ms"
```

## 🎨 Log Categories

| Category | What It Logs |
|----------|-------------|
| `MODEL` | Model loading, progress |
| `INFERENCE` | LLM inference start/complete |
| `TOKEN` | Token-by-token generation |
| `PROMPT` | Prompt construction |
| `VALIDATION` | Rule-based validation |
| `REGEX` | Regex pattern matching |
| `PIPELINE` | Pipeline execution steps |
| `CLEAN` | Cleaning operations |
| `EXTRACT` | Extraction operations |
| `PERFORMANCE` | Performance metrics |
| `ERROR` | Errors with context |

## 🚀 Advanced Features

### Filter Logs

```javascript
// Get only inference errors
const errors = logger.getLogs({
  category: 'INFERENCE',
  level: 'error'
});

// Get logs from last 5 minutes
const recent = logger.getLogs({
  since: new Date(Date.now() - 5 * 60 * 1000)
});
```

### Export for Analysis

```javascript
// Export all logs as JSON
const logsJSON = logger.exportLogs();
// Save to file, send to server, etc.

// Get formatted string
const logsString = logger.getLogsAsString();
console.log(logsString);
```

### Performance Analysis

```javascript
const stats = logger.getStats();
console.log('Total operations:', stats.totalLogs);
console.log('Errors:', stats.errors);
console.log('Warnings:', stats.warnings);
console.log('Time range:', stats.timeRange);
```

## ⚙️ Configuration

```javascript
const p = new Preprocessor({
  loggerOptions: {
    enabled: true,        // Enable/disable logging
    verbose: true,        // Verbose mode (shows token-by-token)
    logLevel: 'info',    // 'debug', 'info', 'warn', 'error'
    maxLogs: 1000,       // Maximum logs to keep in memory
    onLogCallback: null   // Custom callback
  }
});
```

## 🎯 This Solves Your Problem!

**Before**: No visibility into what the LLM is doing internally
**After**: Complete visibility into:
- ✅ Token-by-token generation
- ✅ Prompt construction
- ✅ Validation steps
- ✅ Pipeline execution
- ✅ Performance metrics
- ✅ Error context

You can now **see inside the LLM** just like you wanted!

## 📝 Example: Complete Workflow with Logging

```javascript
const p = new Preprocessor({
  loggerOptions: {
    enabled: true,
    verbose: true,  // See token-by-token
    logLevel: 'debug'
  }
});

await p.loadModel();

// Run extraction with full logging
const result = await p.extract(
  "Contact John Doe at john@example.com or call 555-1234",
  {
    what: "contact information",
    format: "json",
    fields: ["name", "email", "phone"],
    validate: true  // Rule-based validation
  }
);

// Analyze what happened
const logger = p.getLogger();
const stats = logger.getStats();

console.log('Total logs:', stats.totalLogs);
console.log('Inference logs:', logger.getLogs({ category: 'INFERENCE' }).length);
console.log('Token logs:', logger.getLogs({ category: 'TOKEN' }).length);
console.log('Validation logs:', logger.getLogs({ category: 'VALIDATION' }).length);

// Export for debugging
const logsJSON = logger.exportLogs();
// Save or send to your debugging system
```

---

**You now have complete internal visibility into your LLM operations!** 🎉

