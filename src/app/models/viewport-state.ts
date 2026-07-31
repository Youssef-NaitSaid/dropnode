export interface ViewportState {
  panX: number;
  panY: number;
  zoom: number;
}

// The editor's fixed zoom range — the single source of truth shared by every
// zoom operation (wheel, toolbar buttons, and bounds-centered framing).
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 5;
