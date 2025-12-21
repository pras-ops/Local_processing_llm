# Contributing to Client-Side LLM Preprocessor

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Code of Conduct

This project adheres to a Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, include as many details as possible using the bug report template.

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. Use the feature request template and provide:
- Clear use case
- Expected behavior
- Example code

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** with clear, descriptive commits
3. **Add tests** for new functionality
4. **Update documentation** if needed
5. **Ensure tests pass**: `npm test`
6. **Ensure build works**: `npm run build`
7. **Submit PR** with description of changes

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/local_processing_llm.git
cd local_processing_llm

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run in development mode
npm run dev
```

## Project Structure

```
local_processing_llm/
├── src/              # Source code
│   ├── preprocess/   # Preprocessing modules
│   ├── utils/        # Utilities
│   └── index.js      # Main export
├── tests/            # Test files
│   ├── unit/         # Unit tests
│   ├── integration/  # Integration tests
│   └── helpers/      # Test utilities
├── examples/         # Example usage
└── docs/             # Documentation
```

## Coding Standards

### JavaScript Style
- Use ES6+ features
- 2 spaces for indentation
- Semicolons required
- Single quotes for strings
- Descriptive variable names

### Comments
- Add JSDoc for all exported functions
- Include `@param` and `@returns` tags
- Explain complex logic

### Example:
```javascript
/**
 * Clean text by removing noise
 * @param {string} text - Input text
 * @param {Object} options - Cleaning options
 * @returns {Promise<string>} Cleaned text
 */
export async function clean(text, options = {}) {
  // Implementation
}
```

## Testing Guidelines

### Unit Tests
- Test pure functions in isolation
- Mock external dependencies
- One assertion per test minimum
- Clear test descriptions

### Integration Tests
- Test complete workflows
- Test error paths
- Test edge cases

### Test Structure:
```javascript
describe('Feature', () => {
  it('should do something specific', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = doSomething(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

## Commit Message Guidelines

Use clear, descriptive commit messages:

```
feat: add email validation to extract function
fix: resolve memory leak in logger circular buffer
docs: update README with new examples
test: add integration tests for pipeline
refactor: simplify validation logic
```

### Prefixes:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `test:` - Tests
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `chore:` - Maintenance tasks

## Documentation

- Update README.md for user-facing changes
- Update docs/ for technical details
- Add examples for new features
- Keep docs concise and clear

## Questions?

Feel free to open an issue with your question or reach out to maintainers.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
