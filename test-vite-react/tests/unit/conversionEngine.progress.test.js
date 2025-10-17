/**
 * Unit Tests for Progressive Conversion
 * Validates progress emission and completion behavior
 */

import { describe, test, expect } from '@jest/globals';
import { processConversationsProgressive } from '../../../src/modules/conversionEngine.js';

function makeConversation(id, title, parts) {
  return {
    id,
    title,
    create_time: 1703522622,
    mapping: {
      root: {
        message: {
          author: { role: 'user' },
          content: { parts }
        },
        children: [],
        parent: null
      }
    }
  };
}

describe('processConversationsProgressive', () => {
  test('emits increasing progress and finishes at 100%', async () => {
    const convs = [
      makeConversation('1', 'One', ['hello']),
      makeConversation('2', 'Two', ['world']),
      makeConversation('3', 'Three', ['!'])
    ];

    const events = [];
    const results = await processConversationsProgressive(
      convs,
      new Set(),
      (e) => events.push(e),
      1 // yieldEvery
    );

    // Should have processed 3 files with no errors or skips
    expect(results.processed + results.skipped + results.errors).toBe(convs.length);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].percent).toBe(0);
    expect(events.at(-1).percent).toBe(100);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].percent).toBeGreaterThanOrEqual(events[i - 1].percent);
    }
  });
});
