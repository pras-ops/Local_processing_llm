/**
 * Test utilities and mocks for preprocessor tests
 */

/**
 * Create a mock LLM engine for testing
 */
export function createMockEngine(options = {}) {
    const mockResponses = options.responses || {};
    let loadedModel = null;

    return {
        isLoaded: () => loadedModel !== null,
        loadModel: async (model) => {
            loadedModel = model || 'mock-model';
            return Promise.resolve();
        },
        run: async (prompt) => {
            // Return mock response based on prompt content
            if (prompt.includes('extract')) {
                return mockResponses.extract || '{"name":"John","email":"john@example.com"}';
            }
            if (prompt.includes('clean')) {
                return mockResponses.clean || 'Cleaned text';
            }
            return mockResponses.default || 'Mock response';
        },
        getLogger: () => ({
            log: () => { },
            logPromptConstruction: () => { },
            logInferenceStart: () => { },
            logInferenceComplete: () => { },
        }),
    };
}

/**
 * Sample text fixtures for testing
 */
export const fixtures = {
    htmlText: '<html><body><p>Hello <b>World</b></p></body></html>',
    cleanText: 'Hello World',
    contactText: 'Contact John Doe at john.doe@example.com or call 555-1234',
    urlText: 'Visit https://example.com for more information',
    multilineText: `First line
    Second line
    Third line`,
};

/**
 * Custom matchers for validation
 */
export const matchers = {
    toBeValidJSON: (received) => {
        try {
            JSON.parse(received);
            return { pass: true, message: () => 'Valid JSON' };
        } catch (e) {
            return { pass: false, message: () => `Invalid JSON: ${e.message}` };
        }
    },
};

/**
 * Wait for async operations in tests
 */
export function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create test configuration
 */
export function createTestConfig(overrides = {}) {
    return {
        removeHtml: true,
        removeUrls: false,
        removeExtraWhitespace: true,
        ...overrides,
    };
}
