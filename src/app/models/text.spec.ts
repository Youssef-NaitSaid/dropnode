import { describe, it, expect } from 'vitest';
import {
  Text,
  textFromString,
  textToPlainString,
  isTextEmpty,
  textEquals,
  validateText,
} from './text';

describe('Text model', () => {
  describe('textFromString', () => {
    it('wraps a plain string into a single-paragraph, single-run Text', () => {
      expect(textFromString('Hello')).toEqual([
        { kind: 'paragraph', runs: [{ text: 'Hello' }] },
      ]);
    });

    it('wraps an empty string into a paragraph with no runs', () => {
      expect(textFromString('')).toEqual([{ kind: 'paragraph', runs: [] }]);
    });
  });

  describe('textToPlainString', () => {
    it('concatenates runs within a paragraph', () => {
      const text: Text = [
        { kind: 'paragraph', runs: [{ text: 'Hello ' }, { text: 'world', bold: true }] },
      ];
      expect(textToPlainString(text)).toBe('Hello world');
    });

    it('joins paragraphs and bullet items with newlines', () => {
      const text: Text = [
        { kind: 'paragraph', runs: [{ text: 'Title' }] },
        { kind: 'bullets', items: [[{ text: 'one' }], [{ text: 'two' }]] },
      ];
      expect(textToPlainString(text)).toBe('Title\none\ntwo');
    });
  });

  describe('isTextEmpty', () => {
    it('treats no blocks as empty', () => {
      expect(isTextEmpty([])).toBe(true);
    });

    it('treats whitespace-only runs as empty', () => {
      expect(isTextEmpty([{ kind: 'paragraph', runs: [{ text: '   ' }] }])).toBe(true);
      expect(isTextEmpty([{ kind: 'bullets', items: [[{ text: ' ' }], []] }])).toBe(true);
    });

    it('treats any non-whitespace character as non-empty', () => {
      expect(isTextEmpty([{ kind: 'paragraph', runs: [{ text: ' a ' }] }])).toBe(false);
      expect(isTextEmpty([{ kind: 'bullets', items: [[{ text: 'x' }]] }])).toBe(false);
    });
  });

  describe('textEquals', () => {
    it('is true for structurally identical Texts', () => {
      const a: Text = [{ kind: 'paragraph', runs: [{ text: 'x', bold: true }] }];
      const b: Text = [{ kind: 'paragraph', runs: [{ text: 'x', bold: true }] }];
      expect(textEquals(a, b)).toBe(true);
    });

    it('is false when formatting differs', () => {
      const a: Text = [{ kind: 'paragraph', runs: [{ text: 'x', bold: true }] }];
      const b: Text = [{ kind: 'paragraph', runs: [{ text: 'x' }] }];
      expect(textEquals(a, b)).toBe(false);
    });

    it('ignores JSON key order (external payloads compare equal to editor output)', () => {
      const editorOrder: Text = [
        { kind: 'paragraph', runs: [{ text: 'x', bold: true, size: 'L' }] },
      ];
      // Same content, keys written in a different order (as external JSON might)
      const externalOrder = [
        { runs: [{ size: 'L', bold: true, text: 'x' }], kind: 'paragraph' },
      ] as unknown as Text;
      expect(textEquals(editorOrder, externalOrder)).toBe(true);
    });
  });

  describe('validateText', () => {
    it('accepts a minimal paragraph Text', () => {
      expect(validateText([{ kind: 'paragraph', runs: [{ text: 'hi' }] }])).toBeNull();
    });

    it('accepts every supported format', () => {
      const text: Text = [
        {
          kind: 'paragraph',
          runs: [
            { text: 'a', bold: true },
            { text: 'b', italic: true },
            { text: 'c', highlight: true },
            { text: 'd', link: 'https://example.com' },
            { text: 'e', size: 'S' },
            { text: 'f', size: 'L' },
          ],
        },
        { kind: 'bullets', items: [[{ text: 'one' }], [{ text: 'two', bold: true }]] },
      ];
      expect(validateText(text)).toBeNull();
    });

    it('rejects non-array Texts', () => {
      expect(validateText('hello')).toBe('text must be an array of blocks');
      expect(validateText({ kind: 'paragraph' })).toBe('text must be an array of blocks');
    });

    it('rejects unknown block kinds', () => {
      expect(validateText([{ kind: 'heading', runs: [] }])).toBe(
        "block kind must be 'paragraph' or 'bullets'"
      );
    });

    it('rejects a paragraph without a runs array', () => {
      expect(validateText([{ kind: 'paragraph' }])).toBe('paragraph runs must be an array');
    });

    it('rejects bullets without an items array of run arrays', () => {
      expect(validateText([{ kind: 'bullets' }])).toBe('bullets items must be an array');
      expect(validateText([{ kind: 'bullets', items: ['x'] }])).toBe(
        'bullets items must be arrays of runs'
      );
    });

    it('rejects an empty bullets block (would break the editor schema)', () => {
      expect(validateText([{ kind: 'bullets', items: [] }])).toBe(
        'bullets items must be a non-empty array'
      );
    });

    it('rejects unknown keys on blocks', () => {
      expect(validateText([{ kind: 'paragraph', runs: [], extra: 1 }])).toBe(
        "unknown block key 'extra'"
      );
    });

    it('rejects runs with non-string text', () => {
      expect(validateText([{ kind: 'paragraph', runs: [{ text: 5 }] }])).toBe(
        'run text must be a string'
      );
    });

    it('rejects unknown format keys on runs', () => {
      expect(validateText([{ kind: 'paragraph', runs: [{ text: 'x', underline: true }] }])).toBe(
        "unknown run key 'underline'"
      );
    });

    it('rejects format flags that are not literally true', () => {
      expect(validateText([{ kind: 'paragraph', runs: [{ text: 'x', bold: false }] }])).toBe(
        'run bold must be true when present'
      );
      expect(validateText([{ kind: 'paragraph', runs: [{ text: 'x', highlight: 1 }] }])).toBe(
        'run highlight must be true when present'
      );
    });

    it("rejects sizes other than 'S' or 'L' (M is the absent default)", () => {
      expect(validateText([{ kind: 'paragraph', runs: [{ text: 'x', size: 'M' }] }])).toBe(
        "run size must be 'S' or 'L'"
      );
      expect(validateText([{ kind: 'paragraph', runs: [{ text: 'x', size: 'XL' }] }])).toBe(
        "run size must be 'S' or 'L'"
      );
    });

    it('rejects non-http(s) links', () => {
      expect(
        validateText([{ kind: 'paragraph', runs: [{ text: 'x', link: 'javascript:alert(1)' }] }])
      ).toBe('run link must be an http(s) URL');
      expect(
        validateText([{ kind: 'paragraph', runs: [{ text: 'x', link: 'ftp://files' }] }])
      ).toBe('run link must be an http(s) URL');
      expect(
        validateText([{ kind: 'paragraph', runs: [{ text: 'x', link: 'http://ok.com' }] }])
      ).toBeNull();
    });
  });
});
