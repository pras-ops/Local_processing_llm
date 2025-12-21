import { describe, it, expect, vi } from 'vitest';
import * as EntryPoint from '../../src/index.js';

// Mock LLMEngine to avoid importing web-llm which fails in Node
vi.mock('../../src/engine.js', () => {
    return {
        LLMEngine: vi.fn().mockImplementation(() => {
            return {
                getLogger: vi.fn().mockReturnValue({
                    setEnabled: vi.fn(),
                    setVerbose: vi.fn()
                })
            };
        })
    };
});

describe('API Surface & Export Integrity', () => {
    it('should export the main Preprocessor class', () => {
        expect(EntryPoint.Preprocessor).toBeDefined();
        const p = new EntryPoint.Preprocessor();
        expect(typeof p.clean).toBe('function');
        expect(typeof p.extract).toBe('function');
        expect(typeof p.chunk).toBe('function');
        expect(typeof p.pipeline).toBe('function');
    });

    it('should export sub-modules for advanced users', () => {
        expect(EntryPoint.LLMEngine).toBeDefined();
        expect(EntryPoint.clean).toBeDefined();
        expect(EntryPoint.chunk).toBeDefined();
        expect(EntryPoint.extract).toBeDefined();
        expect(EntryPoint.cleanWithRules).toBeDefined();
    });

    it('should have a stable public API signature', () => {
        const p = new EntryPoint.Preprocessor();
        // Check method names explicitly
        const methods = Object.getOwnPropertyNames(EntryPoint.Preprocessor.prototype);
        const expected = ['constructor', 'loadModel', 'getLogger', 'setLogging', 'clean', 'extract', 'chunk', 'prompt', 'pipeline', 'process'];

        expected.forEach(m => expect(methods).toContain(m));
    });
});
