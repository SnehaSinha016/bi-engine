import fs from "fs";
import path from "path";

// ============================================================
// P0#2, RUNTIME-CONFIGURABLE DRIVER TREES
// Trees now live in a JSON config file, loaded at boot and
// mutable at runtime through the /api/meta/driver-trees CRUD
// endpoints, NOT a hardcoded JS object anymore. This is still
// governed business configuration (the whole point of the driver
// tree per the original brief), the LLM never sees or writes
// this file; only humans, via the API, do.
//
// Seed file: data/config/driverTrees.json (the same 5 trees that
// used to be the DRIVER_TREES JS constant, now data). Runtime
// edits persist to .store/driverTrees.json so they survive a
// restart without touching the seed file.
// ============================================================

const SEED_FILE = path.join(process.cwd(), "data", "config", "driverTrees.json");
const RUNTIME_DIR = path.join(process.cwd(), ".store");
const RUNTIME_FILE = path.join(RUNTIME_DIR, "driverTrees.json");
if (!fs.existsSync(RUNTIME_DIR)) fs.mkdirSync(RUNTIME_DIR, { recursive: true });

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

// Runtime file (if it exists, meaning trees were edited at some
// point) takes precedence over the seed; otherwise start from seed.
let trees = fs.existsSync(RUNTIME_FILE) ? loadJson(RUNTIME_FILE) : loadJson(SEED_FILE);

function persist() {
  fs.writeFileSync(RUNTIME_FILE, JSON.stringify(trees, null, 2));
}

export function listTrees() {
  return trees;
}

export function getTree(kpiId) {
  const tree = trees[kpiId];
  if (!tree) throw new Error(`No driver tree configured for KPI: ${kpiId}`);
  return tree;
}

export function treeExists(kpiId) {
  return !!trees[kpiId];
}

// Full replace of one KPI's tree (PUT /api/meta/driver-trees/:kpi).
export function setTree(kpiId, treeDefinition) {
  if (treeDefinition.id !== kpiId) {
    throw new Error(`Tree id "${treeDefinition.id}" does not match KPI "${kpiId}"`);
  }
  trees[kpiId] = treeDefinition;
  persist();
  return trees[kpiId];
}

// Create a brand new KPI tree (POST /api/meta/driver-trees).
export function createTree(kpiId, treeDefinition) {
  if (trees[kpiId]) throw new Error(`A driver tree for "${kpiId}" already exists, use PUT to replace it`);
  return setTree(kpiId, treeDefinition);
}

// Add one node under an existing parent, anywhere in the tree
// (POST /api/meta/driver-trees/:kpi/nodes). This is what lets a
// new driver like Revenue -> Operational -> Warehouse Capacity get
// added without touching any reasoning code, the hypothesis
// engine discovers it purely by re-walking the tree on the next
// request (flattenHypothesisNodes has no cache).
export function addNode(kpiId, parentNodeId, node) {
  const tree = getTree(kpiId);
  if (!node.id || !node.label || !node.metricKey) {
    throw new Error("A new node requires at least id, label, and metricKey");
  }
  const target = findNodeMutable(tree, parentNodeId);
  if (!target) throw new Error(`Parent node "${parentNodeId}" not found in the "${kpiId}" tree`);
  target.children = target.children || [];
  if (target.children.some((c) => c.id === node.id)) {
    throw new Error(`Node id "${node.id}" already exists under "${parentNodeId}"`);
  }
  target.children.push(node);
  persist();
  return tree;
}

function findNodeMutable(node, id) {
  if (node.id === id) return node;
  for (const c of node.children || []) {
    const found = findNodeMutable(c, id);
    if (found) return found;
  }
  return null;
}

// Edits an existing node's own fields (label/metricKey/evidence
// categories/etc) in place, does not touch its children or move it
// in the tree. Root nodes can't be edited this way (edit the tree
// itself via PUT for that).
export function editNode(kpiId, nodeId, patch) {
  const tree = getTree(kpiId);
  if (tree.id === nodeId) throw new Error("Use PUT /driver-trees/:kpi to edit the root node");
  const target = findNodeMutable(tree, nodeId);
  if (!target) throw new Error(`Node "${nodeId}" not found in the "${kpiId}" tree`);
  const { children, ...safePatch } = patch; // never let a PATCH silently replace children
  Object.assign(target, safePatch);
  persist();
  return tree;
}

// Removes a node (and its subtree) from wherever it lives. Root
// nodes can't be deleted (delete the whole tree via a future
// endpoint if that's ever needed, not exposed today).
export function deleteNode(kpiId, nodeId) {
  const tree = getTree(kpiId);
  if (tree.id === nodeId) throw new Error("Cannot delete a KPI's root node");
  const removed = removeNodeMutable(tree, nodeId);
  if (!removed) throw new Error(`Node "${nodeId}" not found in the "${kpiId}" tree`);
  persist();
  return tree;
}

function removeNodeMutable(node, id) {
  if (!node.children) return false;
  const idx = node.children.findIndex((c) => c.id === id);
  if (idx !== -1) {
    node.children.splice(idx, 1);
    return true;
  }
  for (const c of node.children) {
    if (removeNodeMutable(c, id)) return true;
  }
  return false;
}

// Explicit reset-to-seed escape hatch (not exposed via API by
// default, available for local debugging/tests).
export function resetToSeed() {
  trees = loadJson(SEED_FILE);
  if (fs.existsSync(RUNTIME_FILE)) fs.unlinkSync(RUNTIME_FILE);
  return trees;
}
