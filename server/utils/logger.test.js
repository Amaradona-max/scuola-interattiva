import { logger, requestLogger, errorLogger, logDatabaseQuery, logAIRequest, logFileUpload, logQuestionAsked } from './logger.js';

describe('logger utility', () => {
  test('logger is defined', () => {
    expect(logger).toBeDefined();
  });

  test('requestLogger is a function', () => {
    expect(typeof requestLogger).toBe('function');
  });

  test('errorLogger is a function', () => {
    expect(typeof errorLogger).toBe('function');
  });

  test('logDatabaseQuery is a function', () => {
    expect(typeof logDatabaseQuery).toBe('function');
  });

  test('logAIRequest is a function', () => {
    expect(typeof logAIRequest).toBe('function');
  });

  test('logFileUpload is a function', () => {
    expect(typeof logFileUpload).toBe('function');
  });

  test('logQuestionAsked is a function', () => {
    expect(typeof logQuestionAsked).toBe('function');
  });
});