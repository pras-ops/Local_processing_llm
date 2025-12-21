# Optional LLM Architecture

## 🎯 Design Decision: LLM Should Be Optional

**Key Insight**: Not all operations need LLM. Basic operations should work immediately without model loading.

---

## ✅ Current Implementation

### Operations That Work WITHOUT LLM

#### 1. **Chunk** ✅
- **Status**: Already works without LLM
- **Why**: Pure string operations
- **Speed**: Instant
- **Usage**: `p.chunk(text)` - works immediately

#### 2. **Clean** ✅ (NEW)
- **Status**: Now works without LLM (rule-based fallback)
- **Why**: Basic cleaning can use regex/rules
- **Speed**: Instant (rule-based) or 2-5 sec (LLM)
- **Usage**: 
  ```javascript
  // Works without model (fast, rule-based)
  const cleaned = await p.clean(text);
  
  // Uses LLM if model loaded (semantic cleaning)
  await p.loadModel();
  const cleaned = await p.clean(text); // Now uses LLM
  
  // Force LLM (requires model)
  const cleaned = await p.clean(text, { useLLM: true });
  
  // Force rules (no LLM, even if model loaded)
  const cleaned = await p.clean(text, { useLLM: false });
  ```

### Operations That REQUIRE LLM

#### 3. **Extract** ❌
- **Status**: Requires LLM
- **Why**: Needs semantic understanding to find entities
- **Speed**: 2-5 seconds
- **Usage**: `await p.extract(text)` - requires `loadModel()` first

#### 4. **Prompt** ❌
- **Status**: Requires LLM
- **Why**: Custom prompts need AI
- **Speed**: 2-5 seconds
- **Usage**: `await p.prompt(text, instruction)` - requires `loadModel()` first

---

## 🏗️ Architecture

### How It Works

```
User calls clean()
    ↓
Check: Model loaded?
    ↓
    ├─ NO → Use cleanWithRules() (fast, regex-based)
    │        Returns: string (synchronous)
    │
    └─ YES → Use LLM clean() (semantic)
             Returns: Promise<string>
```

### Auto-Detection Logic

```javascript
// In clean.js
const shouldUseLLM = 
  useLLM !== false &&           // Not explicitly disabled
  engine !== null &&             // Engine exists
  engine.isLoaded() &&           // Model is loaded
  (useLLM === true ||            // Explicitly requested
   customInstructions !== "");   // Needs semantic understanding
```

---

## 📊 Comparison

| Operation | Without LLM | With LLM | Speed (No LLM) | Speed (LLM) |
|-----------|-------------|----------|-----------------|-------------|
| **Chunk** | ✅ Works | N/A | Instant | N/A |
| **Clean** | ✅ Works | ✅ Better | Instant | 2-5 sec |
| **Extract** | ❌ No | ✅ Required | N/A | 2-5 sec |
| **Prompt** | ❌ No | ✅ Required | N/A | 2-5 sec |

---

## 🎨 Use Cases

### Use Case 1: Fast Cleaning (No Model)

```javascript
const p = new Preprocessor();
// No model loading needed!

// Fast, rule-based cleaning
const cleaned = await p.clean("<html>Hello</html>");
// Returns: "Hello" (instant)
```

### Use Case 2: Semantic Cleaning (With Model)

```javascript
const p = new Preprocessor();
await p.loadModel(); // Load model

// Semantic cleaning with LLM
const cleaned = await p.clean("Remove all dates from this text: Today is 2024-01-15", {
  customInstructions: "Remove all dates"
});
// LLM understands context and removes dates
```

### Use Case 3: Hybrid Approach

```javascript
const p = new Preprocessor();

// Fast cleaning first (no model)
let cleaned = await p.clean(text, { useLLM: false });

// Then extract (requires model)
await p.loadModel();
const extracted = await p.extract(cleaned);
```

---

## 🔧 Implementation Details

### Rule-Based Cleaning (`clean-rules.js`)

Uses:
- Regex for HTML removal
- Regex for URL removal
- String operations for whitespace
- HTML entity decoding

**Pros:**
- Fast (instant)
- Deterministic
- No model needed
- Works everywhere

**Cons:**
- Can't understand context
- Can't handle custom instructions
- Less intelligent

### LLM-Based Cleaning (`clean.js`)

Uses:
- WebLLM model
- Semantic understanding
- Context-aware cleaning

**Pros:**
- Understands context
- Handles custom instructions
- More intelligent

**Cons:**
- Slow (2-5 seconds)
- Requires model loading
- Needs GPU/WebGPU

---

## 🚀 Benefits

### 1. **Better UX**
- Users can start using immediately
- No waiting for model download
- Fast operations available instantly

### 2. **Flexibility**
- Works on devices without GPU
- Works in restricted environments
- Lower memory usage

### 3. **Progressive Enhancement**
- Start with fast operations
- Load model when needed
- Upgrade to LLM for advanced features

### 4. **Developer Choice**
- Use rules for speed
- Use LLM for quality
- Mix both as needed

---

## 📝 API Examples

### Example 1: Fast Only

```javascript
const p = new Preprocessor();

// All work without model
const chunks = p.chunk(text); // Instant
const cleaned = await p.clean(text); // Instant (rules)
```

### Example 2: LLM Enhanced

```javascript
const p = new Preprocessor();
await p.loadModel();

// Now uses LLM for better quality
const cleaned = await p.clean(text); // Uses LLM
const extracted = await p.extract(text); // Requires LLM
```

### Example 3: Explicit Control

```javascript
const p = new Preprocessor();
await p.loadModel();

// Force rules (even though model loaded)
const fast = await p.clean(text, { useLLM: false });

// Force LLM
const smart = await p.clean(text, { useLLM: true });
```

---

## ✅ This Makes Your Project Even Better!

### Before:
- ❌ Required model for everything
- ❌ Slow startup
- ❌ Can't work without GPU

### After:
- ✅ Works immediately
- ✅ Fast operations available
- ✅ Progressive enhancement
- ✅ Works everywhere
- ✅ LLM optional for advanced features

---

## 🎯 Summary

**LLM is now OPTIONAL** for basic operations:
- ✅ `chunk()` - Never needed LLM
- ✅ `clean()` - Works without LLM, better with it
- ❌ `extract()` - Still requires LLM (needs semantic understanding)
- ❌ `prompt()` - Still requires LLM (custom AI instructions)

This makes your SDK:
- **More flexible**
- **Faster to start**
- **Works on more devices**
- **Better developer experience**

Perfect architecture! 🎉

