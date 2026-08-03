'use strict';

/**
 * FolderWorkflowsNarrativeEngine — produces specific 2-3 sentence descriptions
 * per workflow, grounded in the actual file chain, verbs, bottlenecks, and risk.
 *
 * Input shape per workflow:
 *   {
 *     name:                string,
 *     entryPoint:          string,       // first node name
 *     stepCount:           number,
 *     bottleneckNodes:     string[],
 *     failureRisk:         'Low' | 'Moderate' | 'High',
 *     flowPath:            string[],     // ordered node names
 *     enrichedConnections: Array<{ sourceId, targetId, verb }> | undefined,
 *     steps:               Array<{ id, name, type, path }> | undefined,
 *   }
 *
 * Output: string[] — one description per workflow, same order as input.
 */

// ── Helpers ────────────────────────────────────────────────────────────────────

function _humanise(name) {
  return name
    .replace(/\s*workflow$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .trim();
}

function _humaniseNode(name) {
  return (name ?? '')
    .replace(/\.[^.]+$/, '')           // strip extension
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .trim();
}

/**
 * Build an ordered array of { name, verb } pairs from the workflow.
 * `verb` is the edge verb *leaving* that node toward the next one.
 * The last node has no verb (it's the terminal step).
 *
 * Falls back to flowPath alone (all verbs = 'calls') when enrichedConnections
 * are absent or IDs cannot be resolved.
 */
function _buildChain(wf) {
  const path = wf.flowPath ?? [];
  if (path.length === 0) return [];

  const connections = wf.enrichedConnections ?? [];
  const steps       = wf.steps ?? [];

  // Build id→name map from steps so we can resolve connection node IDs
  const idToName = new Map(steps.map(s => [s.id, s.name]));

  // Build a name→verb map: for each connection, map sourceName → verb
  const nameToVerb = new Map();
  for (const conn of connections) {
    const srcName = idToName.get(conn.sourceId) ?? conn.sourceId;
    if (srcName && conn.verb && conn.verb !== 'calls') {
      nameToVerb.set(srcName, conn.verb);
    }
  }

  return path.map((nodeName, i) => ({
    name: _humaniseNode(nodeName),
    verb: i < path.length - 1 ? (nameToVerb.get(nodeName) ?? 'calls') : null,
  }));
}

/**
 * Render chain as a readable inline string:
 * "AuthController → calls → AuthService → reads from → UserRepository"
 * Caps at 5 nodes for readability; appends "→ …" if truncated.
 */
function _renderChain(chain) {
  const MAX = 5;
  const truncated = chain.length > MAX;
  const visible = chain.slice(0, MAX);
  const parts = [];
  for (let i = 0; i < visible.length; i++) {
    parts.push(visible[i].name);
    if (visible[i].verb) parts.push(`→ ${visible[i].verb} →`);
  }
  if (truncated) parts.push('→ …');
  return parts.join(' ');
}

/**
 * Describe what the chain *does* in plain language based on the node types
 * at each end and the overall character of the path.
 */
function _chainPurposeSentence(chain, name) {
  if (chain.length === 0) return `The ${name} workflow is a key operational flow in this codebase.`;

  const first  = chain[0].name.toLowerCase();
  const last   = chain[chain.length - 1].name.toLowerCase();
  const allNames = chain.map(s => s.name.toLowerCase()).join(' ');
  const allVerbs = chain.map(s => s.verb ?? '').join(' ').toLowerCase();

  // Auth / access control
  if (/auth|login|session|token|guard|credential|permission/.test(allNames)) {
    return `The ${name} workflow enforces authentication and access control, running from ${chain[0].name} through to ${chain[chain.length - 1].name}.`;
  }

  // Data persistence / repository chain
  if (/repositor|database|stor|persist|dao/.test(last) || /read|fetch|query|persist/.test(allVerbs)) {
    return `The ${name} workflow coordinates a data operation — starting at ${chain[0].name} and reaching ${chain[chain.length - 1].name} for ${/read|fetch|query/.test(allVerbs) ? 'retrieval' : 'persistence'}.`;
  }

  // Event / messaging
  if (/event|emit|publish|subscri|notify|queue|message/.test(allNames)) {
    return `The ${name} workflow propagates events from ${chain[0].name} to downstream consumers, decoupling the source of the change from its effects.`;
  }

  // HTTP / API entry
  if (/controller|handler|endpoint|router|api/.test(first)) {
    return `The ${name} workflow handles an inbound request at ${chain[0].name}, delegating through ${chain.length - 1} stage${chain.length - 1 === 1 ? '' : 's'} before producing a response.`;
  }

  // UI / component rendering
  if (/component|page|view|screen/.test(first)) {
    return `The ${name} workflow drives a rendering path from ${chain[0].name}, pulling state and data through ${chain.length - 1} dependency${chain.length - 1 === 1 ? '' : 'ies'} to compose the final output.`;
  }

  // Generic with chain detail
  return `The ${name} workflow runs from ${chain[0].name} through ${chain.length - 1} step${chain.length - 1 === 1 ? '' : 's'}, terminating at ${chain[chain.length - 1].name}.`;
}

function _bottleneckSentence(bottleneckNodes, chain) {
  if (!bottleneckNodes?.length) return null;
  const listed = bottleneckNodes.slice(0, 2).map(_humaniseNode).join(' and ');
  const inChain = chain.some(s => bottleneckNodes.includes(s.name.replace(/ /g, '')));
  return `${listed} ${bottleneckNodes.length > 1 ? 'are' : 'is'} a bottleneck${inChain ? ' in this chain' : ''} — changes here may ripple across multiple dependent workflows.`;
}

function _riskAndComplexitySentence(failureRisk, stepCount, couplingRatio) {
  const parts = [];

  if (failureRisk === 'High') {
    parts.push('high failure risk');
  } else if (failureRisk === 'Moderate') {
    parts.push('moderate failure risk');
  }

  if (stepCount >= 6) {
    parts.push(`${stepCount} handoff points where data shape and error handling must align`);
  } else if (stepCount >= 4 && failureRisk !== 'Low') {
    parts.push(`${stepCount} stages that each need to handle errors correctly`);
  }

  if (couplingRatio > 0.6 && failureRisk !== 'Low') {
    parts.push('high coupling in this module amplifies the blast radius of any failure');
  }

  if (parts.length === 0) return null;
  return `Watch this path — it carries ${parts.join(', and ')}.`;
}

// ── Engine ─────────────────────────────────────────────────────────────────────

class FolderWorkflowsNarrativeEngine {

  /**
   * @param {{ workflows: Array, architecturePatterns: string[], fileCount: number, couplingRatio: number }} opts
   * @returns {string[]}
   */
  build({ workflows = [], architecturePatterns = [], fileCount = 0, couplingRatio = 0 } = {}) {
    const ctx = { architecturePatterns, fileCount, couplingRatio };
    return workflows.map(wf => this._buildDescription(wf, ctx));
  }

  _buildDescription(wf, ctx) {
    const rawName = typeof wf === 'string' ? wf : (wf.name ?? wf.workflowName ?? 'Unnamed Workflow');
    const name    = _humanise(rawName);

    const profile = typeof wf === 'object' ? wf : {
      entryPoint:          null,
      stepCount:           0,
      bottleneckNodes:     [],
      failureRisk:         'Low',
      flowPath:            [],
      enrichedConnections: [],
      steps:               [],
    };

    const chain = _buildChain(profile);
    const sentences = [];

    // Sentence 1 — what the chain does (grounded in actual node names)
    sentences.push(_chainPurposeSentence(chain, name));

    // Sentence 2 — the actual chain path (only when there are 2+ nodes)
    if (chain.length >= 2) {
      sentences.push(`Chain: ${_renderChain(chain)}.`);
    }

    // Sentence 3 — bottleneck or risk/complexity (only when noteworthy)
    const bottleneck = _bottleneckSentence(profile.bottleneckNodes, chain);
    if (bottleneck) {
      sentences.push(bottleneck);
    } else {
      const riskSentence = _riskAndComplexitySentence(profile.failureRisk, profile.stepCount, ctx.couplingRatio);
      if (riskSentence) sentences.push(riskSentence);
    }

    return sentences.join(' ');
  }
}

module.exports = { FolderWorkflowsNarrativeEngine };
