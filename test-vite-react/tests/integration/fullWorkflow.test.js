/**
 * React Workflow Integration Tests
 * Exercises the conversion pipeline used by the React interface.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  convertConversations,
  saveFilesSequentially,
  createZipBlob,
  parseConversationsJson,
} from '../../../src/lib/conversionWorkflow.js';
import { processConversations } from '../../../src/modules/conversionEngine.js';

jest.mock('../../../src/modules/fileSystemManager.js', () => ({
  saveFileToDirectory: jest.fn(),
}));

let saveFileToDirectory;

function buildConversation({
  id = 'conversation_001',
  title = 'Sample Conversation',
  create_time = 1_703_522_600,
  userContent = 'Hello there',
  assistantContent = 'Hi! Here is a response.',
}) {
  return {
    id,
    title,
    create_time,
    mapping: {
      root: {
        message: {
          author: { role: 'user' },
          content: { parts: [userContent] },
        },
        parent: null,
        children: ['assistant'],
      },
      assistant: {
        message: {
          author: { role: 'assistant' },
          content: { parts: [assistantContent] },
        },
        parent: 'root',
        children: [],
      },
    },
  };
}

describe('React workflow integration', () => {
  beforeAll(async () => {
    ({ saveFileToDirectory } = await import('../../../src/modules/fileSystemManager.js'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete global.JSZip;
  });

  test('processConversations sorts chronologically and deduplicates ids', () => {
    const conversations = [
      buildConversation({ id: 'b', title: 'Newest', create_time: 1703522800, userContent: 'Newest message' }),
      buildConversation({ id: 'a', title: 'Oldest', create_time: 1703522700, userContent: 'Oldest message' }),
      buildConversation({ id: 'a', title: 'Duplicate', create_time: 1703522600 }), // duplicate id
    ];

    const processedIds = new Set();
    const result = processConversations(conversations, processedIds);

    expect(result.processed).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.files).toHaveLength(2);
    expect(result.files.map((file) => file.title)).toEqual(['Duplicate', 'Newest']);
    expect(processedIds.has('a')).toBe(true);
    expect(processedIds.has('b')).toBe(true);
  });

  test('convertConversations surfaces progress updates and returns markdown', async () => {
    const conversations = [buildConversation({})];
    const progressSpy = jest.fn();
    const processedIds = new Set();

    const results = await convertConversations(conversations, processedIds, {
      onProgress: progressSpy,
      concurrency: 2,
    });

    expect(progressSpy).toHaveBeenCalled();
    expect(results.processed).toBe(1);
    expect(results.files[0].filename).toMatch(/Sample Conversation/);
    expect(results.files[0].content).toContain('## 🧑‍💬 User');
    expect(results.files[0].content).toContain('## 🤖 Assistant');
  });

  test('saveFilesSequentially tallies success, skip, and error states', async () => {
    const files = [
      { filename: 'one.md', content: '# One' },
      { filename: 'two.md', content: '# Two' },
      { filename: 'three.md', content: '# Three' },
    ];

    saveFileToDirectory
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ cancelled: true })
      .mockRejectedValueOnce(new Error('boom'));

    const result = await saveFilesSequentially(files, { name: 'mock-dir' }, {});

    expect(result.successCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(result.errorCount).toBe(1);
    expect(saveFileToDirectory).toHaveBeenCalledTimes(3);
  });

  test('createZipBlob returns null when JSZip is unavailable', async () => {
    delete global.JSZip;
    const blob = await createZipBlob([{ filename: 'a.md', content: '# A' }]);
    expect(blob).toBeNull();
  });

  test('createZipBlob generates blob when JSZip is provided', async () => {
    const files = [];
    class FakeZip {
      constructor() {
        this.files = [];
      }
      file(name, contents) {
        this.files.push({ name, contents });
      }
      async generateAsync() {
        return { size: this.files.length };
      }
    }
    global.JSZip = FakeZip;

    const blob = await createZipBlob([
      { filename: 'a.md', content: '# A' },
      { filename: 'b.md', content: '# B' },
    ]);

    expect(blob).toEqual({ size: 2 });
  });

  test('parseConversationsJson rejects invalid input', () => {
    expect(() => parseConversationsJson('{')).toThrow('Invalid JSON file. Please upload a valid ChatGPT export.');
    expect(() => parseConversationsJson('{"not":"an array"}')).toThrow(
      'Invalid file structure. Expected an array of conversations.',
    );
  });
});
