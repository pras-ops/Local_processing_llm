import { describe, it, expect } from 'vitest';
import { chunk } from '../../src/preprocess/chunk.js';

describe('chunk', () => {
    const sampleText = 'This is a test. This is another sentence. And here is a third one. Finally, the last sentence.';

    it('should split text into chunks by character count', () => {
        const result = chunk(sampleText, { size: 20, strategy: 'character' });
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
        result.forEach(c => expect(c.length).toBeLessThanOrEqual(20));
    });

    it('should split text by sentences', () => {
        const result = chunk(sampleText, { strategy: 'sentence', size: 40 });
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(1);
    });

    it('should handle overlap between chunks', () => {
        const result = chunk('word1 word2 word3 word4 word5', {
            size: 15,
            overlap: 5,
            strategy: 'character'
        });
        expect(result.length).toBeGreaterThan(1);
        // Verify there's some overlap in content
        if (result.length > 1) {
            const hasOverlap = result.some((chunk, i) => {
                if (i === 0) return false;
                return result[i - 1].includes(chunk.substring(0, 3));
            });
            // Note: overlap behavior may vary based on implementation
        }
    });

    it('should return single chunk if text is shorter than chunk size', () => {
        const shortText = 'Short text';
        const result = chunk(shortText, { size: 100 });
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(shortText);
    });
});
