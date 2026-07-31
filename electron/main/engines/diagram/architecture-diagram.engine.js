'use strict';

/**
 * ArchitectureDiagramEngine — produces a Mermaid flowchart TD string
 * representing the architectural layer breakdown of a codebase.
 *
 * Input: KnowledgeModel (relationships.dependencies.graph + relationships.architecture.patterns)
 * Output: string — valid Mermaid syntax, always renderable
 */

const ROLE_LAYER = {
  entry:      'Presentation',
  processor:  'Business Logic',
  repository: 'Data Access',
  external:   'External',
  database:   'External',
  unknown:    null, // excluded unless it has edges
};

const LAYER_ORDER = ['Presentation', 'Business Logic', 'Data Access', 'External'];

const ENTRY_PATTERNS    = [/controller/i, /handler/i, /endpoint/i, /api/i, /route/i, /-page$/i, /page\.ts$/i, /screen$/i, /view$/i, /presenter/i, /component$/i];
const SERVICE_PATTERNS  = [/service/i, /manager/i, /processor/i, /calculator/i, /engine/i, /orchestrator/i, /workflow/i, /usecase/i, /command/i, /query/i];
const REPO_PATTERNS     = [/repository/i, /repo\./i, /dao\./i, /store\./i, /storage/i, /persistence/i, /data\./i, /cache/i, /database/i];
const DB_PATTERNS       = [/^table:/i, /db\./i, /sql/i];
const EXTERNAL_PATTERNS = [/client/i, /gateway/i, /provider/i, /adapter/i, /proxy/i, /connector/i, /integration/i, /webhook/i, /http/i];

const MAX_NODES_PER_LAYER = 6;
const MAX_EDGES           = 35;

function inferRole(node) {
  const name     = (node.name ?? '').toLowerCase();
  const pathLow  = (node.path ?? node.id ?? '').replace(/\\/g, '/').toLowerCase();
  const test     = patterns => patterns.some(p => p.test(name) || p.test(pathLow));

  if (DB_PATTERNS.some(p => p.test(node.id ?? '') || p.test(name))) return 'database';
  if (test(REPO_PATTERNS))     return 'repository';
  if (test(ENTRY_PATTERNS))    return 'entry';
  if (test(EXTERNAL_PATTERNS)) return 'external';
  if (test(SERVICE_PATTERNS))  return 'processor';
  return 'unknown';
}

// Mermaid node IDs must be alphanumeric + underscores, no leading digits
function safeId(raw) {
  return ('n_' + raw).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
}

function shortName(name) {
  // Truncate very long names and strip common suffixes for readability
  return name.replace(/\.(ts|js|tsx|jsx|vue|cs|py|java|kt)$/, '').slice(0, 28);
}

class ArchitectureDiagramEngine {

  build(model) {
    const graph    = model.relationships?.dependencies?.graph ?? null;
    const patterns = model.relationships?.architecture?.patterns ?? [];

    if (!graph || !graph.nodes?.length) {
      return this._patternOnlyDiagram(patterns);
    }

    return this._layerDiagram(graph, patterns);
  }

  // ── Full layer diagram from dependency graph ─────────────────────────────────

  _layerDiagram(graph, patterns) {
    const nodes = graph.nodes ?? [];
    const edges = graph.edges ?? [];

    // Annotate each node with its layer
    const typed = nodes.map(n => ({
      ...n,
      role:  inferRole(n),
      layer: ROLE_LAYER[inferRole(n)],
    }));

    // Count inbound edges per node for ranking within a layer
    const inbound = new Map();
    for (const e of edges) {
      inbound.set(e.target, (inbound.get(e.target) ?? 0) + 1);
    }

    // Group by layer, sort by inbound degree, cap per layer
    const byLayer = new Map();
    for (const layer of LAYER_ORDER) byLayer.set(layer, []);

    for (const node of typed) {
      if (!node.layer) continue;
      byLayer.get(node.layer).push(node);
    }

    // For unknown nodes that participate in edges, promote to Business Logic
    const knownIds = new Set(typed.filter(n => n.layer).map(n => n.id));
    for (const node of typed) {
      if (node.role !== 'unknown') continue;
      const hasEdges = edges.some(e => e.source === node.id || e.target === node.id);
      if (hasEdges) {
        node.layer = 'Business Logic';
        byLayer.get('Business Logic').push(node);
        knownIds.add(node.id);
      }
    }

    // Sort each layer by inbound degree desc and cap
    const kept = new Map();
    const overflow = new Map();
    for (const [layer, members] of byLayer) {
      const sorted = [...members].sort((a, b) => (inbound.get(b.id) ?? 0) - (inbound.get(a.id) ?? 0));
      kept.set(layer, sorted.slice(0, MAX_NODES_PER_LAYER));
      const extra = sorted.length - MAX_NODES_PER_LAYER;
      if (extra > 0) overflow.set(layer, extra);
    }

    const keptIds = new Set([...kept.values()].flat().map(n => n.id));

    // Build diagram
    const lines = ['flowchart TD'];

    for (const layer of LAYER_ORDER) {
      const members = kept.get(layer) ?? [];
      if (!members.length) continue;

      lines.push(`  subgraph ${layer}`);
      for (const node of members) {
        lines.push(`    ${safeId(node.id)}["${shortName(node.name ?? node.id)}"]`);
      }
      if (overflow.has(layer)) {
        lines.push(`    ovf_${layer.replace(/ /g, '_')}(("+ ${overflow.get(layer)} more"))`);
      }
      lines.push('  end');
    }

    // Edges — only between kept nodes, capped
    let edgeCount = 0;
    for (const edge of edges) {
      if (edgeCount >= MAX_EDGES) break;
      if (!keptIds.has(edge.source) || !keptIds.has(edge.target)) continue;
      if (edge.source === edge.target) continue;
      lines.push(`  ${safeId(edge.source)} --> ${safeId(edge.target)}`);
      edgeCount++;
    }

    // Styles — one color class per layer
    lines.push('  classDef presentation fill:#6366f1,stroke:#4f46e5,color:#fff');
    lines.push('  classDef bizlogic    fill:#8b5cf6,stroke:#7c3aed,color:#fff');
    lines.push('  classDef dataaccess  fill:#a78bfa,stroke:#7c3aed,color:#fff');
    lines.push('  classDef external    fill:#374151,stroke:#4b5563,color:#d1d5db');

    for (const node of (kept.get('Presentation') ?? [])) {
      lines.push(`  class ${safeId(node.id)} presentation`);
    }
    for (const node of (kept.get('Business Logic') ?? [])) {
      lines.push(`  class ${safeId(node.id)} bizlogic`);
    }
    for (const node of (kept.get('Data Access') ?? [])) {
      lines.push(`  class ${safeId(node.id)} dataaccess`);
    }
    for (const node of (kept.get('External') ?? [])) {
      lines.push(`  class ${safeId(node.id)} external`);
    }

    return lines.join('\n');
  }

  // ── Fallback: pattern names only, no graph ───────────────────────────────────

  _patternOnlyDiagram(patterns) {
    if (!patterns.length) {
      return 'flowchart TD\n  A["No architecture data available"]';
    }

    const lines = ['flowchart TD'];
    lines.push('  subgraph "Detected Patterns"');
    for (const p of patterns.slice(0, 5)) {
      const id = safeId(p.name);
      const pct = Math.round((p.confidence ?? 0) * 100);
      lines.push(`    ${id}["${p.name} (${pct}%)"]`);
    }
    lines.push('  end');
    return lines.join('\n');
  }
}

module.exports = { ArchitectureDiagramEngine };
