import { describe, it, expect, beforeEach } from 'vitest';
import {
    PreprocessorError,
    ModelNotLoadedError,
    ValidationError,
    InferenceError,
    ConfigurationError
} from '../../src/utils/errors.js';

describe('PreprocessorError', () => {
    it('should create error with message and code', () => {
        const error = new PreprocessorError('Test error', 'TEST_CODE');
        expect(error.message).toBe('Test error');
        expect(error.code).toBe('TEST_CODE');
        expect(error.name).toBe('PreprocessorError');
    });

    it('should include details object', () => {
        const error = new PreprocessorError('Test', 'CODE', { foo: 'bar' });
        expect(error.details).toEqual({ foo: 'bar' });
    });
});

describe('ModelNotLoadedError', () => {
    it('should create error for specific operation', () => {
        const error = new ModelNotLoadedError('extract');
        expect(error.message).toContain('extract');
        expect(error.code).toBe('MODEL_NOT_LOADED');
        expect(error.details.operation).toBe('extract');
    });
});

describe('ValidationError', () => {
    it('should create error with issues array', () => {
        const issues = [{ field: 'email', reason: 'invalid' }];
        const error = new ValidationError('Validation failed', issues);
        expect(error.code).toBe('VALIDATION_FAILED');
        expect(error.details.issues).toEqual(issues);
    });
});

describe('InferenceError', () => {
    it('should wrap original error', () => {
        const original = new Error('Network timeout');
        const error = new InferenceError('Failed', original);
        expect(error.message).toContain('Network timeout');
        expect(error.code).toBe('INFERENCE_FAILED');
    });
});

describe('ConfigurationError', () => {
    it('should include field name', () => {
        const error = new ConfigurationError('Invalid value', 'temperature');
        expect(error.code).toBe('CONFIGURATION_ERROR');
        expect(error.details.field).toBe('temperature');
    });
});
