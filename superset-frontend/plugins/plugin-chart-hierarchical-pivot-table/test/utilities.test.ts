import { getCustomSortKey } from '../src/react-pivottable/utilities';

describe('getCustomSortKey', () => {
  it('should return original value if not a string', () => {
    expect(getCustomSortKey(123, true)).toBe(123);
    expect(getCustomSortKey(null, true)).toBe(null);
  });

  it('should sort months correctly', () => {
    expect(getCustomSortKey('Jan', true)).toBe('00-01');
    expect(getCustomSortKey('February', true)).toBe('00-02');
    expect(getCustomSortKey('Dec 2024', true)).toBe('2024-12');
    expect(getCustomSortKey('Jan-25', true)).toBe('2025-01');
  });

  it('should sort quarters correctly', () => {
    expect(getCustomSortKey('Q1', true)).toBe('00-Q1');
    expect(getCustomSortKey('Q3 2023', true)).toBe('2023-Q3');
  });

  it('should sort weeks correctly', () => {
    expect(getCustomSortKey('W1', true)).toBe('00-W01');
    expect(getCustomSortKey('Week 5', true)).toBe('00-W05');
    expect(getCustomSortKey('W52-2024', true)).toBe('2024-W52');
  });
  
  it('should sort seasons correctly', () => {
    expect(getCustomSortKey('Spring', true)).toBe('00-01');
    expect(getCustomSortKey('Summer 2024', true)).toBe('2024-02');
  });

  it('should sort halves correctly', () => {
    expect(getCustomSortKey('H1', true)).toBe('00-H1');
    expect(getCustomSortKey('H2 2024', true)).toBe('2024-H2');
    expect(getCustomSortKey('1st Half 25', true)).toBe('2025-H1');
    expect(getCustomSortKey('2nd Half', true)).toBe('00-H2');
  });

  it('should return original value if no custom sorting match', () => {
    expect(getCustomSortKey('Apple', true)).toBe('Apple');
  });
});

import { naturalSort, isColorDark } from '../src/react-pivottable/utilities';

describe('naturalSort', () => {
  it('should handle numeric and alphabetical sorting correctly', () => {
    expect(naturalSort('a1', 'a2')).toBeLessThan(0);
    expect(naturalSort('a2', 'a1')).toBeGreaterThan(0);
    expect(naturalSort('a10', 'a2')).toBeGreaterThan(0); // 10 comes after 2
    expect(naturalSort('10', '2')).toBeGreaterThan(0);
    expect(naturalSort('00-01', '00-02')).toBeLessThan(0);
    expect(naturalSort('2024-12', '2025-01')).toBeLessThan(0);
    expect(naturalSort('Same', 'Same')).toBe(0);
  });
});

describe('isColorDark', () => {
  it('should correctly identify dark and light colors', () => {
    expect(isColorDark('#000000')).toBe(true); // Black
    expect(isColorDark('#FFFFFF')).toBe(false); // White
    expect(isColorDark('#800000')).toBe(true); // Dark Red
    expect(isColorDark('#FFCCCC')).toBe(false); // Light Red
    expect(isColorDark('#000')).toBe(true); // Short Black
    expect(isColorDark('#FFF')).toBe(false); // Short White
    expect(isColorDark('invalid')).toBe(false);
  });
});
