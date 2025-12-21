import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Preprocessor } from '../../src/index.js';

// Mock LLMEngine specifically for lifecycle testing
vi.mock('../../src/engine.js', () => {
    return {
        LLMEngine: vi.fn().mockImplementation(() => {
            let loaded = false;
            let loadingPromise = null;

            return {
                isLoaded: vi.fn().mockImplementation(() => loaded),
                loadModel: vi.fn().mockImplementation(async () => {
                    loadingPromise = new Promise((resolve) => {
                        setTimeout(() => {
                            loaded = true;
                            resolve();
                        }, 100);
                    });
                    return loadingPromise;
                }),
                run: vi.fn().mockImplementation(async () => {
                    if (!loaded) throw new Error("Internal Engine Error: Not Loaded");
                    return "Mock response";
                }),
                getLogger: vi.fn().mockReturnValue({
                    log: vi.fn(),
                    logPromptConstruction: vi.fn(),
                    logInferenceStart: vi.fn(),
                    logInferenceComplete: vi.fn(),
                    logPerformance: vi.fn(),
                    logError: vi.fn(),
                    setEnabled: vi.fn(),
                    setVerbose: vi.fn()
                })
            };
        })
    };
});

describe('Model Lifecycle Chaos Tests', () => {
    let preprocessor;

    beforeEach(() => {
        preprocessor = new Preprocessor();
    });

    it('should throw ModelNotLoadedError if inference called before load', async () => {
        // We need to check if it throws the specialized error (or at least a message containing "not loaded")
        await expect(preprocessor.extract('test')).rejects.toThrow(/not loaded/i);
    });

    it('should handle back-to-back loadModel calls gracefully', async () => {
        const p1 = preprocessor.loadModel('model-a');
        const p2 = preprocessor.loadModel('model-b');

        await Promise.all([p1, p2]);
        expect(preprocessor.isModelLoaded).toBe(true);
    });

    it('should handle concurrent inference requests', async () => {
        await preprocessor.loadModel();

        const results = await Promise.all([
            preprocessor.clean('text 1', { useLLM: true, customInstructions: 'clean' }),
            preprocessor.clean('text 2', { useLLM: true, customInstructions: 'clean' }),
            preprocessor.clean('text 3', { useLLM: true, customInstructions: 'clean' })
        ]);

        expect(results).toHaveLength(3);
        results.forEach(r => expect(r).toBe('Mock response'));
    });
});
