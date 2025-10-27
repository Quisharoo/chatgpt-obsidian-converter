/**
 * Toast utility tests
 * Verifies filtering guards against invalid entries
 */

import { describe, test, expect } from '@jest/globals';
import { filterValidToasts } from '../../../src/components/ui/toast-utils.js';

describe('filterValidToasts', () => {
  test('returns only object entries', () => {
    const result = filterValidToasts([null, undefined, false, { id: 'a' }, { id: 'b' }]);
    expect(result).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  test('returns empty array for non-array input', () => {
    expect(filterValidToasts(null)).toEqual([]);
    expect(filterValidToasts(undefined)).toEqual([]);
    expect(filterValidToasts('invalid')).toEqual([]);
  });
});
