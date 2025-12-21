import { describe, it, expect } from 'vitest';
import { cleanWithRules } from '../../src/preprocess/clean-rules.js';
import { chunk } from '../../src/preprocess/chunk.js';

describe('Torture Tests: Extremely Large Inputs', () => {
    // Utility to generate large strings
    const generateLargeString = (megabytes) => {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789\n';
        let str = '';
        const iterations = (megabytes * 1024 * 1024) / chars.length;
        for (let i = 0; i < iterations; i++) {
            str += chars;
        }
        return str;
    };

    it('should handle 1MB input without crashing (Rule-based)', () => {
        const input = generateLargeString(1);
        const result = cleanWithRules(input, { removeExtraWhitespace: true });
        expect(result.length).toBeGreaterThan(0);
    });

    it('should handle 5MB input and chunking', () => {
        const input = generateLargeString(5);
        const result = chunk(input, { size: 10000 });
        expect(result.length).toBeGreaterThan(500);
    });

    it('should not hang on repetitive copy-paste spam (Regex attack)', () => {
        const spam = 'https://very-long-url-that-goes-on-and-on-forever.com/test'.repeat(1000);
        const startTime = Date.now();
        const result = cleanWithRules(spam, { removeUrls: true });
        const duration = Date.now() - startTime;

        expect(duration).toBeLessThan(1000); // Should be fast
        expect(result.trim()).toBe('');
    });

    it('should handle massive whitespace spam', () => {
        const input = ' '.repeat(1000000) + 'Real Content' + ' '.repeat(1000000);
        const result = cleanWithRules(input, { removeExtraWhitespace: true });
        expect(result).toBe('Real Content');
    });
});

describe('Torture Tests: Garbage & Binary', () => {
    it('should handle binary-like garbage gracefully', () => {
        const binaryGarbage = String.fromCharCode(...Array.from({ length: 1000 }, () => Math.floor(Math.random() * 256)));
        const result = cleanWithRules(binaryGarbage, { removeSpecialChars: true });
        // Should remove most characters and not crash
        expect(typeof result).toBe('string');
    });

    it('should handle mixed emoji and multi-language chaos', () => {
        const chaos = 'Hello 🌟 你好 👨‍👩‍👧‍👦 العربية. Text with \u0000 null and \u0007 bell.';
        const result = cleanWithRules(chaos, { removeSpecialChars: true });
        expect(result).toContain('Hello');
        expect(result).not.toContain('\u0000');
    });

    it('should return empty string for empty/whitespace input', () => {
        expect(cleanWithRules('', { removeHtml: true })).toBe('');
        expect(cleanWithRules('   ', { removeExtraWhitespace: true })).toBe('');
        expect(cleanWithRules('\n\n\n', { removeLineBreaks: true })).toBe(' ');
    });

    it('should handle inputs that look like HTML but are incomplete', () => {
        const broken = '<div class="test" Oops I forgot to close this tag';
        const result = cleanWithRules(broken, { removeHtml: true });
        expect(result).toBe(broken); // Simple regex shouldn't mangle it too much if no closing tag found
    });
});
