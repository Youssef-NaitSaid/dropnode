import { GraphNode, HandleSide } from './node';
import { Connection } from './connection';
import { Bounds, graphBounds } from './bounds';

// Pure Tidy up layout (spec #26, ADR-0019). One hand-rolled Sugiyama-lite
// pass: cycle-breaking → longest-path layering → ordering → coordinates from
// real Node rects. Two-level per ADR-0004: Groups are contracted to
// super-nodes at the top level (child edges promoted), children are laid out
// inside each Group from intra-group Connections only, and the Group's rect
// becomes exactly its children's bounds plus padding. No Angular, no DOM,
// canvas units throughout. Deterministic: every tie breaks on nodes array
// order, so the same Graph State always tidies identically and tidy of a
// tidy result is empty (idempotence).

// Spacing knobs — visual tuning, not behavioral contracts.
export const TIDY_LAYER_GAP = 120; // between layers, along the flow
export const TIDY_NODE_GAP = 40; // between Nodes within a layer
export const TIDY_COMPONENT_GAP = 80; // between stacked components
export const TIDY_GRID_GAP = 40; // loner-grid gutters

// Must equal GraphService.GROUP_CHILD_PADDING — the exact-fit rule reuses the
// resize clamp's padding (a model module cannot import the service).
export const TIDY_GROUP_PADDING = 16;

export interface TidyNodePosition {
  id: string;
  x: number;
  y: number;
}

export interface TidyGroupRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TidyHandleAssignment {
  id: string;
  sourceHandle: HandleSide;
  targetHandle: HandleSide;
}

// The complete Tidy up mutation as data: only actual changes are listed, so
// an all-empty result means the graph is already tidy (nothing to do).
export interface TidyResult {
  nodePositions: TidyNodePosition[]; // regular Nodes (loose and children)
  groupRects: TidyGroupRect[]; // Groups: position and exact-fit size
  handleAssignments: TidyHandleAssignment[]; // re-picked Connection endpoints
}

/** True when the result changes nothing — the no-op guard for the Command layer. */
export function isTidyEmpty(result: TidyResult): boolean {
  return (
    result.nodePositions.length === 0 &&
    result.groupRects.length === 0 &&
    result.handleAssignments.length === 0
  );
}

/**
 * A copy of the graph arrays with a TidyResult applied — the pure statement
 * of what applying the mutation means (and the idempotence contract:
 * tidyLayout of an applied result is empty).
 */
export function applyTidyToState(
  nodes: readonly GraphNode[],
  connections: readonly Connection[],
  result: TidyResult,
): { nodes: GraphNode[]; connections: Connection[] } {
  const positions = new Map(result.nodePositions.map(p => [p.id, p]));
  const rects = new Map(result.groupRects.map(r => [r.id, r]));
  const handles = new Map(result.handleAssignments.map(h => [h.id, h]));
  return {
    nodes: nodes.map(n => {
      const rect = rects.get(n.id);
      if (rect) return { ...n, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      const p = positions.get(n.id);
      return p ? { ...n, x: p.x, y: p.y } : n;
    }),
    connections: connections.map(c => {
      const h = handles.get(c.id);
      return h ? { ...c, sourceHandle: h.sourceHandle, targetHandle: h.targetHandle } : c;
    }),
  };
}

// ---------------------------------------------------------------------------
// Internal: one layered arrangement of abstract items. Shared by the top
// level (roots) and each Group's inside (children).
// ---------------------------------------------------------------------------

interface Item {
  id: string;
  width: number;
  height: number;
  order: number; // nodes array index — the universal tie-break
  // A Connection-less Group still stacks as a one-unit component — only
  // regular Nodes ever gather in the loner grid
  standalone?: boolean;
}

interface Edge {
  from: string;
  to: string;
}

interface Point {
  x: number;
  y: number;
}

/**
 * Arrange items into the tidy shape, anchored at (0,0): each weakly-connected
 * component laid out left-to-right in layers, components stacked vertically
 * largest-first, items with no edges gathered into a grid after the last
 * component. Returns a position for every item.
 */
function arrangeItems(items: readonly Item[], edges: readonly Edge[]): Map<string, Point> {
  const positions = new Map<string, Point>();
  if (items.length === 0) return positions;

  const itemById = new Map(items.map(i => [i.id, i]));
  const cleanEdges = edges.filter(
    e => e.from !== e.to && itemById.has(e.from) && itemById.has(e.to),
  );

  // Weakly-connected components over the undirected adjacency
  const neighbors = new Map<string, Set<string>>(items.map(i => [i.id, new Set<string>()]));
  for (const e of cleanEdges) {
    neighbors.get(e.from)!.add(e.to);
    neighbors.get(e.to)!.add(e.from);
  }

  const componentOf = new Map<string, number>();
  const components: Item[][] = [];
  for (const item of items) {
    if (componentOf.has(item.id)) continue;
    if (neighbors.get(item.id)!.size === 0 && !item.standalone) continue;
    const member: Item[] = [];
    const queue = [item.id];
    componentOf.set(item.id, components.length);
    while (queue.length > 0) {
      const id = queue.shift()!;
      member.push(itemById.get(id)!);
      for (const next of neighbors.get(id)!) {
        if (!componentOf.has(next)) {
          componentOf.set(next, components.length);
          queue.push(next);
        }
      }
    }
    // BFS discovery order can wander; members keep nodes array order
    member.sort((a, b) => a.order - b.order);
    components.push(member);
  }
  const loners = items.filter(i => neighbors.get(i.id)!.size === 0 && !i.standalone);

  // Lay each component out and measure it
  const laidOut = components.map(member => {
    const local = layoutComponent(member, cleanEdges);
    let width = 0;
    let height = 0;
    for (const m of member) {
      const p = local.get(m.id)!;
      width = Math.max(width, p.x + m.width);
      height = Math.max(height, p.y + m.height);
    }
    return { member, local, width, height, order: member[0].order };
  });

  // Stack components vertically, largest area first (tie: array order)
  laidOut.sort((a, b) => b.width * b.height - a.width * a.height || a.order - b.order);
  let cursorY = 0;
  for (const comp of laidOut) {
    for (const m of comp.member) {
      const p = comp.local.get(m.id)!;
      positions.set(m.id, { x: p.x, y: cursorY + p.y });
    }
    cursorY += comp.height + TIDY_COMPONENT_GAP;
  }

  // Loner grid: edge-less items in rows of ceil(sqrt(n)), after the last
  // component, in nodes array order
  if (loners.length > 0) {
    const perRow = Math.ceil(Math.sqrt(loners.length));
    let rowY = laidOut.length > 0 ? cursorY : 0;
    for (let i = 0; i < loners.length; i += perRow) {
      const row = loners.slice(i, i + perRow);
      let cursorX = 0;
      for (const item of row) {
        positions.set(item.id, { x: cursorX, y: rowY });
        cursorX += item.width + TIDY_GRID_GAP;
      }
      rowY += Math.max(...row.map(r => r.height)) + TIDY_GRID_GAP;
    }
  }

  return positions;
}

/**
 * Layered layout of one connected component, anchored at (0,0): greedy
 * cycle-breaking, longest-path layering, then coordinates — layers advance
 * left-to-right, a layer's items stack top-down centered on the tallest
 * layer's stack.
 */
function layoutComponent(member: readonly Item[], allEdges: readonly Edge[]): Map<string, Point> {
  const ids = new Set(member.map(m => m.id));
  const edges = dedupeEdges(allEdges.filter(e => ids.has(e.from) && ids.has(e.to)));
  const forward = breakCycles(member, edges);

  // Longest-path layering along the acyclic forward edges
  const outgoing = new Map<string, string[]>(member.map(m => [m.id, []]));
  const indegree = new Map<string, number>(member.map(m => [m.id, 0]));
  for (const e of forward) {
    outgoing.get(e.from)!.push(e.to);
    indegree.set(e.to, indegree.get(e.to)! + 1);
  }
  const layerOf = new Map<string, number>(member.map(m => [m.id, 0]));
  const queue = member.filter(m => indegree.get(m.id) === 0).map(m => m.id);
  const remaining = new Map(indegree);
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const next of outgoing.get(id)!) {
      layerOf.set(next, Math.max(layerOf.get(next)!, layerOf.get(id)! + 1));
      remaining.set(next, remaining.get(next)! - 1);
      if (remaining.get(next) === 0) queue.push(next);
    }
  }

  const layerCount = Math.max(...[...layerOf.values()]) + 1;
  const layers: Item[][] = Array.from({ length: layerCount }, () => []);
  for (const m of member) {
    layers[layerOf.get(m.id)!].push(m);
  }
  orderLayers(layers, forward);

  // Coordinates: x advances by each layer's max width plus the layer gap;
  // within a layer items stack with the node gap, centered on the tallest stack
  const stackHeight = (layer: Item[]) =>
    layer.reduce((sum, m) => sum + m.height, 0) + (layer.length - 1) * TIDY_NODE_GAP;
  const maxStack = Math.max(...layers.map(stackHeight));

  const positions = new Map<string, Point>();
  let cursorX = 0;
  for (const layer of layers) {
    let cursorY = (maxStack - stackHeight(layer)) / 2;
    for (const m of layer) {
      positions.set(m.id, { x: cursorX, y: cursorY });
      cursorY += m.height + TIDY_NODE_GAP;
    }
    cursorX += Math.max(...layer.map(m => m.width)) + TIDY_LAYER_GAP;
  }
  return positions;
}

// Parallel Connections between the same pair collapse into one edge for the
// layout — multiplicity carries no layering information.
function dedupeEdges(edges: readonly Edge[]): Edge[] {
  const seen = new Set<string>();
  return edges.filter(e => {
    const key = `${e.from}\u0000${e.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Greedy cycle-breaking: DFS in nodes array order, dropping edges that close
// a cycle back into the active stack. The dropped back-edges still render —
// they just run right-to-left in the final layout.
function breakCycles(member: readonly Item[], edges: readonly Edge[]): Edge[] {
  const outgoing = new Map<string, Edge[]>(member.map(m => [m.id, []]));
  for (const e of edges) {
    outgoing.get(e.from)!.push(e);
  }
  const forward: Edge[] = [];
  const visited = new Set<string>();
  const onStack = new Set<string>();

  const visit = (id: string): void => {
    visited.add(id);
    onStack.add(id);
    for (const e of outgoing.get(id)!) {
      if (onStack.has(e.to)) continue; // back edge — reversed out of layering
      forward.push(e);
      if (!visited.has(e.to)) visit(e.to);
    }
    onStack.delete(id);
  };

  for (const m of member) {
    if (!visited.has(m.id)) visit(m.id);
  }
  return forward;
}

// Within-layer ordering: barycenter sweeps (down, up, down). Each item sorts
// by the mean index of its neighbors in the layer just ordered; items with
// no neighbors there keep their spot. Ties keep the current order (stable
// sort), so the whole pass stays deterministic from nodes array order.
function orderLayers(layers: Item[][], forward: readonly Edge[]): void {
  const down = new Map<string, string[]>();
  const up = new Map<string, string[]>();
  for (const e of forward) {
    up.set(e.to, [...(up.get(e.to) ?? []), e.from]);
    down.set(e.from, [...(down.get(e.from) ?? []), e.to]);
  }

  const sortLayer = (layer: Item[], neighborsOf: Map<string, string[]>, refIndex: Map<string, number>): void => {
    const bary = new Map<string, number>();
    layer.forEach((item, i) => {
      const refs = (neighborsOf.get(item.id) ?? []).filter(id => refIndex.has(id));
      bary.set(
        item.id,
        refs.length > 0 ? refs.reduce((sum, id) => sum + refIndex.get(id)!, 0) / refs.length : i,
      );
    });
    layer.sort((a, b) => bary.get(a.id)! - bary.get(b.id)!);
  };

  const indexOfLayer = (layer: Item[]): Map<string, number> =>
    new Map(layer.map((item, i) => [item.id, i]));

  for (const direction of ['down', 'up', 'down'] as const) {
    if (direction === 'down') {
      for (let li = 1; li < layers.length; li++) {
        sortLayer(layers[li], up, indexOfLayer(layers[li - 1]));
      }
    } else {
      for (let li = layers.length - 2; li >= 0; li--) {
        sortLayer(layers[li], down, indexOfLayer(layers[li + 1]));
      }
    }
  }
}

// Liang–Barsky: does the segment a→b pass through the rect? Used to catch
// straight corridors that would hide behind a Node card.
function segmentIntersectsRect(a: Point, b: Point, r: Bounds): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  return (
    clip(-dx, a.x - r.x) &&
    clip(dx, r.x + r.width - a.x) &&
    clip(-dy, a.y - r.y) &&
    clip(dy, r.y + r.height - a.y)
  );
}

// ---------------------------------------------------------------------------
// The seam: the complete Tidy up mutation as data.
// ---------------------------------------------------------------------------

/**
 * Compute the Tidy up arrangement for the whole graph: new positions for
 * every Node, exact-fit rects for Groups, and re-picked Connection Handles —
 * anchored at the old graph bounds' top-left. Only actual changes are
 * emitted; an empty result means the graph is already tidy.
 */
export function tidyLayout(
  nodes: readonly GraphNode[],
  connections: readonly Connection[],
): TidyResult {
  const result: TidyResult = { nodePositions: [], groupRects: [], handleAssignments: [] };
  const oldBounds = graphBounds(nodes);
  if (!oldBounds) return result;

  const orderOf = new Map(nodes.map((n, i) => [n.id, i]));
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const groups = nodes.filter(n => n.kind === 'group');
  const rootOf = (id: string): string => nodeById.get(id)?.parentId ?? id;

  // Inside each Group: children arranged from intra-group Connections only,
  // then the Group sized to exactly the arrangement plus padding. Positions
  // stay relative to the Group's content origin until roots are placed.
  const innerLayouts = new Map<string, Map<string, Point>>();
  const groupSize = new Map<string, { width: number; height: number }>();
  for (const group of groups) {
    const children = nodes.filter(n => n.parentId === group.id);
    if (children.length === 0) {
      groupSize.set(group.id, { width: group.width, height: group.height });
      continue;
    }
    const childIds = new Set(children.map(c => c.id));
    const intraEdges = connections
      .filter(c => childIds.has(c.sourceNodeId) && childIds.has(c.targetNodeId))
      .map(c => ({ from: c.sourceNodeId, to: c.targetNodeId }));
    const local = arrangeItems(
      children.map(c => ({ id: c.id, width: c.width, height: c.height, order: orderOf.get(c.id)! })),
      intraEdges,
    );
    let width = 0;
    let height = 0;
    for (const c of children) {
      const p = local.get(c.id)!;
      width = Math.max(width, p.x + c.width);
      height = Math.max(height, p.y + c.height);
    }
    innerLayouts.set(group.id, local);
    groupSize.set(group.id, {
      width: width + 2 * TIDY_GROUP_PADDING,
      height: height + 2 * TIDY_GROUP_PADDING,
    });
  }

  // Top level: Groups (at their new exact-fit size) among loose Nodes, with
  // Connections touching a child promoted to its Group. Promoted self-edges
  // (child↔child of one Group) are intra-group and stay out of this level.
  const roots = nodes.filter(n => !n.parentId);
  const rootEdges = connections
    .map(c => ({ from: rootOf(c.sourceNodeId), to: rootOf(c.targetNodeId) }))
    .filter(e => e.from !== e.to);
  const rootPositions = arrangeItems(
    roots.map(r => ({
      id: r.id,
      width: groupSize.get(r.id)?.width ?? r.width,
      height: groupSize.get(r.id)?.height ?? r.height,
      order: orderOf.get(r.id)!,
      standalone: r.kind === 'group',
    })),
    rootEdges,
  );

  // Anchor the arrangement (whose bounds start at 0,0) at the old top-left,
  // then resolve every Node's absolute position
  const newPos = new Map<string, Point>();
  for (const root of roots) {
    const p = rootPositions.get(root.id)!;
    newPos.set(root.id, { x: oldBounds.x + p.x, y: oldBounds.y + p.y });
  }
  for (const [groupId, local] of innerLayouts) {
    const origin = newPos.get(groupId)!;
    for (const [childId, p] of local) {
      newPos.set(childId, {
        x: origin.x + TIDY_GROUP_PADDING + p.x,
        y: origin.y + TIDY_GROUP_PADDING + p.y,
      });
    }
  }

  // Diff against the current Graph State: emit only actual changes
  for (const node of nodes) {
    const p = newPos.get(node.id)!;
    if (node.kind === 'group') {
      const size = groupSize.get(node.id)!;
      if (node.x !== p.x || node.y !== p.y || node.width !== size.width || node.height !== size.height) {
        result.groupRects.push({ id: node.id, x: p.x, y: p.y, ...size });
      }
    } else if (node.x !== p.x || node.y !== p.y) {
      result.nodePositions.push({ id: node.id, x: p.x, y: p.y });
    }
  }

  // Handles re-picked to follow the flow. Forward Connections face the
  // counterpart along the dominant axis of the new rects (ties fall to the
  // horizontal, matching the left-to-right flow) — except that a straight
  // right→left corridor hiding behind another Node's card detours under the
  // row via bottom Handles. A Connection pointing against the flow (only a
  // cycle's back edge does, since layers advance rightward) arcs over the
  // top instead: facing Handles would draw it as a straight line lying
  // exactly on the forward segments and behind the cards between.
  const newRect = (node: GraphNode): Bounds => {
    const p = newPos.get(node.id)!;
    const size = groupSize.get(node.id) ?? node;
    return { x: p.x, y: p.y, width: size.width, height: size.height };
  };
  // Only regular Node cards occlude — Groups render beneath Connections
  const occluders = nodes
    .filter(n => n.kind !== 'group')
    .map(n => ({ id: n.id, rect: newRect(n) }));
  for (const c of connections) {
    const source = nodeById.get(c.sourceNodeId);
    const target = nodeById.get(c.targetNodeId);
    if (!source || !target) continue;
    const sRect = newRect(source);
    const tRect = newRect(target);
    const dx = tRect.x + tRect.width / 2 - (sRect.x + sRect.width / 2);
    const dy = tRect.y + tRect.height / 2 - (sRect.y + sRect.height / 2);
    let sourceHandle: HandleSide;
    let targetHandle: HandleSide;
    if (dx < 0) {
      sourceHandle = 'top';
      targetHandle = 'top';
    } else if (Math.abs(dx) >= Math.abs(dy)) {
      sourceHandle = 'right';
      targetHandle = 'left';
      // The chord between the two facing Handle midpoints
      const from = { x: sRect.x + sRect.width, y: sRect.y + sRect.height / 2 };
      const to = { x: tRect.x, y: tRect.y + tRect.height / 2 };
      const occluded = occluders.some(
        o =>
          o.id !== source.id &&
          o.id !== target.id &&
          segmentIntersectsRect(from, to, o.rect),
      );
      if (occluded) {
        sourceHandle = 'bottom';
        targetHandle = 'bottom';
      }
    } else {
      sourceHandle = dy > 0 ? 'bottom' : 'top';
      targetHandle = dy > 0 ? 'top' : 'bottom';
    }
    if (c.sourceHandle !== sourceHandle || c.targetHandle !== targetHandle) {
      result.handleAssignments.push({ id: c.id, sourceHandle, targetHandle });
    }
  }

  return result;
}
