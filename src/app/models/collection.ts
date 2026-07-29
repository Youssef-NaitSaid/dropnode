import { GraphState } from './graph-state';

/**
 * A Collection is a named container of zero or more Projects, shown as a
 * parent entry in the Sidebar. Collections are flat — never nested.
 */
export interface Collection {
  id: string;
  name: string;
}

/**
 * A Project is a saved graph with a unique identity, a name, and its own
 * route. Every Project belongs to exactly one Collection. Its Graph State
 * and Viewport are stored alongside, keyed by project id (ADR-0007).
 */
export interface Project {
  id: string;
  name: string;
  collectionId: string;
}

/**
 * The JSON envelope written by "Export collection" and read by
 * "Import collection". `graph` is exactly the Graph State export shape,
 * so a single project's graph can be hand-extracted from the file.
 */
export interface CollectionExportFile {
  name: string;
  projects: { name: string; graph: GraphState }[];
}
