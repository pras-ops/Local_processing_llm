/**
 * Standardized error classes for the preprocessor
 */

export class PreprocessorError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'PreprocessorError';
        this.code = code;
        this.details = details;
    }
}

export class ModelNotLoadedError extends PreprocessorError {
    constructor(operation) {
        super(
            `Model not loaded. Call loadModel() before using ${operation}.`,
            'MODEL_NOT_LOADED',
            { operation }
        );
        this.name = 'ModelNotLoadedError';
    }
}

export class ValidationError extends PreprocessorError {
    constructor(message, issues = []) {
        super(message, 'VALIDATION_FAILED', { issues });
        this.name = 'ValidationError';
    }
}

export class InferenceError extends PreprocessorError {
    constructor(message, originalError = null) {
        const fullMessage = originalError
            ? `Inference failed: ${message} (${originalError.message})`
            : `Inference failed: ${message}`;
        super(
            fullMessage,
            'INFERENCE_FAILED',
            { originalError: originalError?.message }
        );
        this.name = 'InferenceError';
    }
}

export class ConfigurationError extends PreprocessorError {
    constructor(message, field) {
        super(message, 'CONFIGURATION_ERROR', { field });
        this.name = 'ConfigurationError';
    }
}
