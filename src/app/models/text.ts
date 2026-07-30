// Text: the formattable content carried by a Node (required) or a Connection
// (optional). This is the library-neutral wire format (ADR-0009) — the editor
// engine never leaks into Graph State, exports, or share links.

export type TextSize = 'S' | 'L';

// A contiguous piece of content sharing one set of Formatting. Absent flags
// mean unformatted; absent size means M (the default).
export interface Run {
  text: string;
  bold?: true;
  italic?: true;
  highlight?: true;
  // http(s) URL only — enforced by validateText
  link?: string;
  size?: TextSize;
}

export interface ParagraphBlock {
  kind: 'paragraph';
  runs: Run[];
}

export interface BulletsBlock {
  kind: 'bullets';
  items: Run[][];
}

export type Block = ParagraphBlock | BulletsBlock;

export type Text = Block[];

/** Migrate a legacy plain-string label into a single-run Text. */
export function textFromString(value: string): Text {
  return [{ kind: 'paragraph', runs: value === '' ? [] : [{ text: value }] }];
}

/** Flatten a Text to plain text: blocks and bullet items joined by newlines. */
export function textToPlainString(text: Text): string {
  const lines: string[] = [];
  for (const block of text) {
    if (block.kind === 'paragraph') {
      lines.push(block.runs.map(r => r.text).join(''));
    } else {
      for (const item of block.items) {
        lines.push(item.map(r => r.text).join(''));
      }
    }
  }
  return lines.join('\n');
}

/** Empty means no non-whitespace character anywhere in the Text. */
export function isTextEmpty(text: Text): boolean {
  return textToPlainString(text).trim() === '';
}

// Rebuild a run with keys in a fixed order and only present flags, so Text
// from external JSON compares equal to Text the editor produces
function canonicalRun(run: Run): Run {
  const out: Run = { text: run.text };
  if (run.bold) out.bold = true;
  if (run.italic) out.italic = true;
  if (run.highlight) out.highlight = true;
  if (run.link) out.link = run.link;
  if (run.size) out.size = run.size;
  return out;
}

/** Canonical form (fixed key order) so structural equality survives JSON key order. */
export function canonicalizeText(text: Text): Text {
  return text.map(block =>
    block.kind === 'paragraph'
      ? { kind: 'paragraph', runs: block.runs.map(canonicalRun) }
      : { kind: 'bullets', items: block.items.map(item => item.map(canonicalRun)) }
  );
}

/** Structural equality — canonicalized so external JSON key order doesn't matter. */
export function textEquals(a: Text, b: Text): boolean {
  return JSON.stringify(canonicalizeText(a)) === JSON.stringify(canonicalizeText(b));
}

const RUN_KEYS = new Set(['text', 'bold', 'italic', 'highlight', 'link', 'size']);
const FLAG_KEYS = ['bold', 'italic', 'highlight'] as const;

function validateRun(run: unknown): string | null {
  if (!run || typeof run !== 'object' || Array.isArray(run)) {
    return 'run must be an object';
  }
  const r = run as Record<string, unknown>;
  for (const key of Object.keys(r)) {
    if (!RUN_KEYS.has(key)) return `unknown run key '${key}'`;
  }
  if (typeof r['text'] !== 'string') return 'run text must be a string';
  for (const flag of FLAG_KEYS) {
    if (r[flag] !== undefined && r[flag] !== true) {
      return `run ${flag} must be true when present`;
    }
  }
  if (r['size'] !== undefined && r['size'] !== 'S' && r['size'] !== 'L') {
    return "run size must be 'S' or 'L'";
  }
  if (r['link'] !== undefined) {
    if (typeof r['link'] !== 'string' || !/^https?:\/\//.test(r['link'])) {
      return 'run link must be an http(s) URL';
    }
  }
  return null;
}

function validateRuns(runs: unknown): string | null {
  for (const run of runs as unknown[]) {
    const error = validateRun(run);
    if (error) return error;
  }
  return null;
}

/**
 * Whitelist validation of an unknown value as Text. Returns null when valid,
 * or a reason string. Anything outside the supported shape — unknown keys,
 * bad sizes, non-http(s) links — is rejected.
 */
export function validateText(value: unknown): string | null {
  if (!Array.isArray(value)) return 'text must be an array of blocks';
  for (const block of value) {
    if (!block || typeof block !== 'object' || Array.isArray(block)) {
      return 'block must be an object';
    }
    const b = block as Record<string, unknown>;
    if (b['kind'] !== 'paragraph' && b['kind'] !== 'bullets') {
      return "block kind must be 'paragraph' or 'bullets'";
    }
    if (b['kind'] === 'paragraph') {
      for (const key of Object.keys(b)) {
        if (key !== 'kind' && key !== 'runs') return `unknown block key '${key}'`;
      }
      if (!Array.isArray(b['runs'])) return 'paragraph runs must be an array';
      const error = validateRuns(b['runs']);
      if (error) return error;
    } else {
      for (const key of Object.keys(b)) {
        if (key !== 'kind' && key !== 'items') return `unknown block key '${key}'`;
      }
      if (!Array.isArray(b['items'])) return 'bullets items must be an array';
      // An empty bullet_list violates the editor schema (content: 'list_item+')
      if ((b['items'] as unknown[]).length === 0) return 'bullets items must be a non-empty array';
      for (const item of b['items'] as unknown[]) {
        if (!Array.isArray(item)) return 'bullets items must be arrays of runs';
        const error = validateRuns(item);
        if (error) return error;
      }
    }
  }
  return null;
}
