// ============================================================
// DRIVER TREE HELPERS
// The trees themselves are NO LONGER a hardcoded JS constant here
// (P0#2), they live in store/driverTreeStore.js, loaded from
// data/config/driverTrees.json at boot and mutable at runtime
// through /api/meta/driver-trees. This file now only re-exports
// the store's read API plus the pure tree-walking helpers
// (flattenTree, findNode, flattenHypothesisNodes), which don't
// care whether the tree came from a JS literal or a JSON file ,
// same data shape either way, so the reasoning engine
// (ai_engine/orchestrator/investigationOrchestrator.js) needed ZERO changes for this move.
// ============================================================

export { getTree, listTrees, treeExists, setTree, createTree, addNode, editNode, deleteNode } from "../store/driverTreeStore.js";

export function flattenTree(node, parent = null, out = []) {
  out.push({ ...node, parentId: parent ? parent.id : null, children: undefined });
  (node.children || []).forEach((c) => flattenTree(c, node, out));
  return out;
}

export function findNode(tree, nodeId) {
  if (tree.id === nodeId) return tree;
  for (const c of tree.children || []) {
    const found = findNode(c, nodeId);
    if (found) return found;
  }
  return null;
}

// Every LEAF node (no children) in a KPI's tree is a candidate
// investigation hypothesis. Unchanged since the tree-source move ,
// this function has always operated on plain tree data, never on
// the DRIVER_TREES constant directly, which is exactly what made
// this move a data-source swap rather than a reasoning-code change.
export function flattenHypothesisNodes(tree) {
  const out = [];
  function walk(node) {
    if (!node.children || node.children.length === 0) {
      out.push(node);
    } else {
      node.children.forEach(walk);
    }
  }
  (tree.children || []).forEach(walk);
  return out;
}
