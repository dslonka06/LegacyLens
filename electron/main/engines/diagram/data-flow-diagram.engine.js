'use strict';

/**
 * DataFlowDiagramEngine — produces a Mermaid flowchart LR string
 * showing how data moves through the codebase at runtime.
 *
 * Answers: "What is the overall workflow of this repository?"
 * Contrast with ArchitectureDiagramEngine which answers: "How are the pieces structured?"
 *
 * Rendering paths, in priority order:
 *   1. Merged flow  — when primaryWorkflows have node lists (steps or enrichedConnections).
 *      All workflows are merged into a single unified graph: each unique file appears once,
 *      shared nodes visually connect multiple paths. Verb labels from enrichedConnections
 *      where available. This reveals hub services, shared repositories, and the true shape
 *      of the codebase's data flow rather than isolated per-workflow rows.
 *   2. Role-grouped LR  — when a dependency graph is available but no workflow nodes.
 *      Groups nodes by data-flow role (Entry / Processing / Data / External), LR direction.
 *   3. Workflow summary — fallback when no graph. Shows workflow cards as named nodes.
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

const MAX_REPS_PER_ROLE   = 4;
// Hard cap on unique nodes in the merged flow diagram — keeps Mermaid readable
const MAX_MERGED_NODES    = 24;
// Maximum workflows fed into the merged diagram
const MAX_MERGED_WORKFLOWS = 8;

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

    // Path 1: merged flow — all workflows unified into one graph.
    // Fires whenever any workflow has node data (steps or enrichedConnections).
    // Shared nodes appear once; multiple paths flow through them naturally.
    const hasWorkflowNodes = workflows.some(
      wf => (wf.steps?.length ?? 0) >= 2 || (wf.enrichedConnections?.length ?? 0) > 0,
    );
    if (hasWorkflowNodes) {
      return this._mergedFlowDiagram(dataFlowAnalysis, dataFlowFacts);
    }

    // Path 2: role-grouped LR — needs a usable graph but no workflow nodes
    if (graph?.nodes?.length >= 3) {
      return this._roleDiagramLR(dataFlowAnalysis, graph, dataFlowFacts);
    }

    // Path 3: fallback summary
    const entries = dataFlowAnalysis?.entryPoints ?? [];
    if (!workflows.length && !entries.length) {
      return 'flowchart LR\n  A(["No workflow data available"])';
    }
    return this._workflowSummaryDiagram(dataFlowAnalysis);
  }

  // ── Path 1: merged flow diagram ──────────────────────────────────────────────
  // All workflows are unified into a single graph. Each unique file appears once —
  // shared services, repositories, and clients that appear in multiple workflows
  // become visible hubs with multiple incoming/outgoing edges. This reveals the
  // true topology of the codebase's data flow rather than isolated per-workflow rows.
  //
  // Node identity: canonical ID derived from step.id ?? step.path ?? step.name.
  // Edge identity: source→target pair; duplicate edges (same file pair across
  // workflows) are deduplicated so the diagram stays clean.
  // Verb labels: taken from enrichedConnections when available; unlabeled otherwise.
  // Node cap: MAX_MERGED_NODES unique nodes — workflows sorted by step count
  // (longest first) to prioritise the most structurally significant paths.

  _mergedFlowDiagram(analysis, dataFlowFacts) {
    const allWorkflows = (analysis?.primaryWorkflows ?? [])
      .filter(wf => (wf.steps?.length ?? 0) >= 2 || (wf.enrichedConnections?.length ?? 0) > 0)
      .sort((a, b) => (b.stepCount ?? b.steps?.length ?? 0) - (a.stepCount ?? a.steps?.length ?? 0))
      .slice(0, MAX_MERGED_WORKFLOWS);

    if (!allWorkflows.length) return this._workflowSummaryDiagram(analysis);

    const factsMap      = this._buildFactsMap(dataFlowFacts);
    const bottleneckSet = new Set(analysis?.bottlenecks ?? []);

    // ── Pass 1: collect all unique nodes across all workflows ─────────────────
    // Map from canonical node ID → { label, role, isBn }
    // Canonical ID: step.id > step.path > step.name (for steps-based workflows)
    //               connection sourceId/targetId (for enrichedConnections-based)
    const nodeMap  = new Map(); // canonicalId → { label, role, isBn }
    const edgeSet  = new Set(); // "srcMid→tgtMid" dedup key
    const edgeList = [];        // { srcMid, tgtMid, verb? }

    const registerNode = (canonicalId, nameHint) => {
      const mid = safeId(canonicalId);
      if (!nodeMap.has(mid)) {
        const label = safeLabel(nameHint ?? canonicalId.split('/').pop()?.replace(/\.[^.]+$/, '') ?? canonicalId);
        const role  = this._resolveNodeRole(canonicalId, factsMap);
        const isBn  = bottleneckSet.has(nameHint ?? '') || bottleneckSet.has(canonicalId.split('/').pop()?.replace(/\.[^.]+$/, '') ?? '');
        nodeMap.set(mid, { label, role, isBn });
      }
      return mid;
    };

    for (const wf of allWorkflows) {
      // Stop adding nodes once we hit the cap — still process edges between existing nodes
      const hasEnriched = (wf.enrichedConnections?.length ?? 0) > 0;

      if (hasEnriched) {
        // Build id→name from steps for label resolution
        const idToName = new Map((wf.steps ?? []).map(s => [s.id, s.name]));

        for (const c of wf.enrichedConnections) {
          if (nodeMap.size < MAX_MERGED_NODES) {
            registerNode(c.sourceId, idToName.get(c.sourceId));
          }
          if (nodeMap.size < MAX_MERGED_NODES) {
            registerNode(c.targetId, idToName.get(c.targetId));
          }

          const srcMid = safeId(c.sourceId);
          const tgtMid = safeId(c.targetId);
          if (!nodeMap.has(srcMid) || !nodeMap.has(tgtMid)) continue;

          const edgeKey = `${srcMid}→${tgtMid}`;
          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey);
            edgeList.push({ srcMid, tgtMid, verb: c.verb && c.verb !== 'calls' ? c.verb : null });
          }
        }
      } else {
        // Steps-only: sequential edges, no verb data
        const steps = wf.steps ?? [];
        const mids  = [];

        for (const step of steps) {
          const canonId = step.id ?? step.path ?? step.name ?? '';
          if (canonId && nodeMap.size < MAX_MERGED_NODES) {
            mids.push(registerNode(canonId, step.name));
          } else if (canonId) {
            mids.push(safeId(canonId));
          }
        }

        for (let i = 0; i < mids.length - 1; i++) {
          const srcMid = mids[i];
          const tgtMid = mids[i + 1];
          if (!nodeMap.has(srcMid) || !nodeMap.has(tgtMid)) continue;

          const edgeKey = `${srcMid}→${tgtMid}`;
          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey);
            edgeList.push({ srcMid, tgtMid, verb: null });
          }
        }
      }
    }

    if (nodeMap.size === 0) return this._workflowSummaryDiagram(analysis);

    // ── Pass 2: emit Mermaid ──────────────────────────────────────────────────
    const lines = ['flowchart LR'];
    lines.push('');

    // Node declarations
    for (const [mid, { label, role }] of nodeMap) {
      lines.push(`  ${nodeShape(role, mid, label)}`);
    }
    lines.push('');

    // Edge declarations
    for (const { srcMid, tgtMid, verb } of edgeList) {
      if (verb) {
        lines.push(`  ${srcMid} -->|${safeVerb(verb)}| ${tgtMid}`);
      } else {
        lines.push(`  ${srcMid} --> ${tgtMid}`);
      }
    }
    lines.push('');

    lines.push(this._styleBlock());
    lines.push('');

    // Class assignments
    for (const [mid, { role, isBn }] of nodeMap) {
      if (isBn) {
        lines.push(`  class ${mid} bottleneck`);
      } else {
        lines.push(`  class ${mid} ${this._nodeClass(role, role === 'External')}`);
      }
    }

    return lines.join('\n');
  }

  // ── Path 2 (role-grouped LR) ──────────────────────────────────────────────────
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

  // ── Path 3 (workflow summary fallback) ───────────────────────────────────────
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

}

module.exports = { DataFlowDiagramEngine };
