'use strict';

/**
 * DataFlowDiagramEngine — produces a Mermaid flowchart LR string
 * representing the primary data flow workflows of a codebase.
 *
 * Input: DataFlowAIAnalysis + DependencyGraph
 * Output: string — valid Mermaid syntax, always renderable
 */

const MAX_WORKFLOWS   = 5;
const MAX_NODES_PER_WF = 5;

function safeId(raw) {
  return ('n_' + raw).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
}

function shortName(name) {
  return (name ?? '').replace(/\.(ts|js|tsx|jsx|vue|cs|py|java|kt)$/, '').slice(0, 26);
}

// Risk badge suffix for workflow label
function riskSuffix(risk) {
  if (risk === 'High')     return ' ⚠';
  if (risk === 'Moderate') return ' △';
  return '';
}

// Node shape varies by role hint from name
function nodeShape(name) {
  const low = (name ?? '').toLowerCase();
  if (/controller|page|component|handler|endpoint/.test(low)) return ['[', ']'];      // rect
  if (/service|manager|engine|processor/.test(low))           return ['(', ')'];      // rounded
  if (/repository|store|storage|cache|database|db/.test(low)) return ['[(', ')]'];    // cylinder
  if (/client|gateway|provider|adapter|external/.test(low))   return ['([', '])'];    // stadium
  return ['[', ']'];
}

class DataFlowDiagramEngine {

  build(dataFlowAnalysis, graph) {
    const workflows = dataFlowAnalysis?.primaryWorkflows ?? [];
    const entries   = dataFlowAnalysis?.entryPoints       ?? [];
    const externals = dataFlowAnalysis?.externalDependencies ?? [];

    if (!workflows.length && !entries.length) {
      return this._emptyDiagram();
    }

    if (workflows.length) {
      return this._workflowDiagram(workflows, graph, externals);
    }

    return this._entryPointDiagram(entries, externals, graph);
  }

  // ── Primary: workflow chain diagram ─────────────────────────────────────────

  _workflowDiagram(workflows, graph, externals) {
    const lines     = ['flowchart LR'];
    const extSet    = new Set((externals ?? []).map(e => (e ?? '').toLowerCase()));
    const edgeSet   = new Set(); // deduplicate edges across workflows

    const limited = workflows.slice(0, MAX_WORKFLOWS);

    for (let wi = 0; wi < limited.length; wi++) {
      const wf      = limited[wi];
      const wfLabel = (wf.workflowName ?? `Workflow ${wi + 1}`).slice(0, 32);
      const suffix  = riskSuffix(wf.failureRisk);
      const sgId    = `wf${wi}`;

      // Build the node chain for this workflow
      // entryPoint is the first node; bottleneckNodes are notable stops
      const chainNames = this._buildChain(wf, graph);
      if (chainNames.length < 2) continue;

      lines.push(`  subgraph ${sgId}["${wfLabel}${suffix}"]`);

      for (const name of chainNames) {
        const id     = safeId(`${wi}_${name}`);
        const short  = shortName(name);
        const [l, r] = nodeShape(name);
        const isExt  = extSet.has(name.toLowerCase());
        if (isExt) {
          lines.push(`    ${id}(["${short}"])`);
        } else {
          lines.push(`    ${id}${l}"${short}"${r}`);
        }
      }

      // Chain edges within this workflow
      for (let i = 0; i < chainNames.length - 1; i++) {
        const fromId = safeId(`${wi}_${chainNames[i]}`);
        const toId   = safeId(`${wi}_${chainNames[i + 1]}`);
        const key    = `${fromId}-->${toId}`;
        if (!edgeSet.has(key)) {
          lines.push(`    ${fromId} --> ${toId}`);
          edgeSet.add(key);
        }
      }

      lines.push('  end');
    }

    // Style bottleneck nodes red across all workflows
    const bottleneckIds = [];
    for (let wi = 0; wi < limited.length; wi++) {
      for (const bn of (limited[wi].bottleneckNodes ?? [])) {
        bottleneckIds.push(safeId(`${wi}_${bn}`));
      }
    }
    if (bottleneckIds.length) {
      lines.push('  classDef bottleneck fill:#dc2626,stroke:#b91c1c,color:#fff');
      for (const id of bottleneckIds) {
        lines.push(`  class ${id} bottleneck`);
      }
    }

    return lines.join('\n');
  }

  // ── Build a node-name chain for a workflow ───────────────────────────────────

  _buildChain(wf, graph) {
    const chain = [];

    // Start with the known entry point
    if (wf.entryPoint) chain.push(wf.entryPoint);

    // If we have the dependency graph, trace forward from entry up to cap
    if (graph?.edges?.length && wf.entryPoint) {
      const edgeMap = new Map();
      for (const e of graph.edges) {
        const list = edgeMap.get(e.source) ?? [];
        list.push(e.target);
        edgeMap.set(e.source, list);
      }

      // Find the node id matching the entry point name
      const entryNode = graph.nodes?.find(n =>
        n.name === wf.entryPoint || n.id === wf.entryPoint
      );

      if (entryNode) {
        const visited = new Set([entryNode.id]);
        let current   = entryNode.id;

        for (let step = 0; step < MAX_NODES_PER_WF - 1; step++) {
          const targets = edgeMap.get(current) ?? [];
          // Prefer bottleneck nodes first, then any unvisited
          const next = targets.find(t => !visited.has(t) && (wf.bottleneckNodes ?? []).some(bn => {
            const node = graph.nodes?.find(n => n.id === t);
            return node?.name === bn;
          })) ?? targets.find(t => !visited.has(t));

          if (!next) break;
          const nextNode = graph.nodes?.find(n => n.id === next);
          if (nextNode) {
            chain.push(nextNode.name ?? nextNode.id);
            visited.add(next);
            current = next;
          }
        }
      }
    }

    // Supplement with bottleneck nodes not already in chain
    for (const bn of (wf.bottleneckNodes ?? [])) {
      if (!chain.includes(bn)) chain.push(bn);
    }

    return [...new Set(chain)].slice(0, MAX_NODES_PER_WF);
  }

  // ── Fallback: entry points + externals only ──────────────────────────────────

  _entryPointDiagram(entries, externals, graph) {
    const lines = ['flowchart LR'];

    for (const ep of entries.slice(0, 8)) {
      const id    = safeId(ep);
      const short = shortName(ep);
      lines.push(`  ${id}["${short}"]`);
    }

    for (const ext of (externals ?? []).slice(0, 4)) {
      const id    = safeId(`ext_${ext}`);
      const short = shortName(ext);
      lines.push(`  ${id}(["${short}"])`);
    }

    // Draw edges from graph where source is an entry point
    if (graph?.edges?.length) {
      const entrySet = new Set(entries);
      for (const edge of graph.edges.slice(0, 20)) {
        const srcNode = graph.nodes?.find(n => n.id === edge.source);
        const tgtNode = graph.nodes?.find(n => n.id === edge.target);
        if (srcNode && entrySet.has(srcNode.name)) {
          lines.push(`  ${safeId(srcNode.name)} --> ${safeId(tgtNode?.name ?? edge.target)}`);
        }
      }
    }

    return lines.join('\n');
  }

  _emptyDiagram() {
    return 'flowchart LR\n  A["No workflow data available"]';
  }
}

module.exports = { DataFlowDiagramEngine };
