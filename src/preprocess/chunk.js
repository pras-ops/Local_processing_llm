/**
 * Chunk text into smaller pieces
 * @param {string} text - Text to chunk
 * @param {Object} options - Chunking options
 * @returns {string[]}
 */
export function chunk(text, options = {}) {
  const {
    size = 500, // Character count per chunk
    overlap = 0, // Overlap between chunks (in characters)
    strategy = "character", // "character", "sentence", "word"
  } = options;

  if (!text || text.length === 0) {
    return [];
  }

  const chunks = [];

  if (strategy === "character") {
    for (let i = 0; i < text.length; i += size - overlap) {
      chunks.push(text.slice(i, i + size));
    }
  } else if (strategy === "sentence") {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentChunk = "";
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > size && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
  } else if (strategy === "word") {
    const words = text.split(/\s+/);
    let currentChunk = [];
    let currentSize = 0;
    
    for (const word of words) {
      if (currentSize + word.length > size && currentChunk.length > 0) {
        chunks.push(currentChunk.join(" "));
        currentChunk = [word];
        currentSize = word.length;
      } else {
        currentChunk.push(word);
        currentSize += word.length + 1; // +1 for space
      }
    }
    
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(" "));
    }
  }

  return chunks.filter(ch => ch.length > 0);
}

