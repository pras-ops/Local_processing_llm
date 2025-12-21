import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Preprocessor } from '../../src/index.js';
import { createMockEngine, fixtures } from '../helpers/test-utils.js';

// Mock LLMEngine to avoid importing web-llm which fails in Node
vi.mock('../../src/engine.js', () => {
    return {
        LLMEngine: vi.fn().mockImplementation(() => {
            let loaded = false;
            const logger = {
                enabled: true,
                verbose: false,
                log: vi.fn(),
                logPromptConstruction: vi.fn(),
                logInferenceStart: vi.fn(),
                logInferenceComplete: vi.fn(),
                logPipelineStep: vi.fn(),
                logPerformance: vi.fn(),
                logError: vi.fn(),
                setEnabled: vi.fn().mockImplementation((val) => logger.enabled = val),
                setVerbose: vi.fn().mockImplementation((val) => logger.verbose = val)
            };
            return {
                isLoaded: vi.fn().mockImplementation(() => loaded),
                loadModel: vi.fn().mockImplementation(() => {
                    loaded = true;
                    return Promise.resolve();
                }),
                run: vi.fn().mockResolvedValue('Mock response'),
                getLogger: vi.fn().mockReturnValue(logger)
            };
        })
    };
});

describe('Preprocessor Integration Tests', () => {
    let preprocessor;

    beforeEach(() => {
        preprocessor = new Preprocessor();
    });

    describe('Initialization', () => {
        it('should create preprocessor instance', () => {
            expect(preprocessor).toBeDefined();
            expect(preprocessor).toBeInstanceOf(Preprocessor);
        });

        it('should have logger instance', () => {
            const logger = preprocessor.getLogger();
            expect(logger).toBeDefined();
        });
    });

    describe('Rule-Based Operations (No Model)', () => {
        it('should clean HTML without model', async () => {
            const result = await preprocessor.clean(fixtures.htmlText, {
                removeHtml: true,
            });
            expect(result).not.toContain('<html>');
            expect(result).not.toContain('<body>');
            expect(result).toContain('Hello');
            expect(result).toContain('World');
        });

        it('should chunk text without model', () => {
            const text = 'This is sentence one. This is sentence two.';
            const chunks = preprocessor.chunk(text, { size: 20 });
            expect(Array.isArray(chunks)).toBe(true);
            expect(chunks.length).toBeGreaterThan(0);
        });

        it('should handle multiple clean operations', async () => {
            const text = '<p>Hello   World</p>  \\n\\n  Visit https://example.com';
            const result = await preprocessor.clean(text, {
                removeHtml: true,
                removeUrls: true,
                removeExtraWhitespace: true,
            });

            expect(result).not.toContain('<p>');
            expect(result).not.toContain('https://');
            expect(result).not.toMatch(/\\s{2,}/);
        });
    });

    describe('Error Handling', () => {
        it('should throw error when extract called without model', async () => {
            await expect(
                preprocessor.extract('test text', { format: 'json' })
            ).rejects.toThrow();
        });

        it('should throw error when prompt called without model', async () => {
            await expect(
                preprocessor.prompt('test', 'do something')
            ).rejects.toThrow();
        });
    });

    describe('Configuration', () => {
        it('should enable/disable logging', () => {
            preprocessor.setLogging(false);
            const logger = preprocessor.getLogger();
            expect(logger.enabled).toBe(false);

            preprocessor.setLogging(true);
            expect(logger.enabled).toBe(true);
        });

        it('should set verbose logging', () => {
            preprocessor.setLogging(true, true);
            const logger = preprocessor.getLogger();
            expect(logger.verbose).toBe(true);
        });
    });

    describe('Pipeline Processing', () => {
        beforeEach(async () => {
            await preprocessor.loadModel();
        });

        it('should process pipeline with clean and chunk', async () => {
            const result = await preprocessor.pipeline(fixtures.htmlText, [
                { clean: { removeHtml: true } },
                { chunk: { size: 100 } }
            ]);

            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle string shortcuts in pipeline', async () => {
            const result = await preprocessor.pipeline(fixtures.htmlText, [
                'clean',  // Uses defaults
            ]);

            expect(typeof result).toBe('string');
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty text', async () => {
            const result = await preprocessor.clean('', { removeHtml: true });
            expect(result).toBe('');
        });

        it('should handle null options', async () => {
            const result = await preprocessor.clean('Hello World');
            expect(result).toBe('Hello World');
        });

        it('should handle special characters', async () => {
            const text = 'Hello 你好 مرحبا 🌟';
            const result = await preprocessor.clean(text, { removeExtraWhitespace: true });
            expect(result).toContain('你好');
            expect(result).toContain('مرحبا');
            expect(result).toContain('🌟');
        });
    });
});
