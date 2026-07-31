/**
 * ResponsibilitiesNarrativeEngine — produces a short paragraph for each
 * responsibility of a file, drawing on keyword clusters, data flow context,
 * risks, and health metrics.
 *
 * Input shape:
 *   {
 *     responsibilities: string[],
 *     language:         string,
 *     fileType:         string,
 *     complexity:       'Low' | 'Medium' | 'High',
 *     maintainability:  'Low' | 'Medium' | 'High',
 *     inputs:           string[],   // dataFlow.inputs
 *     outputs:          string[],   // dataFlow.outputs
 *     flowSteps:        string[],   // dataFlow.steps
 *     risks:            Array<{ description: string, severity: string }>,
 *   }
 *
 * Output: string[] — one paragraph per responsibility, same order.
 */

const CLUSTERS = [
  {
    key: 'auth',
    keywords: ['auth', 'login', 'logout', 'token', 'credential', 'session', 'permission', 'role', 'access', 'identity', 'jwt', 'oauth', 'sign in', 'sign out'],
    what:    (resp, d) => `Handles the security boundary for this ${d.fileType.toLowerCase()} — validating identity and enforcing access rules before any downstream logic executes.`,
    why:     ()        => `Without this responsibility, the rest of the file's logic would be exposed to unauthenticated or unauthorised callers.`,
    riskKey: ['auth', 'token', 'credential', 'session', 'permission', 'injection', 'xss', 'csrf'],
  },
  {
    key: 'validation',
    keywords: ['valid', 'sanitiz', 'check input', 'verify input', 'ensure', 'enforce', 'constrain', 'guard', 'schema'],
    what:    (resp, d) => `Enforces correctness and safety of incoming data before it reaches business logic.`,
    why:     ()        => `Centralising validation here prevents invalid state from propagating deeper into the system, making failures easier to diagnose and fix.`,
    riskKey: ['valid', 'sanitiz', 'injection', 'input', 'xss'],
  },
  {
    key: 'data-transform',
    keywords: ['transform', 'convert', 'map', 'parse', 'format', 'serialize', 'deserializ', 'normaliz', 'encode', 'decode', 'adapt'],
    what:    (resp, d) => `Translates data between representations — bridging the shape callers provide and the shape the system processes internally.`,
    why:     ()        => `Isolating transformations here keeps the surrounding logic free from format concerns and makes the mapping rules easy to change independently.`,
    riskKey: ['parse', 'format', 'serializ', 'transform'],
  },
  {
    key: 'persistence',
    keywords: ['save', 'store', 'persist', 'database', 'repository', 'query', 'fetch from', 'load from', 'read from', 'write to', 'crud', 'insert', 'update record', 'delete record', 'orm', 'sql'],
    what:    (resp, d) => `Manages the lifecycle of data in persistent storage — coordinating reads and writes while keeping the rest of the ${d.fileType.toLowerCase()} free from data-layer concerns.`,
    why:     ()        => `Owning persistence in one place means storage implementation details can change without touching business logic elsewhere.`,
    riskKey: ['sql', 'inject', 'query', 'database', 'persist', 'storage'],
  },
  {
    key: 'http',
    keywords: ['request', 'response', 'http', 'endpoint', 'route', 'controller', 'rest', 'api call', 'handle request', 'incoming'],
    what:    (resp, d) => `Acts as the entry point for external traffic — receiving requests, delegating to the appropriate logic, and shaping the response.`,
    why:     ()        => `Keeping this responsibility distinct from business logic ensures the transport layer can evolve independently of what the system actually does.`,
    riskKey: ['http', 'request', 'inject', 'xss', 'csrf', 'header', 'cors'],
  },
  {
    key: 'state',
    keywords: ['state', 'manage state', 'track state', 'maintain state', 'store state', 'cache', 'in-memory'],
    what:    (resp, d) => `Owns and controls a slice of application state, ensuring it stays consistent and is updated through a controlled interface.`,
    why:     ()        => `Centralised state ownership prevents scattered mutations that are hard to trace and reason about across the codebase.`,
    riskKey: ['state', 'cache', 'race', 'concurrent', 'mutation'],
  },
  {
    key: 'event',
    keywords: ['event', 'emit', 'dispatch event', 'subscribe', 'listen', 'notify', 'publish', 'observe', 'broadcast', 'reactive', 'observable', 'stream'],
    what:    (resp, d) => `Propagates changes across the system through events or observables — decoupling the source of a change from everything that reacts to it.`,
    why:     ()        => `Event-driven communication here allows consumers to be added or removed without modifying the originating code.`,
    riskKey: ['event', 'memory leak', 'unsubscrib', 'observable'],
  },
  {
    key: 'error',
    keywords: ['error', 'exception', 'fail', 'retry', 'fallback', 'recover', 'handle error', 'catch'],
    what:    (resp, d) => `Defines how failures are caught, handled, and surfaced — preventing unhandled exceptions from propagating silently through the system.`,
    why:     ()        => `Explicit error handling here makes the failure modes of this file predictable and testable.`,
    riskKey: ['error', 'exception', 'unhandled', 'crash', 'throw'],
  },
  {
    key: 'config',
    keywords: ['config', 'setting', 'environment', 'init', 'setup', 'bootstrap', 'configure', 'startup', 'initializ'],
    what:    (resp, d) => `Provides configuration or initialisation logic that other parts of the system depend on before executing.`,
    why:     ()        => `Grouping startup concerns here means environment-specific behaviour is easy to locate and modify without affecting runtime logic.`,
    riskKey: ['config', 'secret', 'env', 'credential', 'key'],
  },
  {
    key: 'rendering',
    keywords: ['render', 'display', 'view', 'template', 'layout', 'present', 'draw', 'paint', 'visual'],
    what:    (resp, d) => `Constructs the visual representation of data — translating application state into what the user sees on screen.`,
    why:     ()        => `Keeping rendering logic here, separate from data logic, means visual changes can be made without touching business rules.`,
    riskKey: ['xss', 'inject', 'render', 'sanitiz', 'html'],
  },
  {
    key: 'logging',
    keywords: ['log', 'audit', 'trace', 'monitor', 'metric', 'telemetry', 'report', 'instrument'],
    what:    (resp, d) => `Captures observable behaviour for debugging, auditing, or monitoring — a cross-cutting concern supporting operational visibility.`,
    why:     ()        => `Consistent logging here means issues in production can be diagnosed from recorded events rather than requiring reproduction.`,
    riskKey: ['log', 'audit', 'leak', 'sensitive', 'pii'],
  },
  {
    key: 'coordination',
    keywords: ['coordinat', 'orchestrat', 'manage', 'control flow', 'delegat', 'sequence', 'workflow', 'pipeline'],
    what:    (resp, d) => `Coordinates the sequence of sub-operations, owning the control flow without implementing the details of each step.`,
    why:     ()        => `Centralising orchestration here makes the overall workflow readable in one place and keeps individual steps independently testable.`,
    riskKey: ['deadlock', 'timeout', 'race', 'concurrent', 'async'],
  },
  {
    key: 'calculation',
    keywords: ['calculat', 'comput', 'deriv', 'aggregat', 'sum', 'average', 'score', 'rank', 'formula', 'algorithm'],
    what:    (resp, d) => `Performs domain calculations or data derivations — producing results from inputs according to defined business rules.`,
    why:     ()        => `Encapsulating computation here means the formulas are easy to test in isolation and update when business rules change.`,
    riskKey: ['overflow', 'precision', 'division', 'calculat'],
  },
  {
    key: 'communication',
    keywords: ['send', 'receiv', 'message', 'email', 'sms', 'push', 'webhook', 'socket', 'notify user', 'alert'],
    what:    (resp, d) => `Handles outbound or inbound communication — sending messages, notifications, or signals to external systems or users.`,
    why:     ()        => `Isolating communication here means delivery mechanisms can change without touching the logic that decides when to communicate.`,
    riskKey: ['inject', 'spoof', 'phishing', 'rate limit', 'auth'],
  },
];

class ResponsibilitiesNarrativeEngine {

  build(data) {
    const {
      responsibilities = [],
      language         = 'Unknown',
      fileType         = 'file',
      complexity       = 'Medium',
      maintainability  = 'Medium',
      inputs           = [],
      outputs          = [],
      flowSteps        = [],
      risks            = [],
    } = data;

    const ctx = { language, fileType, complexity, maintainability, inputs, outputs, flowSteps, risks };
    return responsibilities.map(resp => this._buildParagraph(resp, ctx));
  }

  _buildParagraph(resp, ctx) {
    const lower = resp.toLowerCase();
    const cluster = CLUSTERS.find(c => c.keywords.some(kw => lower.includes(kw)));

    const sentences = [];

    // ── Sentence 1: what this responsibility does ─────────────────────────────
    if (cluster) {
      sentences.push(cluster.what(resp, ctx));
    } else {
      const cleaned = resp.endsWith('.') ? resp.slice(0, -1) : resp;
      sentences.push(`${cleaned} is a core accountability of this ${ctx.language} ${ctx.fileType.toLowerCase()}.`);
    }

    // ── Sentence 2: why it matters / design intent ────────────────────────────
    if (cluster) {
      sentences.push(cluster.why());
    }

    // ── Sentence 3: data flow context ────────────────────────────────────────
    const flowSentence = this._flowContext(resp, ctx, cluster);
    if (flowSentence) sentences.push(flowSentence);

    // ── Sentence 4: relevant risk callout ────────────────────────────────────
    const riskSentence = this._riskContext(resp, ctx, cluster);
    if (riskSentence) sentences.push(riskSentence);

    // ── Sentence 5: health note (only when degraded) ─────────────────────────
    const healthSentence = this._healthContext(ctx.complexity, ctx.maintainability);
    if (healthSentence) sentences.push(healthSentence);

    return sentences.join(' ');
  }

  _flowContext(resp, ctx, cluster) {
    const { inputs, outputs, flowSteps } = ctx;
    if (inputs.length === 0 && outputs.length === 0 && flowSteps.length === 0) return null;

    const lower = resp.toLowerCase();

    // Match responsibility to inputs — it likely handles incoming data
    if (inputs.length > 0 && (cluster?.key === 'validation' || cluster?.key === 'http' || lower.includes('input') || lower.includes('incom'))) {
      const listed = inputs.slice(0, 2).join(' and ');
      return `It operates on ${listed}${inputs.length > 2 ? ` and ${inputs.length - 2} other input${inputs.length - 2 !== 1 ? 's' : ''}` : ''}.`;
    }

    // Match responsibility to outputs — it likely produces something
    if (outputs.length > 0 && (cluster?.key === 'data-transform' || cluster?.key === 'calculation' || lower.includes('output') || lower.includes('produc') || lower.includes('return'))) {
      const listed = outputs.slice(0, 2).join(' and ');
      return `It produces ${listed}${outputs.length > 2 ? ` among other outputs` : ''}.`;
    }

    // Flow steps exist — describe position in the pipeline
    if (flowSteps.length >= 2) {
      return `Within the file's processing pipeline, this sits alongside ${flowSteps.length} defined data flow steps.`;
    }

    return null;
  }

  _riskContext(resp, ctx, cluster) {
    if (!ctx.risks || ctx.risks.length === 0) return null;

    const lower = resp.toLowerCase();
    const riskKeys = cluster?.riskKey ?? [];

    // Find risks whose description overlaps with this responsibility's cluster keywords
    const relevant = ctx.risks.filter(r => {
      const rd = (r.description ?? '').toLowerCase();
      return riskKeys.some(k => rd.includes(k)) || riskKeys.some(k => lower.includes(k) && rd.length > 0);
    });

    if (relevant.length === 0) return null;

    const top = relevant[0];
    const severityNote = top.severity === 'critical' || top.severity === 'high'
      ? 'A high-severity risk'
      : 'A risk';

    return `${severityNote} has been flagged in this area: ${top.description.endsWith('.') ? top.description : top.description + '.'}`;
  }

  _healthContext(complexity, maintainability) {
    if (complexity === 'High' && maintainability === 'Low') {
      return `Note: high complexity and low maintainability across this file mean changes to this responsibility carry elevated regression risk.`;
    }
    if (complexity === 'High') {
      return `High structural complexity in this file means care is warranted when modifying this area.`;
    }
    if (maintainability === 'Low') {
      return `Low maintainability across this file means this responsibility may be harder to change safely than it appears.`;
    }
    return null;
  }
}

module.exports = { ResponsibilitiesNarrativeEngine };
