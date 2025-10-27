import { describe, expect, test } from '@jest/globals';
import { buildPageList, getPaginatedFiles, sortFiles, SORT_FIELDS } from '@/reactApp/resultsTableUtils.js';

describe('resultsTableUtils', () => {
  test('sortFiles prioritizes createTime for created sorting', () => {
    const files = [
      {
        title: 'Conversation B',
        filename: 'b.md',
        createTime: 100,
        createdDate: '31/12/2024',
      },
      {
        title: 'Conversation A',
        filename: 'a.md',
        createTime: 200,
        createdDate: '12/30/2024',
      },
    ];

    const sorted = sortFiles(files, SORT_FIELDS.CREATED, 'desc');
    expect(sorted.map((file) => file.filename)).toEqual(['a.md', 'b.md']);
  });

  test('sortFiles compares titles case-insensitively', () => {
    const files = [
      { title: 'Zeta', filename: 'z.md' },
      { title: 'alpha', filename: 'a.md' },
      { title: 'Beta', filename: 'b.md' },
    ];

    const sorted = sortFiles(files, SORT_FIELDS.TITLE, 'asc');
    expect(sorted.map((file) => file.filename)).toEqual(['a.md', 'b.md', 'z.md']);
  });

  test('buildPageList and pagination stay within bounds', () => {
    const files = Array.from({ length: 30 }, (_, index) => ({
      title: `File ${index + 1}`,
      filename: `file-${index + 1}.md`,
      createTime: index,
    }));

    const sorted = sortFiles(files, SORT_FIELDS.CREATED, 'desc');
    const paged = getPaginatedFiles(sorted, 2, 10);

    expect(paged).toHaveLength(10);
    expect(paged[0].filename).toBe('file-10.md');
    expect(paged[9].filename).toBe('file-1.md');

    const pages = buildPageList(4, 10);
    expect(pages).toEqual([1, '...', 3, 4, 5, '...', 10]);
  });
});
