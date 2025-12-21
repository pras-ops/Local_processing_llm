# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: [INSERT-EMAIL]

Include:
- Type of vulnerability
- Full paths of affected source files
- Location of affected code (tag/branch/commit)
- Step-by-step instructions to reproduce
- Proof-of-concept or exploit code (if possible)
- Impact of the issue

### What to expect:
- Acknowledgment within 48 hours
- Regular updates on progress
- Credit for discovery (if desired)

## Security Best Practices

When using this library:

1. **Validate All Inputs**: Even though the library has validation, always validate user inputs in your application
2. **Browser Security**: Ensure your application runs over HTTPS
3. **Content Security Policy**: Configure appropriate CSP headers
4. **Model Sources**: Only load models from trusted CDNs
5. **Data Privacy**: Remember that while processing is local, model downloads require network access

## Known Limitations

This library processes data client-side, but be aware:
- LLM models can hallucinate data
- Validation reduces but doesn't eliminate hallucinations
- Always verify extracted data for sensitive use cases
- Model downloads happen over the network

## Vulnerability Disclosure Timeline

1. Report received
2. Issue confirmed and assessed
3. Patch developed
4. Patch tested
5. Security advisory published
6. Patch released

We aim to address critical vulnerabilities within 7 days.
