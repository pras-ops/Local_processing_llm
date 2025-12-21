import { describe, it, expect } from 'vitest';
import { cleanWithRules } from '../../src/preprocess/clean-rules.js';

describe('cleanWithRules', () => {
    it('should return text unchanged when no options provided', () => {
        const input = '<html>Hello World</html>';
        const result = cleanWithRules(input, {});
        expect(result).toBe(input);
    });

    it('should remove HTML tags when removeHtml is true', () => {
        const input = '<html><body>Hello <b>World</b></body></html>';
        const result = cleanWithRules(input, { removeHtml: true });
        expect(result).toBe('Hello World');
    });

    it('should remove URLs when removeUrls is true', () => {
        const input = 'Visit https://example.com for more info';
        const result = cleanWithRules(input, { removeUrls: true });
        expect(result).toBe('Visit  for more info');
    });

    it('should remove extra whitespace when removeExtraWhitespace is true', () => {
        const input = 'Hello    World   ';
        const result = cleanWithRules(input, { removeExtraWhitespace: true });
        expect(result).toBe('Hello World');
    });

    it('should remove line breaks when removeLineBreaks is true', () => {
        const input = 'Hello\nWorld\r\n!';
        const result = cleanWithRules(input, { removeLineBreaks: true });
        expect(result).toBe('Hello World !');
    });

    it('should handle multiple options together', () => {
        const input = '<p>Hello    World</p>\n\nVisit https://example.com';
        const result = cleanWithRules(input, {
            removeHtml: true,
            removeUrls: true,
            removeExtraWhitespace: true,
            removeLineBreaks: true,
        });
        expect(result).toBe('Hello World Visit');
    });

    it('should decode HTML entities when decodeHtmlEntities is true', () => {
        const input = 'AT&amp;T &lt;Company&gt;';
        const result = cleanWithRules(input, { decodeHtmlEntities: true });
        expect(result).toBe('AT&T <Company>');
    });
});
