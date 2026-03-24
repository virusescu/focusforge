import { describe, it, expect } from 'vitest';
import { LOG_MESSAGES } from './logData';

describe('LOG_MESSAGES', () => {
  it('should have predefined arrays for different log categories', () => {
    expect(LOG_MESSAGES).toHaveProperty('REBOOT');
    expect(LOG_MESSAGES).toHaveProperty('START');
    expect(LOG_MESSAGES).toHaveProperty('HALT');
    expect(LOG_MESSAGES).toHaveProperty('IDLE');
  });

  it('each category should contain string messages', () => {
    for (const messages of Object.values(LOG_MESSAGES)) {
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThan(0);
      for (const msg of messages) {
        expect(typeof msg).toBe('string');
        expect(msg.length).toBeGreaterThan(0);
      }
    }
  });
});
