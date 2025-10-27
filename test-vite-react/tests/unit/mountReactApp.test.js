/**
 * mountReactApp tests
 * Validates React root lifecycle management
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

const modulePath = '../../../src/reactApp/mountReactApp.jsx';

function resetDom() {
  document.body.innerHTML = '<div class="container"></div>';
}

async function importMountReactApp(createRootMock) {
  jest.resetModules();

  jest.doMock('react-dom/client', () => ({
    createRoot: createRootMock,
  }));

  return import(modulePath);
}

describe('mountReactApp', () => {
  beforeEach(() => {
    resetDom();
  });

  test('reinitializes React root when container is recreated', async () => {
    const createRootMock = jest.fn((container) => ({
      render: jest.fn(),
      unmount: jest.fn(),
      container,
    }));

    const { mountReactApp } = await importMountReactApp(createRootMock);

    mountReactApp();
    expect(createRootMock).toHaveBeenCalledTimes(1);
    const firstContainer = createRootMock.mock.calls[0][0];
    const firstRootInstance = createRootMock.mock.results[0].value;

    // Simulate removal of container from DOM
    firstContainer.remove();
    resetDom();

    createRootMock.mockClear();

    mountReactApp();

    expect(firstRootInstance.unmount).toHaveBeenCalledTimes(1);
    expect(createRootMock).toHaveBeenCalledTimes(1);
    const secondContainer = createRootMock.mock.calls[0][0];
    expect(secondContainer).not.toBe(firstContainer);
  });
});
