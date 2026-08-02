'use strict';

/**
 * DataFlowDiagramEngine — produces a Mermaid flowchart TD string
 * showing data flow roles across a codebase.
 *
 * Strategy: mirror the ArchitectureDiagramEngine layout.
 * Each role (Entry, Processing, Data, External) becomes a layer-header node
 * with representative file nodes hanging beneath it. Layer-to-layer edges
 * drive the top-down flow. Bottleneck nodes get a distinct red style.
 *
 * Roles are inferred from the same name-based patterns used by
 * DataFlowDiscoveryEngine so classification stays consistent.
 */

const ROLE_ORDER = ['Entry', 'Processing', 'Data', 'External'];

const ENTRY_PATTERNS    = [/controller/i, /handler/i, /endpoint/i, /api/i, /route/i, /-page$/i, /page\.(ts|js)$/i, /screen$/i, /view$/i, /component$/i, /presenter/i];
const SERVICE_PATTERNS  = [/service/i, /manager/i, /processor/i, /calculator/i, /engine/i, /orchestrator/i, /workflow/i, /usecase/i, /command/i, /query/i];
const REPO_PATTERNS     = [/repository/i, /repo\./i, /dao\./i, /store\./i, /storage/i, /persistence/i, /data\./i, /cache/i, /database/i];
const DB_PATTERNS       = [/^table:/i, /db\./i, /sql/i, /migration/i];
const EXTERNAL_PATTERNS = [/client/i, /gateway/i, /provider/i, /adapter/i, /proxy/i, /connector/i, /integration/i, /webhook/i, /http/i];

const MAX_REPS_PER_ROLE = 4;

function inferRole(node) {
  const name = (node.name ?? '').toLowerCase();
  const path = (node.path ?? node.id ?? '').replace(/\\/g, '/').toLowerCase();
  const test = patterns => patterns.some(p => p.test(name) || p.test(path));

  if (DB_PATTERNS.some(p => p.test(node.id) || p.test(name))) return 'Data';
  if (test(REPO_PATTERNS))     return 'Data';
  if (test(ENTRY_PATTERNS))    return 'Entry';
  if (test(EXTERNAL_PATTERNS)) return 'External';
  if (test(SERVICE_PATTERNS))  return 'Processing';
  return null;
}

// Prefix with 'n_' to avoid Mermaid reserved keywords (end, style, classDef, etc.)
function safeId(raw) {
  return ('n_' + String(raw)).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 48);
}

function safeLabel(name) {
  const result = (name ?? '')
    .replace(/\.(ts|js|tsx|jsx|vue|cs|py|java|kt)$/, '')
    .replace(/[-_]/g, ' ')
    .slice(0, 26)
    .replace(/"/g, "'")
    .replace(/[<>{}|]/g, ' ')
    .trim();
  return result || 'Node';
}

class DataFlowDiagramEngine {

  build(dataFlowAnalysis, graph) {
    if (graph?.nodes?.length >= 3) {
      return this._roleDiagram(dataFlowAnalysis, graph);
    }

    // No meaningful graph — fall back to workflow chain summary
    const workflows = dataFlowAnalysis?.primaryWorkflows ?? [];
    const entries   = dataFlowAnalysis?.entryPoints      ?? [];
    if (!workflows.length && !entries.length) {
      return 'flowchart TD\n  A(["No workflow data available"])';
    }
    return this._workflowSummaryDiagram(dataFlowAnalysis);
  }

  // ── Primary path: role-layered diagram (mirrors ArchitectureDiagramEngine) ────

  _roleDiagram(analysis, graph) {
    const nodes = graph.nodes ?? [];
    const edges = graph.edges ?? [];

    // Assign each graph node to a role
    const nodeRole = new Map();
    for (const node of nodes) {
      const role = inferRole(node);
      if (role) nodeRole.set(node.id, role);
    }

    // Promote unclassified nodes that participate in edges into Processing
    for (const node of nodes) {
      if (nodeRole.has(node.id)) continue;
      const hasEdge = edges.some(e => e.source === node.id || e.target === node.id);
      if (hasEdge) nodeRole.set(node.id, 'Processing');
    }

    // Count inbound edges per node — used to pick the most-referenced representatives
    const inbound = new Map();
    for (const e of edges) {
      inbound.set(e.target, (inbound.get(e.target) ?? 0) + 1);
    }

    // Collect and rank representatives per role
    const roleReps = new Map();
    for (const role of ROLE_ORDER) roleReps.set(role, []);

    for (const node of nodes) {
      const role = nodeRole.get(node.id);
      if (!role) continue;
      roleReps.get(role).push(node);
    }

    for (const [role, members] of roleReps) {
      const sorted = members.sort((a, b) => (inbound.get(b.id) ?? 0) - (inbound.get(a.id) ?? 0));
      roleReps.set(role, sorted.slice(0, MAX_REPS_PER_ROLE));
    }

    const activeRoles = ROLE_ORDER.filter(r => roleReps.get(r)?.length > 0);

    if (activeRoles.length < 2) {
      return this._workflowSummaryDiagram(analysis);
    }

    // Surface bottlenecks for distinct styling
    const bottleneckSet = new Set(analysis?.bottlenecks ?? []);

    const lines = ['flowchart TD'];
    lines.push('');

    const roleNodeId = new Map();
    for (const role of activeRoles) {
      const reps  = roleReps.get(role);
      const rid   = `role_${role}`;
      roleNodeId.set(role, rid);

      const totalInRole = [...nodeRole.values()].filter(r => r === role).length;

      lines.push(`  ${rid}(["${role} · ${totalInRole} module${totalInRole !== 1 ? 's' : ''}"])`);

      for (const node of reps) {
        const nid   = safeId(node.id);
        const label = safeLabel(node.name ?? node.id);
        lines.push(`  ${nid}["${label}"]`);
        lines.push(`  ${rid} --> ${nid}`);
      }
      lines.push('');
    }

    // Role-to-role flow edges (TD direction)
    for (let i = 0; i < activeRoles.length - 1; i++) {
      const from = roleNodeId.get(activeRoles[i]);
      const to   = roleNodeId.get(activeRoles[i + 1]);
      lines.push(`  ${from} --> ${to}`);
    }

    // Direct cross-role edges between representative nodes (up to 12)
    const keptIds = new Set([...roleReps.values()].flat().map(n => n.id));
    let extraEdges = 0;
    for (const edge of edges) {
      if (extraEdges >= 12) break;
      if (!keptIds.has(edge.source) || !keptIds.has(edge.target)) continue;
      if (edge.source === edge.target) continue;
      const srcRole = nodeRole.get(edge.source);
      const tgtRole = nodeRole.get(edge.target);
      if (!srcRole || !tgtRole || srcRole === tgtRole) continue;
      lines.push(`  ${safeId(edge.source)} --> ${safeId(edge.target)}`);
      extraEdges++;
    }

    lines.push('');

    lines.push('  classDef roleHeader   fill:#7c3aed,stroke:#6d28d9,color:#fff,font-weight:bold');
    lines.push('  classDef flowNode     fill:#1e1b4b,stroke:#4c1d95,color:#c4b5fd');
    lines.push('  classDef extHeader    fill:#374151,stroke:#4b5563,color:#d1d5db,font-weight:bold');
    lines.push('  classDef extNode      fill:#111827,stroke:#374151,color:#9ca3af');
    lines.push('  classDef bottleneck   fill:#7f1d1d,stroke:#dc2626,color:#fca5a5');
    lines.push('');

    const bottleneckNodeIds = [];

    for (const role of activeRoles) {
      const rid   = roleNodeId.get(role);
      const isExt = role === 'External';
      lines.push(`  class ${rid} ${isExt ? 'extHeader' : 'roleHeader'}`);
      for (const node of roleReps.get(role)) {
        const nid = safeId(node.id);
        if (bottleneckSet.has(node.name ?? node.id)) {
          bottleneckNodeIds.push(nid);
        } else {
          lines.push(`  class ${nid} ${isExt ? 'extNode' : 'flowNode'}`);
        }
      }
    }

    for (const nid of bottleneckNodeIds) {
      lines.push(`  class ${nid} bottleneck`);
    }

    return lines.join('\n');
  }

  // ── Fallback: compact workflow summary when no usable graph ──────────────────
  // Shows each workflow as a single node with its risk rating, connected in sequence.
  // Keeps the diagram readable for repos with sparse dependency data.

  _workflowSummaryDiagram(analysis) {
    const workflows = (analysis?.primaryWorkflows ?? []).slice(0, 6);
    const entries   = analysis?.entryPoints ?? [];

    if (!workflows.length && !entries.length) {
      return 'flowchart TD\n  A(["No workflow data available"])';
    }

    const lines = ['flowchart TD'];
    lines.push('');

    if (workflows.length) {
      const riskIcon = r => r === 'High' ? ' ⚠' : r === 'Moderate' ? ' △' : '';
      let prev = null;
      for (let i = 0; i < workflows.length; i++) {
        const wf  = workflows[i];
        const nid = `wf_${i}`;
        const label = safeLabel(wf.workflowName ?? `Flow ${i + 1}`);
        lines.push(`  ${nid}(["${label}${riskIcon(wf.failureRisk)}"])`);
        if (prev !== null) lines.push(`  wf_${prev} --> ${nid}`);
        prev = i;
      }
    } else {
      // Entry-points only
      for (let i = 0; i < Math.min(entries.length, 5); i++) {
        const nid = `ep_${i}`;
        lines.push(`  ${nid}["${safeLabel(entries[i])}"]`);
      }
    }

    lines.push('');
    lines.push('  classDef roleHeader fill:#7c3aed,stroke:#6d28d9,color:#fff,font-weight:bold');
    if (workflows.length) {
      for (let i = 0; i < workflows.length; i++) {
        lines.push(`  class wf_${i} roleHeader`);
      }
    }

    return lines.join('\n');
  }
}

module.exports = { DataFlowDiagramEngine };
