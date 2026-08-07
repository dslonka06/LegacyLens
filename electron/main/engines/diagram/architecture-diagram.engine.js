'use strict';

/**
 * ArchitectureDiagramEngine — produces a Mermaid flowchart TD string
 * showing cross-layer dependency flow between architectural layers.
 *
 * Strategy: represent each layer as a single summary node, with representative
 * file nodes shown beneath it. Cross-layer edges drive the layout.
 * No subgraphs — Mermaid stacks subgraph contents vertically when edges
 * don't cross between them, which produces unreadable floating boxes.
 */

const LAYER_ORDER = ['Presentation', 'Business Logic', 'Data Access', 'External'];

const ENTRY_PATTERNS    = [/controller/i, /handler/i, /endpoint/i, /api/i, /route/i, /-page$/i, /page\.(ts|js)$/i, /screen$/i, /view$/i, /component$/i];
const SERVICE_PATTERNS  = [/service/i, /manager/i, /processor/i, /calculator/i, /engine/i, /orchestrator/i, /workflow/i, /usecase/i, /command/i, /query/i];
const REPO_PATTERNS     = [/repository/i, /repo\./i, /dao\./i, /store\./i, /storage/i, /persistence/i, /cache/i];
const DB_PATTERNS       = [/db\./i, /sql/i, /database/i, /migration/i];
const EXTERNAL_PATTERNS = [/client/i, /gateway/i, /provider/i, /adapter/i, /proxy/i, /connector/i, /integration/i, /webhook/i, /http/i];

const MAX_NODES_PER_LAYER = 4;

const LAYER_MAP = {
  entry:      'Presentation',
  processor:  'Business Logic',
  repository: 'Data Access',
  database:   'Data Access',
  external:   'External',
};

function inferLayer(node) {
  const name    = (node.name ?? '').toLowerCase();
  const path    = (node.path ?? node.id ?? '').replace(/\\/g, '/').toLowerCase();
  const test    = patterns => patterns.some(p => p.test(name) || p.test(path));

  if (test(DB_PATTERNS))       return 'Data Access';
  if (test(REPO_PATTERNS))     return 'Data Access';
  if (test(ENTRY_PATTERNS))    return 'Presentation';
  if (test(EXTERNAL_PATTERNS)) return 'External';
  if (test(SERVICE_PATTERNS))  return 'Business Logic';
  return null;
}

function safeId(raw) {
  return ('n_' + String(raw)).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
}

function shortName(name) {
  return (name ?? '')
    .replace(/\.(ts|js|tsx|jsx|vue|cs|py|java|kt)$/, '')
    .replace(/[-_]/g, ' ')
    .slice(0, 24);
}

class ArchitectureDiagramEngine {

  build(model) {
    const graph    = model.relationships?.dependencies?.graph ?? null;
    const patterns = model.relationships?.architecture?.patterns ?? [];

    if (graph?.nodes?.length) {
      return this._layerDiagram(graph, patterns);
    }

    return this._patternOnlyDiagram(patterns);
  }

  _layerDiagram(graph, patterns) {
    const nodes = graph.nodes ?? [];
    const edges = graph.edges ?? [];

    // Assign each node to a layer
    const nodeLayer = new Map();
    for (const node of nodes) {
      const layer = inferLayer(node);
      if (layer) nodeLayer.set(node.id, layer);
    }

    // Promote unclassified nodes that have cross-layer edges into Business Logic
    for (const node of nodes) {
      if (nodeLayer.has(node.id)) continue;
      const hasEdge = edges.some(e => e.source === node.id || e.target === node.id);
      if (hasEdge) nodeLayer.set(node.id, 'Business Logic');
    }

    // Count inbound per node for picking representatives
    const inbound = new Map();
    for (const e of edges) {
      inbound.set(e.target, (inbound.get(e.target) ?? 0) + 1);
    }

    // Pick top N representatives per layer (most-referenced first)
    const layerReps = new Map();
    for (const layer of LAYER_ORDER) layerReps.set(layer, []);

    for (const node of nodes) {
      const layer = nodeLayer.get(node.id);
      if (!layer) continue;
      layerReps.get(layer).push(node);
    }

    for (const [layer, members] of layerReps) {
      const sorted = members.sort((a, b) => (inbound.get(b.id) ?? 0) - (inbound.get(a.id) ?? 0));
      layerReps.set(layer, sorted.slice(0, MAX_NODES_PER_LAYER));
    }

    // Determine which layers are actually populated
    const activeLayers = LAYER_ORDER.filter(l => layerReps.get(l)?.length > 0);

    if (activeLayers.length < 2) {
      return this._patternOnlyDiagram(patterns);
    }

    const lines = ['flowchart TD'];
    lines.push('');

    // Emit a representative node for each layer, then individual file nodes beneath it
    const layerNodeId = new Map();
    for (const layer of activeLayers) {
      const reps = layerReps.get(layer);
      const lid  = `layer_${layer.replace(/ /g, '_')}`;
      layerNodeId.set(layer, lid);

      const count = nodeLayer.size > 0
        ? [...nodeLayer.values()].filter(l => l === layer).length
        : reps.length;

      // Layer header node — rounded rectangle
      lines.push(`  ${lid}(["${layer} · ${count} module${count !== 1 ? 's' : ''}"])`);

      // Representative file nodes hang below the header
      for (const node of reps) {
        const nid   = safeId(node.id);
        const label = shortName(node.name ?? node.id);
        lines.push(`  ${nid}["${label}"]`);
        lines.push(`  ${lid} --> ${nid}`);
      }
      lines.push('');
    }

    // Cross-layer edges — connect layer header nodes in order (TD flow)
    for (let i = 0; i < activeLayers.length - 1; i++) {
      const from = layerNodeId.get(activeLayers[i]);
      const to   = layerNodeId.get(activeLayers[i + 1]);
      lines.push(`  ${from} --> ${to}`);
    }

    // Also emit any direct cross-layer edges between rep nodes (up to 12)
    const keptIds = new Set([...layerReps.values()].flat().map(n => n.id));
    let extraEdges = 0;
    for (const edge of edges) {
      if (extraEdges >= 12) break;
      if (!keptIds.has(edge.source) || !keptIds.has(edge.target)) continue;
      if (edge.source === edge.target) continue;
      const srcLayer = nodeLayer.get(edge.source);
      const tgtLayer = nodeLayer.get(edge.target);
      if (!srcLayer || !tgtLayer || srcLayer === tgtLayer) continue;
      lines.push(`  ${safeId(edge.source)} --> ${safeId(edge.target)}`);
      extraEdges++;
    }

    lines.push('');

    // Styling — layer headers use accent tones; file nodes are neutral
    lines.push('  classDef layerHeader fill:#7c3aed,stroke:#6d28d9,color:#fff,font-weight:bold');
    lines.push('  classDef fileNode    fill:#1e1b4b,stroke:#4c1d95,color:#c4b5fd');
    lines.push('  classDef extHeader   fill:#374151,stroke:#4b5563,color:#d1d5db,font-weight:bold');
    lines.push('  classDef extNode     fill:#111827,stroke:#374151,color:#9ca3af');
    lines.push('');

    for (const layer of activeLayers) {
      const lid  = layerNodeId.get(layer);
      const isExt = layer === 'External';
      lines.push(`  class ${lid} ${isExt ? 'extHeader' : 'layerHeader'}`);
      for (const node of layerReps.get(layer)) {
        lines.push(`  class ${safeId(node.id)} ${isExt ? 'extNode' : 'fileNode'}`);
      }
    }

    return lines.join('\n');
  }

  _patternOnlyDiagram(patterns) {
    if (!patterns.length) {
      return null;
    }

    const lines = ['flowchart TD'];
    const sorted = [...patterns].sort((a, b) => b.confidence - a.confidence).slice(0, 4);
    let prev = null;
    for (const p of sorted) {
      const id  = safeId(p.name);
      const pct = Math.round((p.confidence ?? 0) * 100);
      lines.push(`  ${id}(["${p.name} · ${pct}%"])`);
      if (prev) lines.push(`  ${prev} --> ${id}`);
      prev = id;
    }
    return lines.join('\n');
  }
}

module.exports = { ArchitectureDiagramEngine };
