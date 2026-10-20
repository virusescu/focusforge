import { describe, it, expect } from 'vitest';
import { extractFields, fillTemplate } from './templates';

describe('extractFields', () => {
  it('finds fields in the title and the details, once each, in first-appearance order', () => {
    const details = 'Bugfixing for issue id: $issueId.\nLink: [Jaas Link](http://ea.jaas.com/browse/$issueId)';
    expect(extractFields('$title', details)).toEqual(['title', 'issueId']);
  });

  it('scans the title before the details', () => {
    expect(extractFields('$b then $a', '$c $a')).toEqual(['b', 'a', 'c']);
  });

  it('allows letters, digits and underscores after a leading letter or underscore', () => {
    expect(extractFields('$_x $a1_b2 $A', '')).toEqual(['_x', 'a1_b2', 'A']);
  });

  it('treats names as case-sensitive', () => {
    expect(extractFields('$id $Id', '')).toEqual(['id', 'Id']);
  });

  it('does not treat $5, a lone $, or a trailing $ as fields', () => {
    expect(extractFields('costs $5 or $ or $', 'ends with $')).toEqual([]);
  });

  it('does not treat an escaped $$name as a field', () => {
    expect(extractFields('$$HOME and $$$real', '')).toEqual(['real']);
  });

  it('returns no fields for empty text', () => {
    expect(extractFields('', '')).toEqual([]);
  });
});

describe('fillTemplate', () => {
  it('replaces every occurrence of a field', () => {
    expect(fillTemplate('$id-$id', { id: '42' })).toBe('42-42');
  });

  it('fills the example from the design', () => {
    const text = 'Link: [Jaas Link](http://ea.jaas.com/browse/$issueId)';
    expect(fillTemplate(text, { issueId: 'ABC-7' })).toBe('Link: [Jaas Link](http://ea.jaas.com/browse/ABC-7)');
  });

  it('prints $$ as a single $ and keeps the name that follows literal', () => {
    expect(fillTemplate('$$bla', { bla: 'x' })).toBe('$bla');
  });

  it('handles $$$name as a literal $ followed by the value', () => {
    expect(fillTemplate('$$$name', { name: 'x' })).toBe('$x');
  });

  it('leaves $5 and a lone $ exactly as typed', () => {
    expect(fillTemplate('pay $5 or $', {})).toBe('pay $5 or $');
  });

  it('does not re-expand a value that contains placeholders', () => {
    expect(fillTemplate('$a $b', { a: '$b', b: 'two' })).toBe('$b two');
    expect(fillTemplate('$a', { a: '$$' })).toBe('$$');
  });

  it('uses an empty string for a field with no value', () => {
    expect(fillTemplate('[$x]', {})).toBe('[]');
  });

  it('treats names like Object.prototype members as ordinary fields', () => {
    expect(fillTemplate('Fix $constructor $toString $__proto__', {})).toBe('Fix   ');
    expect(fillTemplate('Fix $constructor', { constructor: 'ok' })).toBe('Fix ok');
  });

  it('leaves text without placeholders unchanged', () => {
    expect(fillTemplate('plain **text**\nline 2', {})).toBe('plain **text**\nline 2');
  });
});
