/**
 * useConverter hook tests
 * Ensures conversion state stays isolated per run
 */

import React from 'react';
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';

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
  let root;
  let container;
  let hookState;

  beforeEach(async () => {
    jest.clearAllMocks();
    parseConversationsFileMock.mockResolvedValue([{ id: 'a' }]);
    convertConversationsMock.mockImplementation(async (conversations, processedIds) => {
      // Simulate the converter marking all conversations as processed.
      conversations.forEach((conversation) => processedIds.add(conversation.id));
      return mockResult;
    });

    container = document.createElement('div');
    document.body.appendChild(container);

    const { useConverter } = await import('../../../src/reactApp/useConverter.js');

    function Harness() {
      hookState = useConverter();
      return null;
    }

    root = createRoot(container);
    act(() => {
      root.render(React.createElement(Harness));
    });
  });

  afterEach(() => {
    hookState = null;
    if (root) {
      act(() => root.unmount());
    }
    if (container?.parentNode) {
      container.remove();
    }
  });

  test('clears processed conversation ids between conversions', async () => {
    const observedSizes = [];
    convertConversationsMock.mockImplementation(async (conversations, processedIds) => {
      observedSizes.push(processedIds.size);
      conversations.forEach((conversation) => processedIds.add(conversation.id));
      return mockResult;
    });

    await act(async () => {
      await hookState.convertFile({ name: 'first.json' });
    });

    parseConversationsFileMock.mockResolvedValue([{ id: 'b' }]);

    await act(async () => {
      await hookState.convertFile({ name: 'second.json' });
    });

    expect(observedSizes).toEqual([0, 0]);
  });
});
