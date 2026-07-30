import { Run, Text, TextSize } from '../../models/text';

// Pure converter between the neutral Text wire format (ADR-0009) and
// ProseMirror doc JSON (ADR-0010). ProseMirror never leaks past this file's
// callers: Graph State, exports, and share links only ever see Text.

interface MarkJson {
  type: string;
  attrs?: Record<string, unknown>;
}

interface NodeJson {
  type: string;
  attrs?: Record<string, unknown>;
  content?: NodeJson[];
  text?: string;
  marks?: MarkJson[];
}

function runToInline(run: Run): NodeJson {
  const marks: MarkJson[] = [];
  if (run.bold) marks.push({ type: 'bold' });
  if (run.italic) marks.push({ type: 'italic' });
  if (run.highlight) marks.push({ type: 'highlight' });
  if (run.link) marks.push({ type: 'link', attrs: { href: run.link } });
  if (run.size) marks.push({ type: 'size', attrs: { level: run.size } });
  const node: NodeJson = { type: 'text', text: run.text };
  if (marks.length > 0) node.marks = marks;
  return node;
}

function paragraphJson(runs: Run[]): NodeJson {
  // ProseMirror omits `content` for empty nodes; mirror that canonical form
  return runs.length > 0
    ? { type: 'paragraph', content: runs.map(runToInline) }
    : { type: 'paragraph' };
}

/** Build ProseMirror doc JSON from a Text; empty Text becomes one empty paragraph. */
export function textToDoc(text: Text): NodeJson {
  const content: NodeJson[] = [];
  for (const block of text) {
    if (block.kind === 'paragraph') {
      content.push(paragraphJson(block.runs));
    } else {
      content.push({
        type: 'bullet_list',
        content: block.items.map(item => ({
          type: 'list_item',
          content: [paragraphJson(item)],
        })),
      });
    }
  }
  if (content.length === 0) content.push({ type: 'paragraph' });
  return { type: 'doc', content };
}

function inlineToRun(node: NodeJson): Run {
  const run: Run = { text: node.text ?? '' };
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case 'bold':
        run.bold = true;
        break;
      case 'italic':
        run.italic = true;
        break;
      case 'highlight':
        run.highlight = true;
        break;
      case 'link':
        run.link = String(mark.attrs?.['href'] ?? '');
        break;
      case 'size':
        run.size = mark.attrs?.['level'] as TextSize;
        break;
    }
  }
  return run;
}

function paragraphRuns(node: NodeJson): Run[] {
  return (node.content ?? []).map(inlineToRun);
}

/** Read a ProseMirror doc JSON back into the neutral Text shape. */
export function docToText(doc: NodeJson): Text {
  const text: Text = [];
  for (const block of doc.content ?? []) {
    if (block.type === 'paragraph') {
      text.push({ kind: 'paragraph', runs: paragraphRuns(block) });
    } else if (block.type === 'bullet_list') {
      text.push({
        kind: 'bullets',
        // A list item holds paragraphs; concatenating covers the general case
        items: (block.content ?? []).map(item =>
          (item.content ?? []).flatMap(paragraphRuns)
        ),
      });
    }
  }
  return text;
}
