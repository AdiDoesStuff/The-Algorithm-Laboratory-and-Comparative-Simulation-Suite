/**
 * treeAdapter.js — Converts backend snapshot structure to TreeCanvas generic format.
 *
 * Backend snapshot shape:
 * {
 *   nodes: [ { id, label, sublabel, parent_id, side }, ... ],
 *   root_id: 1
 * }
 *
 * TreeCanvas snapshot shape:
 * {
 *   nodes: [ { id, label, sublabel }, ... ],
 *   edges: [ { from, to, side }, ... ],
 *   rootId: 1
 * }
 */

export function toTreeCanvasSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.nodes)) {
        return { nodes: [], edges: [], rootId: null };
    }

    const edges = snapshot.nodes
        .filter(n => n.parent_id !== null && n.parent_id !== undefined)
        .map(n => ({
            from: n.parent_id,
            to: n.id,
            side: n.side || null
        }));

    const nodes = snapshot.nodes.map(n => ({
        id: n.id,
        label: String(n.label ?? ''),
        sublabel: n.sublabel ? String(n.sublabel) : null
    }));

    return {
        nodes,
        edges,
        rootId: snapshot.root_id ?? null
    };
}
