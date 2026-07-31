/**
 * FolderWorkflowsNarrativeEngine — produces a short description for each
 * folder-scope workflow string, contextualised by architecture patterns,
 * folder size, and coupling density.
 *
 * Input shape:
 *   {
 *     workflows:            string[],
 *     architecturePatterns: string[],
 *     fileCount:            number,
 *     couplingRatio:        number,   // 0-1; fraction of files that are tightly coupled
 *   }
 *
 * Output: string[] — one description per workflow, same order as input.
 */

const WORKFLOW_CLUSTERS = [
  {
    key: 'request-response',
    keywords: ['request', 'response', 'http', 'api call', 'inbound', 'incoming', 'endpoint'],
    describe: () => `Handles the full lifecycle of an inbound request — from initial receipt through validation, processing, and response formation.`,
    context: (d) => _architectureContext(d, 'layered') ?? _sizeContext(d),
  },
  {
    key: 'data-flow',
    keywords: ['data flow', 'transform', 'pipeline', 'process data', 'ingest', 'parse'],
    describe: () => `Moves data through a series of transformation steps, converting input into the shape that downstream consumers need.`,
    context: (d) => _couplingContext(d) ?? _sizeContext(d),
  },
  {
    key: 'crud',
    keywords: ['create', 'read', 'update', 'delete', 'fetch', 'save', 'store', 'retriev', 'persist'],
    describe: () => `Manages the full create-read-update-delete lifecycle for a resource, coordinating between business logic and the persistence layer.`,
    context: (d) => _architectureContext(d, 'repository') ?? _couplingContext(d),
  },
  {
    key: 'auth',
    keywords: ['auth', 'login', 'logout', 'session', 'token', 'permission', 'access control'],
    describe: () => `Enforces authentication and authorisation gates — verifying identity and permissions before allowing access to protected resources.`,
    context: (d) => _architectureContext(d, 'layered') ?? _sizeContext(d),
  },
  {
    key: 'event',
    keywords: ['event', 'emit', 'publish', 'subscribe', 'notify', 'broadcast', 'message'],
    describe: () => `Propagates events from producers to interested consumers, decoupling the origin of a change from its downstream effects.`,
    context: (d) => _couplingContext(d) ?? _sizeContext(d),
  },
  {
    key: 'validation',
    keywords: ['validat', 'sanitiz', 'check', 'enforce rule', 'constraint'],
    describe: () => `Validates inputs against expected shapes and business rules before allowing them to reach processing or persistence stages.`,
    context: () => null,
  },
  {
    key: 'error-handling',
    keywords: ['error', 'exception', 'failure', 'fallback', 'recover', 'retry'],
    describe: () => `Intercepts failures at each stage, deciding whether to retry, fall back, or surface an error response to the caller.`,
    context: (d) => _couplingContext(d),
  },
  {
    key: 'lifecycle',
    keywords: ['lifecycle', 'init', 'start', 'boot', 'shutdown', 'teardown', 'setup'],
    describe: () => `Manages component lifecycle — initialising resources at startup and cleaning them up gracefully on shutdown.`,
    context: (d) => _sizeContext(d),
  },
  {
    key: 'rendering',
    keywords: ['render', 'display', 'draw', 'compose', 'mount', 'update view', 'ui'],
    describe: () => `Drives the rendering cycle — translating application state into visual output and handling user-triggered re-renders.`,
    context: () => null,
  },
  {
    key: 'config',
    keywords: ['config', 'setting', 'environment', 'load config', 'bootstrap'],
    describe: () => `Loads and applies configuration at startup, resolving environment-specific values before the rest of the application runs.`,
    context: (d) => _sizeContext(d),
  },
  {
    key: 'batch',
    keywords: ['batch', 'bulk', 'schedule', 'job', 'worker', 'queue', 'background'],
    describe: () => `Processes items in bulk or on a schedule, isolating heavy work from the request path to avoid latency spikes.`,
    context: (d) => _couplingContext(d) ?? _sizeContext(d),
  },
  {
    key: 'testing',
    keywords: ['test', 'assert', 'spec', 'scenario', 'behaviour'],
    describe: () => `Exercises application behaviour through automated assertions, verifying correctness across a range of scenarios.`,
    context: () => null,
  },
];

function _architectureContext(d, hint) {
  if (!d.architecturePatterns || d.architecturePatterns.length === 0) return null;
  const lower = d.architecturePatterns.map(p => p.toLowerCase());
  if (hint === 'layered' && lower.some(p => p.includes('layer') || p.includes('mvc') || p.includes('clean'))) {
    return `The layered architecture of this folder makes the stages of this workflow explicit and testable in isolation.`;
  }
  if (hint === 'repository' && lower.some(p => p.includes('repository') || p.includes('service'))) {
    return `The service-repository split in this folder means data access is cleanly separated from the business logic that drives it.`;
  }
  return null;
}

function _couplingContext(d) {
  if (d.couplingRatio == null) return null;
  if (d.couplingRatio > 0.6) {
    return `High coupling across this folder means changes to any step in this workflow may have non-obvious downstream effects.`;
  }
  return null;
}

function _sizeContext(d) {
  if (d.fileCount == null) return null;
  if (d.fileCount > 20) {
    return `Across ${d.fileCount} files this workflow spans multiple layers — tracing it end-to-end requires following collaborations between several components.`;
  }
  return null;
}

class FolderWorkflowsNarrativeEngine {

  build(data) {
    const {
      workflows            = [],
      architecturePatterns = [],
      fileCount            = 0,
      couplingRatio        = 0,
    } = data;

    const ctx = { architecturePatterns, fileCount, couplingRatio };
    return workflows.map(wf => this._buildDescription(wf, ctx));
  }

  _buildDescription(workflow, ctx) {
    const lower = workflow.toLowerCase();
    const cluster = WORKFLOW_CLUSTERS.find(c => c.keywords.some(kw => lower.includes(kw)));

    const sentences = [];

    if (cluster) {
      sentences.push(cluster.describe());
      const ctxSentence = cluster.context(ctx);
      if (ctxSentence) sentences.push(ctxSentence);
    } else {
      // Generic fallback — use the workflow text itself as the anchor
      const cleaned = workflow.endsWith('.') ? workflow.slice(0, -1) : workflow;
      sentences.push(`${cleaned} is a key operational flow within this folder.`);
      const ctxSentence = _couplingContext(ctx) ?? _sizeContext(ctx);
      if (ctxSentence) sentences.push(ctxSentence);
    }

    return sentences.join(' ');
  }
}

module.exports = { FolderWorkflowsNarrativeEngine };
