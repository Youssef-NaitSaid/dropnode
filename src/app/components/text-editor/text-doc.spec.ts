import { describe, it, expect } from 'vitest';
import { Text } from '../../models/text';
import { textToDoc, docToText } from './text-doc';
import { textSchema } from './text-schema';

const roundTrip = (text: Text): Text => docToText(textSchema.nodeFromJSON(textToDoc(text)).toJSON());

describe('Text ↔ ProseMirror doc conversion', () => {
  it('round-trips a plain paragraph', () => {
    const text: Text = [{ kind: 'paragraph', runs: [{ text: 'Hello' }] }];
    expect(roundTrip(text)).toEqual(text);
  });

  it('round-trips every Formatting mark', () => {
    const text: Text = [
      {
        kind: 'paragraph',
        runs: [
          { text: 'bold', bold: true },
          { text: ' plain ' },
          { text: 'italic', italic: true },
          { text: 'marked', highlight: true },
          { text: 'linked', link: 'https://example.com' },
          { text: 'small', size: 'S' },
          { text: 'large', size: 'L' },
        ],
      },
    ];
    expect(roundTrip(text)).toEqual(text);
  });

  it('round-trips combined formats on one run', () => {
    const text: Text = [
      {
        kind: 'paragraph',
        runs: [{ text: 'all', bold: true, italic: true, highlight: true, size: 'L', link: 'https://x.io' }],
      },
    ];
    expect(roundTrip(text)).toEqual(text);
  });

  it('round-trips multiple paragraphs and bulleted lists', () => {
    const text: Text = [
      { kind: 'paragraph', runs: [{ text: 'Title', size: 'L' }] },
      { kind: 'bullets', items: [[{ text: 'first' }], [{ text: 'second', bold: true }]] },
      { kind: 'paragraph', runs: [{ text: 'after' }] },
    ];
    expect(roundTrip(text)).toEqual(text);
  });

  it('round-trips empty paragraphs and empty bullet items', () => {
    const text: Text = [
      { kind: 'paragraph', runs: [] },
      { kind: 'bullets', items: [[{ text: 'x' }], []] },
    ];
    expect(roundTrip(text)).toEqual(text);
  });

  it('represents an empty Text as a doc with one empty paragraph', () => {
    const doc = textToDoc([]);
    expect(doc).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
    expect(docToText(doc)).toEqual([{ kind: 'paragraph', runs: [] }]);
  });

  it('produces docs the schema itself accepts', () => {
    const text: Text = [
      { kind: 'paragraph', runs: [{ text: 'a', bold: true }] },
      { kind: 'bullets', items: [[{ text: 'b', highlight: true }]] },
    ];
    // nodeFromJSON validates against the schema and throws on illegal shapes
    expect(() => textSchema.nodeFromJSON(textToDoc(text)).check()).not.toThrow();
  });

  it('the schema cannot represent unsupported formats', () => {
    expect(textSchema.marks['underline']).toBeUndefined();
    expect(textSchema.nodes['heading']).toBeUndefined();
    expect(textSchema.nodes['ordered_list']).toBeUndefined();
  });
});
