'use strict';

/**
 * FolderWorkflowsNarrativeEngine — produces a specific description for each
 * workflow, using the workflow name, entry point, step count, bottlenecks, and
 * failure risk alongside architecture and coupling context.
 *
 * Input shape (workflows array):
 *   Array<{
 *     name:             string,
 *     entryPoint:       string,
 *     stepCount:        number,
 *     bottleneckNodes:  string[],
 *     failureRisk:      'Low' | 'Moderate' | 'High',
 *   }>
 *
 * Input shape (context):
 *   {
 *     architecturePatterns: string[],
 *     fileCount:            number,
 *     couplingRatio:        number,
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

function _entryLabel(entryPoint) {
  if (!entryPoint) return null;
  return entryPoint
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .toLowerCase()
    .trim();
}

function _riskSentence(failureRisk, name) {
  if (failureRisk === 'High')     return `This workflow has a high failure risk — problems here are likely to have broad impact across the ${name} path.`;
  if (failureRisk === 'Moderate') return `This workflow carries moderate failure risk — edge cases and error paths should be tested carefully.`;
  return null;
}

function _bottleneckSentence(bottleneckNodes) {
  if (!bottleneckNodes || bottleneckNodes.length === 0) return null;
  const listed = bottleneckNodes.slice(0, 2).join(' and ');
  return bottleneckNodes.length > 1
    ? `${listed} are bottleneck nodes — changes to either may ripple across this workflow.`
    : `${listed} is a bottleneck node — it is the most load-bearing component in this workflow.`;
}

function _stepCountSentence(stepCount) {
  if (stepCount >= 6) return `At ${stepCount} steps, this is a complex workflow where each stage must hand off correctly to the next.`;
  if (stepCount >= 4) return `The ${stepCount}-step chain means there are several handoff points where data shape and error handling must align.`;
  if (stepCount >= 2) return `The ${stepCount}-step structure keeps this workflow focused, reducing the surface area for bugs.`;
  return null;
}

function _architectureContext(ctx, hint) {
  if (!ctx.architecturePatterns || ctx.architecturePatterns.length === 0) return null;
  const lower = ctx.architecturePatterns.map(p => p.toLowerCase());
  if (hint === 'layered' && lower.some(p => p.includes('layer') || p.includes('mvc') || p.includes('clean'))) {
    return `The layered architecture makes the stages of this workflow explicit and testable in isolation.`;
  }
  if (hint === 'repository' && lower.some(p => p.includes('repository') || p.includes('service'))) {
    return `The service-repository split cleanly separates the data access from the business logic driving this workflow.`;
  }
  return null;
}

function _couplingContext(ctx) {
  if (ctx.couplingRatio == null) return null;
  if (ctx.couplingRatio > 0.6) {
    return `High coupling in this folder means changes to any step in this workflow may have non-obvious downstream effects.`;
  }
  return null;
}

// ── Clusters ───────────────────────────────────────────────────────────────────

const WORKFLOW_CLUSTERS = [
  {
    key: 'request-response',
    keywords: ['request', 'response', 'http', 'api', 'inbound', 'incoming', 'endpoint', 'controller', 'handler', 'route'],
    describe(wf, name, ctx) {
      const entry = _entryLabel(wf.entryPoint);
      const main = entry
        ? `The ${name} workflow handles the full lifecycle of an inbound request, starting at ${entry} — from initial receipt through validation, processing, and response formation.`
        : `The ${name} workflow handles the full lifecycle of an inbound request — from initial receipt through validation, processing, and response formation.`;
      return [
        main,
        _stepCountSentence(wf.stepCount),
        _bottleneckSentence(wf.bottleneckNodes),
        _architectureContext(ctx, 'layered') ?? _couplingContext(ctx),
        _riskSentence(wf.failureRisk, name),
      ].filter(Boolean).join(' ');
    },
  },
  {
    key: 'data-flow',
    keywords: ['data flow', 'transform', 'pipeline', 'ingest', 'parse', 'etl', 'process data'],
    describe(wf, name, ctx) {
      const entry = _entryLabel(wf.entryPoint);
      const main = entry
        ? `The ${name} workflow moves data through a transformation pipeline, beginning at ${entry} and converting inputs into the shape downstream consumers need.`
        : `The ${name} workflow moves data through a series of transformation steps, converting inputs into the shape downstream consumers need.`;
      return [
        main,
        _stepCountSentence(wf.stepCount),
        _bottleneckSentence(wf.bottleneckNodes),
        _couplingContext(ctx),
        _riskSentence(wf.failureRisk, name),
      ].filter(Boolean).join(' ');
    },
  },
  {
    key: 'crud',
    keywords: ['create', 'read', 'update', 'delete', 'crud', 'fetch', 'save', 'store', 'retriev', 'persist', 'repository'],
    describe(wf, name, ctx) {
      const entry = _entryLabel(wf.entryPoint);
      const main = entry
        ? `The ${name} workflow manages the create-read-update-delete lifecycle for a resource, coordinating between business logic and the persistence layer via ${entry}.`
        : `The ${name} workflow manages the create-read-update-delete lifecycle for a resource, coordinating between business logic and the persistence layer.`;
      return [
        main,
        _stepCountSentence(wf.stepCount),
        _bottleneckSentence(wf.bottleneckNodes),
        _architectureContext(ctx, 'repository') ?? _couplingContext(ctx),
        _riskSentence(wf.failureRisk, name),
      ].filter(Boolean).join(' ');
    },
  },
  {
    key: 'auth',
    keywords: ['auth', 'login', 'logout', 'session', 'token', 'permission', 'access', 'credential', 'jwt', 'oauth', 'guard'],
    describe(wf, name, ctx) {
      const entry = _entryLabel(wf.entryPoint);
      const main = entry
        ? `The ${name} workflow enforces authentication and authorisation gates, beginning at ${entry} — verifying identity and permissions before allowing access to protected resources.`
        : `The ${name} workflow enforces authentication and authorisation gates — verifying identity and permissions before allowing access to protected resources.`;
      return [
        main,
        _stepCountSentence(wf.stepCount),
        _bottleneckSentence(wf.bottleneckNodes),
        _architectureContext(ctx, 'layered'),
        _riskSentence(wf.failureRisk, name),
      ].filter(Boolean).join(' ');
    },
  },
  {
    key: 'event',
    keywords: ['event', 'emit', 'publish', 'subscribe', 'notify', 'broadcast', 'message', 'bus', 'queue', 'consumer', 'producer'],
    describe(wf, name, ctx) {
      const entry = _entryLabel(wf.entryPoint);
      const main = entry
        ? `The ${name} workflow propagates events from producers to consumers, originating at ${entry} and decoupling the source of a change from its downstream effects.`
        : `The ${name} workflow propagates events from producers to interested consumers, decoupling the origin of a change from its downstream effects.`;
      return [
        main,
        _stepCountSentence(wf.stepCount),
        _bottleneckSentence(wf.bottleneckNodes),
        _couplingContext(ctx),
        _riskSentence(wf.failureRisk, name),
      ].filter(Boolean).join(' ');
    },
  },
  {
    key: 'validation',
    keywords: ['validat', 'sanitiz', 'check', 'enforce', 'constraint', 'rule', 'schema'],
    describe(wf, name, ctx) {
      const entry = _entryLabel(wf.entryPoint);
      const main = entry
        ? `The ${name} workflow validates inputs against expected shapes and business rules starting from ${entry}, acting as a gate before data reaches processing or persistence stages.`
        : `The ${name} workflow validates inputs against expected shapes and business rules, acting as a gate before data reaches processing or persistence stages.`;
      return [
        main,
        _stepCountSentence(wf.stepCount),
        _bottleneckSentence(wf.bottleneckNodes),
        _riskSentence(wf.failureRisk, name),
      ].filter(Boolean).join(' ');
    },
  },
  {
    key: 'error-handling',
    keywords: ['error', 'exception', 'failure', 'fallback', 'recover', 'retry', 'fault', 'catch'],
    describe(wf, name, ctx) {
      const entry = _entryLabel(wf.entryPoint);
      const main = entry
        ? `The ${name} workflow intercepts failures beginning at ${entry}, deciding at each stage whether to retry, fall back, or surface a clean error response to the caller.`
        : `The ${name} workflow intercepts failures at each stage, deciding whether to retry, fall back, or surface a clean error response to the caller.`;
      return [
        main,
        _stepCountSentence(wf.stepCount),
        _bottleneckSentence(wf.bottleneckNodes),
        _couplingContext(ctx),
        _riskSentence(wf.failureRisk, name),
      ].filter(Boolean).join(' ');
    },
  },
  {
    key: 'lifecycle',
    keywords: ['lifecycle', 'init', 'start', 'boot', 'shutdown', 'teardown', 'setup', 'startup'],
    describe(wf, name, ctx) {
      const entry = _entryLabel(wf.entryPoint);
      const main = entry
        ? `The ${name} workflow manages component lifecycle — initialising resources at ${entry} and ensuring they are cleaned up gracefully on shutdown.`
        : `The ${name} workflow manages component lifecycle — initialising resources at startup and cleaning them up gracefully on shutdown.`;
      return [
        main,
        _stepCountSentence(wf.stepCount),
        _bottleneckSentence(wf.bottleneckNodes),
        _riskSentence(wf.failureRisk, name),
      ].filter(Boolean).join(' ');
    },
  },
  {
    key: 'rendering',
    keywords: ['render', 'display', 'draw', 'compose', 'mount', 'view', 'ui', 'component', 'page'],
    describe(wf, name, ctx) {
      const entry = _entryLabel(wf.entryPoint);
      const main = entry
        ? `The ${name} workflow drives the rendering cycle from ${entry} — translating application state into visual output and responding to user-triggered re-renders.`
        : `The ${name} workflow drives the rendering cycle — translating application state into visual output and handling user-triggered re-renders.`;
      return [
        main,
        _stepCountSentence(wf.stepCount),
        _bottleneckSentence(wf.bottleneckNodes),
        _riskSentence(wf.failureRisk, name),
      ].filter(Boolean).join(' ');
    },
  },
  {
    key: 'config',
    keywords: ['config', 'setting', 'environment', 'env', 'bootstrap', 'configur'],
    describe(wf, name, ctx) {
      const entry = _entryLabel(wf.entryPoint);
      const main = entry
        ? `The ${name} workflow loads and applies configuration beginning at ${entry}, resolving environment-specific values before the rest of the application runs.`
        : `The ${name} workflow loads and applies configuration at startup, resolving environment-specific values before the rest of the application runs.`;
      return [
        main,
        _stepCountSentence(wf.stepCount),
        _bottleneckSentence(wf.bottleneckNodes),
        _riskSentence(wf.failureRisk, name),
      ].filter(Boolean).join(' ');
    },
  },
  {
    key: 'batch',
    keywords: ['batch', 'bulk', 'schedule', 'job', 'worker', 'background', 'cron', 'task'],
    describe(wf, name, ctx) {
      const entry = _entryLabel(wf.entryPoint);
      const main = entry
        ? `The ${name} workflow processes items in bulk or on a schedule, originating at ${entry} and isolating heavy work from the synchronous request path.`
        : `The ${name} workflow processes items in bulk or on a schedule, isolating heavy work from the request path to avoid latency spikes.`;
      return [
        main,
        _stepCountSentence(wf.stepCount),
        _bottleneckSentence(wf.bottleneckNodes),
        _couplingContext(ctx),
        _riskSentence(wf.failureRisk, name),
      ].filter(Boolean).join(' ');
    },
  },
  {
    key: 'service',
    keywords: ['service', 'manager', 'engine', 'processor', 'orchestrat', 'usecase', 'command', 'query'],
    describe(wf, name, ctx) {
      const entry = _entryLabel(wf.entryPoint);
      const main = entry
        ? `The ${name} workflow coordinates domain logic through the ${entry} service layer, orchestrating collaborators to complete the operation end-to-end.`
        : `The ${name} workflow coordinates domain logic, orchestrating collaborators through the service layer to complete the operation end-to-end.`;
      return [
        main,
        _stepCountSentence(wf.stepCount),
        _bottleneckSentence(wf.bottleneckNodes),
        _architectureContext(ctx, 'layered') ?? _couplingContext(ctx),
        _riskSentence(wf.failureRisk, name),
      ].filter(Boolean).join(' ');
    },
  },
];

// ── Engine ─────────────────────────────────────────────────────────────────────

class FolderWorkflowsNarrativeEngine {

  /**
   * @param {Array<{ name: string, entryPoint: string, stepCount: number, bottleneckNodes: string[], failureRisk: string }>} workflows
   * @param {{ architecturePatterns: string[], fileCount: number, couplingRatio: number }} context
   * @returns {string[]}
   */
  build({ workflows = [], architecturePatterns = [], fileCount = 0, couplingRatio = 0 } = {}) {
    const ctx = { architecturePatterns, fileCount, couplingRatio };
    return workflows.map(wf => this._buildDescription(wf, ctx));
  }

  _buildDescription(wf, ctx) {
    // wf may be a plain string (legacy call) or a full profile object
    const rawName = typeof wf === 'string' ? wf : (wf.name ?? wf.workflowName ?? 'Unnamed Workflow');
    const name    = _humanise(rawName);

    const profile = typeof wf === 'object' ? wf : {
      entryPoint:      null,
      stepCount:       0,
      bottleneckNodes: [],
      failureRisk:     'Low',
    };

    const lower    = rawName.toLowerCase();
    const expanded = lower.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

    for (const cluster of WORKFLOW_CLUSTERS) {
      if (cluster.keywords.some(kw => lower.includes(kw) || expanded.includes(kw))) {
        return cluster.describe(profile, name, ctx);
      }
    }

    // Generic fallback — still uses profile data for specificity
    const entry = _entryLabel(profile.entryPoint);
    const sentences = [];

    const lead = entry
      ? `The ${name} workflow is a key operational flow that begins at ${entry}.`
      : `The ${name} workflow is a key operational flow within this codebase.`;
    sentences.push(lead);

    const stepSentence = _stepCountSentence(profile.stepCount);
    if (stepSentence) sentences.push(stepSentence);

    const bottleneckSentence = _bottleneckSentence(profile.bottleneckNodes);
    if (bottleneckSentence) sentences.push(bottleneckSentence);

    const ctxSentence = _couplingContext(ctx);
    if (ctxSentence) sentences.push(ctxSentence);

    const riskSentence = _riskSentence(profile.failureRisk, name);
    if (riskSentence) sentences.push(riskSentence);

    return sentences.join(' ');
  }
}

module.exports = { FolderWorkflowsNarrativeEngine };
