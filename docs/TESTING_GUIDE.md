# Testing Guide

## 🚀 Quick Start Testing

### Step 1: Install Dependencies

```bash
npm install
```

This installs WebLLM and other dependencies.

### Step 2: Start Local Server

**Option A: Using npm script (recommended)**
```bash
npm run dev
```

**Option B: Using Python**
```bash
# Python 3
python -m http.server 8080

# Python 2
python -m SimpleHTTPServer 8080
```

**Option C: Using Node.js http-server**
```bash
npx http-server . -p 8080 -c-1
```

**Option D: Using VS Code Live Server**
- Install "Live Server" extension
- Right-click on `test.html`
- Select "Open with Live Server"

### Step 3: Open Test Page

Open your browser and navigate to:
```
http://localhost:8080/test.html
```

### Step 4: Test the SDK

1. **Click "Load Model"** - This will download and load the model (takes 1-2 minutes first time)
2. **Enter test text** in the textarea
3. **Click test buttons** to test different operations:
   - Test Clean - Removes HTML, noise
   - Test Extract - Extracts structured data
   - Test Pipeline - Runs clean + extract

---

## 🧪 Test Scenarios

### Test 1: Basic Cleaning

**Input:**
```
<html><body>Hello   world! Visit https://example.com</body></html>
```

**Expected:** Clean text without HTML tags

### Test 2: Extraction

**Input:**
```
Contact John Doe at john@example.com or call 555-1234
```

**Expected:** JSON with name, email, phone

### Test 3: Pipeline

**Input:**
```
<html>Contact Jane at jane@test.com</html>
```

**Expected:** Cleaned first, then extracted data

---

## ⚠️ Important Notes

### Browser Requirements

- **Chrome/Edge 113+** (recommended)
- **Firefox 110+** (partial support)
- **Safari 16.4+** (limited support)
- **WebGPU support required**

### First Load

- Model download: 100-500MB
- First load: 10-60 seconds
- Subsequent loads: Much faster (cached)

### Console Logs

Open browser DevTools (F12) to see:
- Model loading progress
- Internal logging
- Token-by-token generation (if verbose mode)
- Any errors

---

## 🐛 Troubleshooting

### "Model not loading"

**Check:**
1. WebGPU support: Visit `chrome://gpu` (Chrome)
2. Browser console for errors
3. Network tab for download issues

### "WebGPU not supported"

**Solutions:**
1. Update browser to latest version
2. Enable WebGPU in Chrome flags: `chrome://flags/#enable-unsafe-webgpu`
3. Use Chrome/Edge (best support)

### "Module not found" errors

**Solution:**
- Make sure you're using a local server (not file://)
- Check that all files are in the correct locations

### Slow performance

**Normal for:**
- First model load
- Low-end devices
- Large text inputs

**Solutions:**
- Wait for first load to complete
- Use smaller text inputs
- Check device GPU/RAM

---

## 📊 What to Test

### ✅ Core Features

- [ ] Model loading
- [ ] Text cleaning (HTML removal)
- [ ] Text cleaning (whitespace)
- [ ] URL preservation (should keep URLs by default)
- [ ] Information extraction
- [ ] JSON format extraction
- [ ] Validation (prevents hallucinations)
- [ ] Pipeline (clean → extract)
- [ ] Custom prompts

### ✅ Edge Cases

- [ ] Empty text
- [ ] Very long text
- [ ] Text with no extractable data
- [ ] Text with special characters
- [ ] Multiple URLs
- [ ] Nested HTML

### ✅ Error Handling

- [ ] Operations before model load
- [ ] Invalid JSON extraction
- [ ] Network errors
- [ ] Invalid options

---

## 🔍 Debugging

### Enable Verbose Logging

The test page already has verbose logging enabled. Check browser console for:
- Token-by-token generation
- Prompt construction
- Validation steps
- Performance metrics

### Access Logs Programmatically

```javascript
const logger = preprocessor.getLogger();
const logs = logger.getLogs();
console.log(logs);
```

### Export Logs

```javascript
const logsJSON = logger.exportLogs();
// Save or analyze logs
```

---

## 📝 Test Checklist

Before considering testing complete:

- [ ] Model loads successfully
- [ ] Clean function works
- [ ] Extract function works
- [ ] Pipeline works
- [ ] URLs are preserved by default
- [ ] HTML is removed
- [ ] Validation catches hallucinations
- [ ] Logs are generated
- [ ] No console errors
- [ ] Works on your target browsers

---

## 🎯 Next Steps After Testing

1. **Fix any bugs** found during testing
2. **Document issues** for future reference
3. **Optimize** based on performance observations
4. **Add more test cases** as needed
5. **Prepare for production** use

Good luck with testing! 🚀

