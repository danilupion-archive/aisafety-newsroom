import { describe, expect, it } from 'vitest';

import { errorClass, readRelease } from './error-tracking.js';

describe('readRelease', () => {
  it('names the component and its package version', () => {
    expect(readRelease('api')).toMatch(/^api@\d+\.\d+\.\d+$/);
    expect(readRelease('worker')).toMatch(/^worker@\d+\.\d+\.\d+$/);
  });
});

describe('errorClass', () => {
  it('gives an error’s name and SQLSTATE, never its message', () => {
    const database = Object.assign(new Error('duplicate key value (url)=(https://example.com/a)'), {
      name: 'DatabaseError',
      code: '23505',
    });
    expect(errorClass(database)).toBe('DatabaseError (23505)');
    expect(errorClass(new TypeError('a page said something'))).toBe('TypeError');
    expect(errorClass('a string')).toBe('string');
  });
});
