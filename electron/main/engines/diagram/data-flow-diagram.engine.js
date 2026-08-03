'use strict';

/**
 * DataFlowDiagramEngine — produces a Mermaid flowchart LR string
 * showing how data moves through the codebase at runtime.
 *
 * Answers: "What happens to data and where does it go?"
 * Contrast with ArchitectureDiagramEngine which answers: "How are the pieces structured?"
 *
 * Four rendering paths, in priority order:
 *   1. Workflow chains  — when primaryWorkflows have enrichedConnections (per-hop verb data).
 *      Renders each workflow as a horizontal left-to-right chain with labeled edges.
 *   2. Lite chains      — when workflows have node lists but no enriched verbs.
 *      Renders each workflow as a subgraph row of shaped nodes. Better than role buckets
 *      for Angular/Electron apps where every page shares the same downstream services.
 *   3. Role-grouped LR  — when a dependency graph is available but no workflow nodes.
 *      Groups nodes by data-flow role (Entry / Processing / Data / External), LR direction.
 *   4. Workflow summary — fallback when no graph. Shows workflow cards as named nodes.
 *
 * Visual differentiation from ArchitectureDiagramEngine:
 *   - flowchart LR  (architecture uses TD)
 *   - Teal/green palette  (architecture uses purple)
 *   - DFD node shapes: processes = double-circle, data stores = cylinder, actors = rectangle
 *   - Edge labels carry interaction verbs: reads, writes, calls, publishes, etc.
 */

const ROLE_ORDER = ['Entry', 'Processing', 'Data', 'External'];

const ENTRY_PATTERNS    = [/controller/i, /handler/i, /endpoint/i, /api/i, /route/i, /-page$/i, /page\.(ts|js)$/i, /screen$/i, /view$/i, /component$/i, /presenter/i];
const SERVICE_PATTERNS  = [/service/i, /manager/i, /processor/i, /calculator/i, /engine/i, /orchestrator/i, /workflow/i, /usecase/i, /command/i, /query/i];
const REPO_PATTERNS     = [/repository/i, /repo\./i, /dao\./i, /store\./i, /storage/i, /persistence/i, /data\./i, /cache/i, /database/i];
const DB_PATTERNS       = [/^table:/i, /db\./i, /sql/i, /migration/i];
const EXTERNAL_PATTERNS = [/client/i, /gateway/i, /provider/i, /adapter/i, /proxy/i, /connector/i, /integration/i, /webhook/i, /http/i];

const MAX_REPS_PER_ROLE = 4;
// Maximum workflows rendered in chain mode — keeps the diagram readable
const MAX_WORKFLOW_CHAINS = 4;
// Maximum workflows rendered in lite-chain mode (no enriched verbs)
const MAX_LITE_CHAINS = 6;

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

/**
 * Sanitise an edge-label verb for Mermaid pipe syntax.
 * Mermaid requires labels in `-->|label|` to not contain `|` or `"`.
 */
function safeVerb(verb) {
  return (verb ?? 'calls')
    .replace(/[|"]/g, '')
    .trim()
    .slice(0, 16) || 'calls';
}

/**
 * Choose a Mermaid node shape based on the node's data-flow role.
 *   - Entry / External actors  → rectangle  [label]
 *   - Processing (services)    → double-circle  ((label))
 *   - Data stores              → cylinder  [(label)]
 */
function nodeShape(role, id, label) {
  switch (role) {
    case 'Processing':
      return `${id}(("${label}"))`;
    case 'Data':
      return `${id}[("${label}")]`;
    default:
      return `${id}["${label}"]`;
  }
}

/**
 * Map a fileRole string (from DataFlowExtractionEngine) to a diagram role bucket.
 */
function fileRoleToDisplayRole(fileRole) {
  switch (fileRole) {
    case 'component':
    case 'controller':
      return 'Entry';
    case 'service':
    case 'http-client':
    case 'state-store':
      return 'Processing';
    case 'repository':
      return 'Data';
    default:
      return null;
  }
}

class DataFlowDiagramEngine {

  /**
   * Build a Mermaid flowchart LR for a single file's data flow.
   * Renders: input nodes → step process nodes → output nodes, left to right.
   *
   * @param {{ steps: string[], inputs: string[], outputs: string[] }} dataFlow
   * @returns {string} Mermaid diagram string
   */
  buildFileFlow(dataFlow) {
    const steps   = dataFlow?.steps   ?? [];
    const inputs  = dataFlow?.inputs  ?? [];
    const outputs = dataFlow?.outputs ?? [];

    if (!steps.length && !inputs.length && !outputs.length) {
      return 'flowchart LR\n  A(["No data flow information available"])';
    }

    const lines = ['flowchart LR'];
    lines.push('');

    // Input source nodes
    const inputIds = [];
    for (let i = 0; i < inputs.length; i++) {
      const nid   = `in_${i}`;
      const label = safeLabel(inputs[i]);
      lines.push(`  ${nid}["${label}"]`);
      inputIds.push(nid);
    }
    if (inputIds.length) lines.push('');

    // Process nodes — one per step
    const stepIds = [];
    for (let i = 0; i < steps.length; i++) {
      const nid   = `step_${i}`;
      const label = safeLabel(steps[i]);
      lines.push(`  ${nid}(("${label}"))`);
      stepIds.push(nid);
    }
    if (stepIds.length) lines.push('');

    // Output sink nodes
    const outputIds = [];
    for (let i = 0; i < outputs.length; i++) {
      const nid   = `out_${i}`;
      const label = safeLabel(outputs[i]);
      lines.push(`  ${nid}["${label}"]`);
      outputIds.push(nid);
    }
    if (outputIds.length) lines.push('');

    // Edges: each input feeds into first step (or directly to outputs if no steps)
    if (stepIds.length) {
      for (const inId of inputIds) {
        lines.push(`  ${inId} -->|input| ${stepIds[0]}`);
      }
      // Step chain
      for (let i = 0; i < stepIds.length - 1; i++) {
        lines.push(`  ${stepIds[i]} --> ${stepIds[i + 1]}`);
      }
      // Last step feeds outputs
      for (const outId of outputIds) {
        lines.push(`  ${stepIds[stepIds.length - 1]} -->|output| ${outId}`);
      }
    } else {
      // No steps — direct input→output edges
      for (const inId of inputIds) {
        for (const outId of outputIds) {
          lines.push(`  ${inId} --> ${outId}`);
        }
      }
    }

    lines.push('');
    lines.push(this._styleBlock());
    lines.push('');

    // Assign styles
    for (const nid of inputIds)  lines.push(`  class ${nid} externalNode`);
    for (const nid of stepIds)   lines.push(`  class ${nid} processNode`);
    for (const nid of outputIds) lines.push(`  class ${nid} externalNode`);

    return lines.join('\n');
  }

  build(dataFlowAnalysis, graph, dataFlowFacts) {
    const workflows = dataFlowAnalysis?.primaryWorkflows ?? [];

    // Path 1: workflow chains — needs enrichedConnections on at least one workflow
    const hasEnrichedChains = workflows.some(wf => wf.enrichedConnections?.length > 0);
    if (hasEnrichedChains) {
      return this._workflowChainDiagram(dataFlowAnalysis, dataFlowFacts);
    }

    // Path 2: lite chains — workflows with node lists but no enriched verbs.
    // Better than role buckets for apps where static import analysis dominates
    // (Angular/Electron, feature-area flows, component→service→provider chains).
    const hasWorkflowNodes = workflows.some(wf => (wf.steps?.length ?? 0) >= 2);
    if (hasWorkflowNodes) {
      return this._liteChainDiagram(dataFlowAnalysis, dataFlowFacts);
    }

    // Path 3: role-grouped LR — needs a usable graph
    if (graph?.nodes?.length >= 3) {
      return this._roleDiagramLR(dataFlowAnalysis, graph, dataFlowFacts);
    }

    // Path 4: fallback summary
    const entries = dataFlowAnalysis?.entryPoints ?? [];
    if (!workflows.length && !entries.length) {
      return 'flowchart LR\n  A(["No workflow data available"])';
    }
    return this._workflowSummaryDiagram(dataFlowAnalysis);
  }

  // ── Path 1: per-workflow chain diagram ────────────────────────────────────────
  // Each workflow is rendered as a horizontal chain: Entry → Process → DataStore
  // with a labeled edge for each hop (verb from enrichedConnections).

  _workflowChainDiagram(analysis, dataFlowFacts) {
    const workflows = (analysis?.primaryWorkflows ?? [])
      .filter(wf => wf.enrichedConnections?.length > 0)
      .slice(0, MAX_WORKFLOW_CHAINS);

    if (!workflows.length) return this._workflowSummaryDiagram(analysis);

    // Build a facts lookup by path basename for role resolution
    const factsMap = this._buildFactsMap(dataFlowFacts);

    const lines = ['flowchart LR'];
    lines.push('');

    const seenIds = new Set();

    for (let wi = 0; wi < workflows.length; wi++) {
      const wf = workflows[wi];
      const connections = wf.enrichedConnections;

      // Collect all node IDs involved in this workflow's connections
      const nodeIds = [];
      for (const c of connections) {
        if (!nodeIds.includes(c.sourceId)) nodeIds.push(c.sourceId);
        if (!nodeIds.includes(c.targetId)) nodeIds.push(c.targetId);
      }

      // Emit node declarations (only once per unique node across all workflows)
      for (const nodeId of nodeIds) {
        const mid = safeId(nodeId);
        if (seenIds.has(mid)) continue;
        seenIds.add(mid);

        const baseName = nodeId.split('/').pop()?.replace(/\.[^.]+$/, '') ?? nodeId;
        const label = safeLabel(baseName);
        const role = this._resolveNodeRole(nodeId, factsMap);
        lines.push(`  ${nodeShape(role, mid, label)}`);
      }

      // Emit edges with verb labels
      for (const c of connections) {
        const src = safeId(c.sourceId);
        const tgt = safeId(c.targetId);
        const verb = safeVerb(c.verb);
        lines.push(`  ${src} -->|${verb}| ${tgt}`);
      }

      lines.push('');
    }

    lines.push(this._styleBlock());
    lines.push('');
    lines.push(this._classAssignments(workflows, dataFlowFacts));

    return lines.join('\n');
  }

  // ── Path 2: lite chain diagram ────────────────────────────────────────────────
  // Renders discovered workflow node chains without requiring enriched verb data.
  // Each workflow becomes its own left-to-right row of shaped nodes, grouped by
  // a subgraph label so the feature context is visible (e.g. "repository-analysis").
  // Nodes that appear in multiple workflows are deduplicated by ID but re-declared
  // per-chain for clarity — Mermaid handles duplicate declarations gracefully.

  _liteChainDiagram(analysis, dataFlowFacts) {
    const workflows = (analysis?.primaryWorkflows ?? [])
      .filter(wf => (wf.steps?.length ?? 0) >= 2)
      .slice(0, MAX_LITE_CHAINS);

    if (!workflows.length) return this._workflowSummaryDiagram(analysis);

    const factsMap      = this._buildFactsMap(dataFlowFacts);
    const bottleneckSet = new Set(analysis?.bottlenecks ?? []);

    const lines          = ['flowchart LR'];
    const bottleneckMids = [];
    lines.push('');

    for (let wi = 0; wi < workflows.length; wi++) {
      const wf    = workflows[wi];
      const steps = wf.steps ?? [];

      // Workflow label: strip generic suffixes so it reads as a feature name
      const wfLabel = (wf.workflowName ?? `Flow ${wi + 1}`)
        .replace(/ Workflow$/i, '')
        .replace(/ Flow$/i, '');

      lines.push(`  subgraph sg_${wi}["${safeLabel(wfLabel)}"]`);
      lines.push('    direction LR');

      const chainIds = [];

      for (let si = 0; si < steps.length; si++) {
        const step  = steps[si];
        const rawId = step.id ?? step.path ?? step.name ?? `${wi}_${si}`;
        const mid   = `n_${wi}_${safeId(rawId).slice(2)}`;   // unique per workflow slot

        const label = safeLabel(step.name ?? rawId);
        const role  = this._resolveNodeRole(rawId, factsMap);
        lines.push(`    ${nodeShape(role, mid, label)}`);
        chainIds.push({ mid, role, name: step.name ?? '' });

        if (bottleneckSet.has(step.name ?? '')) bottleneckMids.push(mid);
      }

      // Chain edges
      for (let si = 0; si < chainIds.length - 1; si++) {
        lines.push(`    ${chainIds[si].mid} --> ${chainIds[si + 1].mid}`);
      }

      lines.push('  end');
      lines.push('');
    }

    // Cross-workflow bottleneck callout — link bottleneck nodes to a warning node
    if (bottleneckMids.length) {
      const bwarn = 'bw_hotspot';
      lines.push(`  ${bwarn}(["⚠ Shared Bottleneck"])`);
      for (const mid of bottleneckMids.slice(0, 4)) {
        lines.push(`  ${mid} -.-> ${bwarn}`);
      }
      lines.push('');
    }

    lines.push(this._styleBlock());
    lines.push('');

    // Style assignments
    for (let wi = 0; wi < workflows.length; wi++) {
      const wf    = workflows[wi];
      const steps = wf.steps ?? [];
      for (let si = 0; si < steps.length; si++) {
        const step  = steps[si];
        const rawId = step.id ?? step.path ?? step.name ?? `${wi}_${si}`;
        const mid   = `n_${wi}_${safeId(rawId).slice(2)}`;
        if (bottleneckMids.includes(mid)) continue;
        const role  = this._resolveNodeRole(rawId, factsMap);
        lines.push(`  class ${mid} ${this._nodeClass(role, role === 'External')}`);
      }
    }

    for (const mid of bottleneckMids) {
      lines.push(`  class ${mid} bottleneck`);
    }

    if (bottleneckMids.length) {
      lines.push(`  class bw_hotspot bottleneck`);
    }

    return lines.join('\n');
  }

  // ── Path 3 (role-grouped LR) ──────────────────────────────────────────────────
  // Groups nodes by data-flow role, emits role header nodes with file nodes beneath.
  // Edges are labeled with verbs from dataFlowFacts where available.

  _roleDiagramLR(analysis, graph, dataFlowFacts) {
    const nodes = graph.nodes ?? [];
    const edges = graph.edges ?? [];

    const factsMap = this._buildFactsMap(dataFlowFacts);

    // Assign each node to a role — prefer facts-based role, fall back to name patterns
    const nodeRole = new Map();
    for (const node of nodes) {
      const factRole = factsMap.get(node.id) ?? factsMap.get(node.path ?? '');
      const role = factRole
        ? fileRoleToDisplayRole(factRole.fileRole)
        : inferRole(node);
      if (role) nodeRole.set(node.id, role);
    }

    // Promote unclassified nodes that participate in edges → Processing
    for (const node of nodes) {
      if (nodeRole.has(node.id)) continue;
      const hasEdge = edges.some(e => e.source === node.id || e.target === node.id);
      if (hasEdge) nodeRole.set(node.id, 'Processing');
    }

    // Rank by inbound degree for representative selection
    const inbound = new Map();
    for (const e of edges) {
      inbound.set(e.target, (inbound.get(e.target) ?? 0) + 1);
    }

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

    const bottleneckSet = new Set(analysis?.bottlenecks ?? []);
    const lines = ['flowchart LR'];
    lines.push('');

    const roleNodeId = new Map();
    for (const role of activeRoles) {
      const reps  = roleReps.get(role);
      const rid   = `role_${role}`;
      roleNodeId.set(role, rid);

      const totalInRole = [...nodeRole.values()].filter(r => r === role).length;
      const headerLabel = `${role} · ${totalInRole} module${totalInRole !== 1 ? 's' : ''}`;

      // Role headers use a plain rectangle
      lines.push(`  ${rid}["${headerLabel}"]`);

      for (const node of reps) {
        const nid   = safeId(node.id);
        const label = safeLabel(node.name ?? node.id);
        lines.push(`  ${nodeShape(role, nid, label)}`);
        lines.push(`  ${rid} --> ${nid}`);
      }
      lines.push('');
    }

    // Role-to-role flow edges (LR direction)
    for (let i = 0; i < activeRoles.length - 1; i++) {
      const from = roleNodeId.get(activeRoles[i]);
      const to   = roleNodeId.get(activeRoles[i + 1]);
      lines.push(`  ${from} --> ${to}`);
    }

    // Direct cross-role edges between representative nodes — labeled with verbs
    const keptIds = new Set([...roleReps.values()].flat().map(n => n.id));
    let extraEdges = 0;
    for (const edge of edges) {
      if (extraEdges >= 12) break;
      if (!keptIds.has(edge.source) || !keptIds.has(edge.target)) continue;
      if (edge.source === edge.target) continue;
      const srcRole = nodeRole.get(edge.source);
      const tgtRole = nodeRole.get(edge.target);
      if (!srcRole || !tgtRole || srcRole === tgtRole) continue;

      const verb = this._verbFromFacts(edge.source, edge.target, factsMap);
      const src  = safeId(edge.source);
      const tgt  = safeId(edge.target);
      lines.push(verb ? `  ${src} -->|${safeVerb(verb)}| ${tgt}` : `  ${src} --> ${tgt}`);
      extraEdges++;
    }

    lines.push('');
    lines.push(this._styleBlock());
    lines.push('');

    const bottleneckNodeIds = [];
    for (const role of activeRoles) {
      const rid   = roleNodeId.get(role);
      const isExt = role === 'External';
      lines.push(`  class ${rid} ${isExt ? 'externalHeader' : 'roleHeader'}`);
      for (const node of roleReps.get(role)) {
        const nid = safeId(node.id);
        if (bottleneckSet.has(node.name ?? node.id)) {
          bottleneckNodeIds.push(nid);
        } else {
          lines.push(`  class ${nid} ${this._nodeClass(role, isExt)}`);
        }
      }
    }

    for (const nid of bottleneckNodeIds) {
      lines.push(`  class ${nid} bottleneck`);
    }

    return lines.join('\n');
  }

  // ── Path 4 (workflow summary fallback) ───────────────────────────────────────
  // Shows each workflow as a single labeled node; no graph data required.

  _workflowSummaryDiagram(analysis) {
    const workflows = (analysis?.primaryWorkflows ?? []).slice(0, 6);
    const entries   = analysis?.entryPoints ?? [];

    if (!workflows.length && !entries.length) {
      return 'flowchart LR\n  A(["No workflow data available"])';
    }

    const lines = ['flowchart LR'];
    lines.push('');

    if (workflows.length) {
      const riskIcon = r => r === 'High' ? ' ⚠' : r === 'Moderate' ? ' △' : '';
      let prev = null;
      for (let i = 0; i < workflows.length; i++) {
        const wf    = workflows[i];
        const nid   = `wf_${i}`;
        const label = safeLabel(wf.workflowName ?? `Flow ${i + 1}`);
        lines.push(`  ${nid}(("${label}${riskIcon(wf.failureRisk)}"))`);
        if (prev !== null) lines.push(`  wf_${prev} --> ${nid}`);
        prev = i;
      }
    } else {
      for (let i = 0; i < Math.min(entries.length, 5); i++) {
        lines.push(`  ep_${i}["${safeLabel(entries[i])}"]`);
      }
    }

    lines.push('');
    lines.push(this._styleBlock());

    if (workflows.length) {
      for (let i = 0; i < workflows.length; i++) {
        lines.push(`  class wf_${i} processNode`);
      }
    }

    return lines.join('\n');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  _styleBlock() {
    return [
      '  classDef roleHeader    fill:#065f46,stroke:#047857,color:#fff,font-weight:bold',
      '  classDef externalHeader fill:#374151,stroke:#4b5563,color:#d1d5db,font-weight:bold',
      '  classDef processNode   fill:#0d9488,stroke:#0f766e,color:#fff',
      '  classDef storeNode     fill:#0369a1,stroke:#0284c7,color:#fff',
      '  classDef externalNode  fill:#1f2937,stroke:#374151,color:#9ca3af',
      '  classDef bottleneck    fill:#dc2626,stroke:#b91c1c,color:#fff,font-weight:bold',
    ].join('\n');
  }

  _nodeClass(role, isExternal) {
    if (isExternal) return 'externalNode';
    if (role === 'Processing') return 'processNode';
    if (role === 'Data')       return 'storeNode';
    return 'externalNode';
  }

  /**
   * Build a lookup map from node ID / path → DataFlowFact for fast lookups.
   * Keys include both the full path and the basename for fuzzy matching.
   */
  _buildFactsMap(dataFlowFacts) {
    const map = new Map();
    if (!dataFlowFacts?.length) return map;

    for (const fact of dataFlowFacts) {
      map.set(fact.path, fact);
      // Also index by basename so safeId-normalized IDs can still find their fact
      const base = fact.path.split('/').pop() ?? fact.path;
      if (!map.has(base)) map.set(base, fact);
    }

    return map;
  }

  /**
   * Resolve the display role of a node using the dataFlowFacts map.
   * Falls back to name-pattern inference.
   */
  _resolveNodeRole(nodeId, factsMap) {
    const fact = factsMap.get(nodeId)
      ?? factsMap.get((nodeId.split('/').pop() ?? ''));

    if (fact) {
      return fileRoleToDisplayRole(fact.fileRole) ?? 'Entry';
    }

    // Minimal name-pattern fallback
    const name = (nodeId.split('/').pop() ?? nodeId).replace(/\.[^.]+$/, '').toLowerCase();
    if (SERVICE_PATTERNS.some(p => p.test(name))) return 'Processing';
    if (REPO_PATTERNS.some(p => p.test(name)))    return 'Data';
    return 'Entry';
  }

  /**
   * Look up the verb for a source→target edge using the facts map.
   * Returns null when no fact is found (caller emits an unlabeled edge).
   */
  _verbFromFacts(sourceId, targetId, factsMap) {
    const fact = factsMap.get(sourceId)
      ?? factsMap.get((sourceId.split('/').pop() ?? ''));
    if (!fact) return null;

    const targetBase = (targetId.split('/').pop() ?? targetId).replace(/\.[^.]+$/, '');

    for (const [importPath, verb] of Object.entries(fact.interactionVerbs)) {
      const importBase = importPath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? '';
      if (importBase === targetBase || importPath.endsWith(targetId) || targetId.endsWith(importPath)) {
        return verb;
      }
    }

    return null;
  }

  /**
   * Emit class assignments for all nodes that appear in workflow chains.
   * Called at the end of _workflowChainDiagram.
   */
  _classAssignments(workflows, dataFlowFacts) {
    const factsMap   = this._buildFactsMap(dataFlowFacts);
    const seen       = new Set();
    const lines      = [];

    for (const wf of workflows) {
      for (const c of (wf.enrichedConnections ?? [])) {
        for (const nodeId of [c.sourceId, c.targetId]) {
          const mid = safeId(nodeId);
          if (seen.has(mid)) continue;
          seen.add(mid);

          const role      = this._resolveNodeRole(nodeId, factsMap);
          const cssClass  = role === 'Processing' ? 'processNode'
                          : role === 'Data'       ? 'storeNode'
                          : 'externalNode';
          lines.push(`  class ${mid} ${cssClass}`);
        }
      }
    }

    return lines.join('\n');
  }
}

module.exports = { DataFlowDiagramEngine };
