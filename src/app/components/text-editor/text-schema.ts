import { Schema } from 'prosemirror-model';

// The editing schema is locked to exactly the six Formatting controls
// (ADR-0010): nothing unrepresentable in the wire format (ADR-0009) can be
// produced or pasted. Paste mapping falls out of parseDOM: recognized tags
// keep their format, everything else is stripped by the schema.
export const textSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      group: 'block',
      content: 'inline*',
      parseDOM: [{ tag: 'p' }],
      toDOM: () => ['p', 0],
    },
    bullet_list: {
      group: 'block',
      content: 'list_item+',
      parseDOM: [{ tag: 'ul' }],
      toDOM: () => ['ul', 0],
    },
    list_item: {
      content: 'paragraph+',
      parseDOM: [{ tag: 'li' }],
      toDOM: () => ['li', 0],
    },
    text: { group: 'inline' },
  },
  marks: {
    bold: {
      parseDOM: [{ tag: 'strong' }, { tag: 'b' }, { style: 'font-weight=bold' }],
      toDOM: () => ['strong', 0],
    },
    italic: {
      parseDOM: [{ tag: 'em' }, { tag: 'i' }, { style: 'font-style=italic' }],
      toDOM: () => ['em', 0],
    },
    highlight: {
      parseDOM: [{ tag: 'mark' }],
      toDOM: () => ['mark', 0],
    },
    link: {
      attrs: { href: {} },
      inclusive: false,
      parseDOM: [
        {
          tag: 'a[href]',
          getAttrs: (dom: HTMLElement) => {
            const href = dom.getAttribute('href') ?? '';
            // Only http(s) links survive parsing — mirrors validateText
            return /^https?:\/\//.test(href) ? { href } : false;
          },
        },
      ],
      toDOM: node => ['a', { href: node.attrs['href'] }, 0],
    },
    size: {
      attrs: { level: {} },
      parseDOM: [
        { tag: 'span[data-size="S"]', getAttrs: () => ({ level: 'S' }) },
        { tag: 'span[data-size="L"]', getAttrs: () => ({ level: 'L' }) },
      ],
      toDOM: node => ['span', { 'data-size': node.attrs['level'] }, 0],
    },
  },
});
