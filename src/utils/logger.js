/**
 * Advanced Internal LLM Logging System
 * 
 * Captures detailed insights into LLM processing:
 * - Token-by-token generation (if streaming available)
 * - Prompt construction steps
 * - Intermediate processing states
 * - Validation steps
 * - Performance metrics
 */

export class InternalLogger {
  constructor(options = {}) {
    this.enabled = options.enabled !== false; // Default: enabled
    this.verbose = options.verbose || false;
    this.logLevel = options.logLevel || 'info'; // 'debug', 'info', 'warn', 'error'
    this.logs = [];
    this.maxLogs = options.maxLogs || 1000;
    this.onLogCallback = options.onLogCallback || null;
  }

  /**
   * Enable or disable logging
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Set verbosity level
   */
  setVerbose(verbose) {
    this.verbose = verbose;
  }

  /**
   * Log an event with metadata
   */
  log(level, category, message, data = {}) {
    if (!this.enabled) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      stackTrace: this.verbose ? new Error().stack : undefined
    };

    // Store log
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // Remove oldest
    }

    // Console output based on level
    if (this.shouldLog(level)) {
      const prefix = `[${level.toUpperCase()}] [${category}]`;
      console.log(`${prefix} ${message}`, data);
    }

    // Callback for external handlers
    if (this.onLogCallback) {
      this.onLogCallback(logEntry);
    }
  }

  /**
   * Check if log level should be output
   */
  shouldLog(level) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.logLevel];
  }

  /**
   * Log prompt construction
   */
  logPromptConstruction(operation, originalPrompt, finalPrompt, options = {}) {
    this.log('debug', 'PROMPT', 'Constructing prompt', {
      operation,
      originalLength: originalPrompt.length,
      finalLength: finalPrompt.length,
      options,
      promptPreview: finalPrompt.substring(0, 200) + '...'
    });
  }

  /**
   * Log token generation (if streaming available)
   */
  logTokenGeneration(token, cumulativeText, tokenIndex) {
    if (this.verbose) {
      this.log('debug', 'TOKEN', `Generated token ${tokenIndex}`, {
        token,
        cumulativeLength: cumulativeText.length,
        tokenIndex
      });
    }
  }

  /**
   * Log LLM inference start
   */
  logInferenceStart(prompt, options) {
    this.log('info', 'INFERENCE', 'Starting LLM inference', {
      promptLength: prompt.length,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      promptPreview: prompt.substring(0, 100) + '...'
    });
  }

  /**
   * Log LLM inference completion
   */
  logInferenceComplete(response, duration, tokenCount) {
    this.log('info', 'INFERENCE', 'LLM inference completed', {
      responseLength: response.length,
      duration: `${duration}ms`,
      estimatedTokens: tokenCount,
      responsePreview: response.substring(0, 200) + '...'
    });
  }

  /**
   * Log validation step
   */
  logValidation(step, input, output, isValid, error = null) {
    this.log(isValid ? 'info' : 'warn', 'VALIDATION', `Validation: ${step}`, {
      inputPreview: typeof input === 'string' ? input.substring(0, 100) : input,
      outputPreview: typeof output === 'string' ? output.substring(0, 100) : output,
      isValid,
      error: error?.message
    });
  }


  /**
   * Log pipeline step
   */
  logPipelineStep(stepIndex, stepName, input, output, duration) {
    this.log('info', 'PIPELINE', `Pipeline step ${stepIndex + 1}: ${stepName}`, {
      inputLength: typeof input === 'string' ? input.length : 'N/A',
      outputLength: typeof output === 'string' ? output.length : 'N/A',
      duration: `${duration}ms`,
      inputPreview: typeof input === 'string' ? input.substring(0, 50) : input,
      outputPreview: typeof output === 'string' ? output.substring(0, 50) : output
    });
  }

  /**
   * Log error with context
   */
  logError(operation, error, context = {}) {
    this.log('error', 'ERROR', `Error in ${operation}`, {
      error: error.message,
      stack: error.stack,
      context
    });
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation, metrics) {
    this.log('info', 'PERFORMANCE', `Performance: ${operation}`, metrics);
  }

  /**
   * Get all logs
   */
  getLogs(filter = {}) {
    let filtered = [...this.logs];

    if (filter.level) {
      filtered = filtered.filter(log => log.level === filter.level);
    }

    if (filter.category) {
      filtered = filtered.filter(log => log.category === filter.category);
    }

    if (filter.since) {
      const sinceTime = new Date(filter.since).getTime();
      filtered = filtered.filter(log => new Date(log.timestamp).getTime() >= sinceTime);
    }

    return filtered;
  }

  /**
   * Get logs as formatted string
   */
  getLogsAsString(filter = {}) {
    const logs = this.getLogs(filter);
    return logs.map(log => {
      return `[${log.timestamp}] [${log.level}] [${log.category}] ${log.message}`;
    }).join('\n');
  }

  /**
   * Clear logs
   */
  clear() {
    this.logs = [];
  }

  /**
   * Export logs as JSON
   */
  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Get summary statistics
   */
  getStats() {
    const stats = {
      totalLogs: this.logs.length,
      byLevel: {},
      byCategory: {},
      errors: 0,
      warnings: 0,
      timeRange: {
        start: this.logs[0]?.timestamp,
        end: this.logs[this.logs.length - 1]?.timestamp
      }
    };

    this.logs.forEach(log => {
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
      stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
      if (log.level === 'error') stats.errors++;
      if (log.level === 'warn') stats.warnings++;
    });

    return stats;
  }
}

// Singleton instance
let defaultLogger = null;

/**
 * Get or create default logger
 */
export function getLogger(options = {}) {
  if (!defaultLogger) {
    defaultLogger = new InternalLogger(options);
  }
  return defaultLogger;
}

/**
 * Create a new logger instance
 */
export function createLogger(options = {}) {
  return new InternalLogger(options);
}

