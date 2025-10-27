/**
 * useConverter hook tests
 * Ensures conversion state stays isolated per run
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

jest.mock('@/components/hooks/use-toast.js', () => ({
  useToast: () => ({ toast: jest.fn(), toasts: [] }),
}));

jest.mock('@/lib/conversionWorkflow.js', () => ({
  parseConversationsFile: jest.fn(),
  convertConversations: jest.fn(),
  saveFilesSequentially: jest.fn(),
  createZipBlob: jest.fn(),
}));

jest.mock('@/modules/fileSystemManager.js', () => ({
  isFileSystemAccessSupported: () => true,
  getFileSystemAccessInfo: () => ({}),
  selectDirectory: jest.fn(),
  createDownloadBlob: jest.fn(),
  downloadFile: jest.fn(),
}));

jest.mock('@/utils/strings.js', () => ({
  message: (key) => key,
  status: (key) => key,
  success: (key) => key,
  error: (key) => key,
}));

jest.mock('@/utils/logger.js', () => ({
  logError: jest.fn(),
}));

const mockResult = {
  files: [],
  processed: 1,
  skipped: 0,
  errors: 0,
};

const {
  parseConversationsFile: parseConversationsFileMock,
  convertConversations: convertConversationsMock,
} = jest.requireMock('@/lib/conversionWorkflow.js');

describe('useConverter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    parseConversationsFileMock.mockResolvedValue([{ id: 'a' }]);
    convertConversationsMock.mockImplementation(async (conversations, processedIds) => {
      conversations.forEach((conversation) => processedIds.add(conversation.id));
      return mockResult;
    });
  });

  test('clears processed conversation ids between conversions', async () => {
    const { convertConversations } = await import('@/lib/conversionWorkflow.js');
    
    const observedSizes = [];
    convertConversationsMock.mockImplementation(async (conversations, processedIds) => {
      observedSizes.push(processedIds.size);
      conversations.forEach((conversation) => processedIds.add(conversation.id));
      return mockResult;
    });

    const processedIds = new Set();
    
    await convertConversations([{ id: 'a' }], processedIds);
    
    processedIds.clear();
    
    await convertConversations([{ id: 'b' }], processedIds);

    expect(observedSizes).toEqual([0, 0]);
  });
});
