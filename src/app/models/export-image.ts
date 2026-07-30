import { GraphNode } from './node';

// PNG Export capture rules (ADR-0014): full graph bounds plus fixed padding,
// rasterized at 2x so Text stays crisp when enlarged. Independent of the
// Viewport's pan/zoom.
export const EXPORT_PADDING = 40;
export const EXPORT_SCALE = 2;

export interface ExportBounds {
  // Capture region in canvas units
  x: number;
  y: number;
  width: number;
  height: number;
  // Pixel dimensions of the produced PNG (region x EXPORT_SCALE)
  outputWidth: number;
  outputHeight: number;
}

/** Bounding box of all Nodes plus padding; an empty graph yields just the padded origin. */
export function exportBounds(nodes: readonly GraphNode[]): ExportBounds {
  if (nodes.length === 0) {
    const side = EXPORT_PADDING * 2;
    return {
      x: 0, y: 0, width: side, height: side,
      outputWidth: side * EXPORT_SCALE,
      outputHeight: side * EXPORT_SCALE,
    };
  }
  const minX = Math.min(...nodes.map(n => n.x));
  const minY = Math.min(...nodes.map(n => n.y));
  const maxX = Math.max(...nodes.map(n => n.x + n.width));
  const maxY = Math.max(...nodes.map(n => n.y + n.height));
  const width = maxX - minX + EXPORT_PADDING * 2;
  const height = maxY - minY + EXPORT_PADDING * 2;
  return {
    x: minX - EXPORT_PADDING,
    y: minY - EXPORT_PADDING,
    width,
    height,
    outputWidth: width * EXPORT_SCALE,
    outputHeight: height * EXPORT_SCALE,
  };
}

// ── Export Theme ────────────────────────────────────────────────────
// Render-time-only appearance scheme (ADR-0014): background plus the default
// element colors, never stored in Graph State. Applied Palette colors pass
// through untouched in both values.

export type ExportTheme = 'dark' | 'light';

export interface ExportThemeColors {
  background: string;
  nodeBackground: string;
  nodeText: string;
  groupBorder: string;
  groupLabel: string;
}

export const EXPORT_THEMES: Record<ExportTheme, ExportThemeColors> = {
  // Mirrors the on-screen editor: near-black canvas, light node cards,
  // translucent-white Group chrome.
  dark: {
    background: '#0e0e11',
    nodeBackground: '#f0f0f5',
    nodeText: '#1a1a2e',
    groupBorder: 'rgba(255, 255, 255, 0.22)',
    groupLabel: '#f0f0f5',
  },
  // White background; only the dark-only defaults (Group chrome) flip —
  // node cards and the Connection purple stay legible on white as-is.
  light: {
    background: '#ffffff',
    nodeBackground: '#f0f0f5',
    nodeText: '#1a1a2e',
    groupBorder: 'rgba(15, 15, 18, 0.3)',
    groupLabel: '#1a1a2e',
  },
};

/** A Node's exported fill: its applied Palette color, else the theme default. */
export function themedNodeBackground(color: string | undefined, theme: ExportThemeColors): string {
  return color ?? theme.nodeBackground;
}
