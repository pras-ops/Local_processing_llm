import { describe, it, expect, beforeEach } from 'vitest';
import { InternalLogger, getLogger, createLogger } from '../../src/utils/logger.js';

describe('InternalLogger', () => {
    let logger;

    beforeEach(() => {
        logger = new InternalLogger({ enabled: true, verbose: false });
    });

    describe('Basic Logging', () => {
        it('should log messages when enabled', () => {
            logger.log('info', 'TEST', 'Test message');
            const logs = logger.getLogs();
            expect(logs.length).toBeGreaterThan(0);
            expect(logs[0].message).toBe('Test message');
        });

        it('should not log when disabled', () => {
            logger.setEnabled(false);
            logger.log('info', 'TEST', 'Should not appear');
            expect(logger.getLogs()).toHaveLength(0);
        });

        it('should respect log levels', () => {
            logger.logLevel = 'warn';
            logger.log('info', 'TEST', 'Info message');
            logger.log('warn', 'TEST', 'Warn message');

            // Info should not be in output (but is stored)
            expect(logger.shouldLog('info')).toBe(false);
            expect(logger.shouldLog('warn')).toBe(true);
        });
    });

    describe('Circular Buffer', () => {
        it('should limit log entries to maxLogs', () => {
            const smallLogger = new InternalLogger({ maxLogs: 5 });
            for (let i = 0; i < 10; i++) {
                smallLogger.log('info', 'TEST', `Message ${i}`);
            }
            expect(smallLogger.getLogs()).toHaveLength(5);
        });

        it('should keep most recent entries', () => {
            const smallLogger = new InternalLogger({ maxLogs: 3 });
            smallLogger.log('info', 'TEST', 'First');
            smallLogger.log('info', 'TEST', 'Second');
            smallLogger.log('info', 'TEST', 'Third');
            smallLogger.log('info', 'TEST', 'Fourth');

            const logs = smallLogger.getLogs();
            expect(logs[logs.length - 1].message).toBe('Fourth');
        });
    });

    describe('Log Filtering', () => {
        it('should filter by level', () => {
            logger.log('info', 'TEST', 'Info');
            logger.log('error', 'TEST', 'Error');

            const errors = logger.getLogs({ level: 'error' });
            expect(errors).toHaveLength(1);
            expect(errors[0].level).toBe('error');
        });

        it('should filter by category', () => {
            logger.log('info', 'MODEL', 'Model message');
            logger.log('info', 'VALIDATION', 'Validation message');

            const modelLogs = logger.getLogs({ category: 'MODEL' });
            expect(modelLogs).toHaveLength(1);
            expect(modelLogs[0].category).toBe('MODEL');
        });
    });

    describe('Statistics', () => {
        it('should track statistics', () => {
            logger.log('info', 'TEST', 'One');
            logger.log('error', 'TEST', 'Two');
            logger.log('warn', 'TEST', 'Three');

            const stats = logger.getStats();
            expect(stats.totalLogs).toBe(3);
            expect(stats.errors).toBe(1);
            expect(stats.warnings).toBe(1);
        });
    });

    describe('Utility Methods', () => {
        it('should clear logs', () => {
            logger.log('info', 'TEST', 'Message');
            logger.clear();
            expect(logger.getLogs()).toHaveLength(0);
        });

        it('should export as JSON', () => {
            logger.log('info', 'TEST', 'Message');
            const exported = logger.exportLogs();
            expect(() => JSON.parse(exported)).not.toThrow();
        });
    });
});

describe('Logger Factory Functions', () => {
    it('should create singleton logger', () => {
        const logger1 = getLogger();
        const logger2 = getLogger();
        expect(logger1).toBe(logger2);
    });

    it('should create new instances', () => {
        const logger1 = createLogger();
        const logger2 = createLogger();
        expect(logger1).not.toBe(logger2);
    });
});
