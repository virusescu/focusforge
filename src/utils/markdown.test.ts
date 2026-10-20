import { describe, it, expect } from 'vitest';
import { preserveBlankLines, toggleTaskLine } from './markdown';

describe('preserveBlankLines', () => {
  it('leaves text without repeated blank lines unchanged', () => {
    expect(preserveBlankLines('a\n\nb')).toEqual({ rendered: 'a\n\nb', lineMap: [0, 1, 2] });
  });

  it('adds a zero-width line per extra blank line and maps it back', () => {
    const { rendered, lineMap } = preserveBlankLines('a\n\n\n- [ ] x');
    expect(rendered.split('\n')).toEqual(['a', '', '​', '', '- [ ] x']);
    expect(lineMap[4]).toBe(3); // the task line still points at source line 3
  });
});

describe('toggleTaskLine', () => {
  it('checks an open task', () => {
    expect(toggleTaskLine('a\n- [ ] x', 1)).toEqual({ source: 'a\n- [x] x', checked: true });
  });

  it('unchecks a done task (either case)', () => {
    expect(toggleTaskLine('- [X] x', 0)).toEqual({ source: '- [ ] x', checked: false });
  });

  it('returns null for a line without a checkbox or out of range', () => {
    expect(toggleTaskLine('plain', 0)).toBeNull();
    expect(toggleTaskLine('plain', 5)).toBeNull();
  });
});
