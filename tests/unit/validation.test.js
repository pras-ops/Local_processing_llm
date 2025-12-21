import { describe, it, expect } from 'vitest';
import { validateJSON, verifyExtraction, validateExtraction } from '../../src/utils/validation.js';

describe('validateJSON', () => {
    it('should validate correct JSON', () => {
        const result = validateJSON('{"name":"John","email":"john@example.com"}');
        expect(result.isValid).toBe(true);
        expect(result.data).toEqual({ name: 'John', email: 'john@example.com' });
    });

    it('should reject invalid JSON', () => {
        const result = validateJSON('not json');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Invalid JSON');
    });

    it('should check for required fields', () => {
        const result = validateJSON('{"name":"John"}', ['name', 'email']);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Missing required fields: email');
    });

    it('should pass when all required fields present', () => {
        const result = validateJSON('{"name":"John","email":"test@example.com"}', ['name', 'email']);
        expect(result.isValid).toBe(true);
    });
});

describe('verifyExtraction', () => {
    it('should pass when extracted value exists in source', () => {
        const extracted = { name: 'John', email: 'john@example.com' };
        const source = 'Contact John at john@example.com';
        const result = verifyExtraction(extracted, source);
        expect(result.isValid).toBe(true);
        expect(result.issues).toHaveLength(0);
    });

    it('should flag hallucinated values not in source', () => {
        const extracted = { name: 'Jane', email: 'jane@fake.com' };
        const source = 'Contact John at john@example.com';
        const result = verifyExtraction(extracted, source);
        expect(result.isValid).toBe(false);
        expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should allow partial word matches', () => {
        const extracted = { name: 'John' };
        const source = 'Contact John Doe at email';
        const result = verifyExtraction(extracted, source, ['name']);
        expect(result.isValid).toBe(true);
    });
});

describe('validateExtraction', () => {
    it('should validate JSON format extraction', () => {
        const llmOutput = '{"name":"John","email":"john@example.com"}';
        const source = 'Contact John at john@example.com';
        const result = validateExtraction(llmOutput, source, {
            format: 'json',
            fields: ['name', 'email'],
        });
        expect(result.isValid).toBe(true);
        expect(result.validated).toBeDefined();
    });

    it('should reject invalid JSON in strict mode', () => {
        const llmOutput = 'not json';
        const source = 'some text';
        const result = validateExtraction(llmOutput, source, {
            format: 'json',
            strict: true,
        });
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
    });
});
