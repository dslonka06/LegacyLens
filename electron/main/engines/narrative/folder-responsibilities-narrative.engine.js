/**
 * FolderResponsibilitiesNarrativeEngine — produces a short paragraph for each
 * folder-scope responsibility, drawing on the responsibility text, component
 * blast-radius data, and code health metrics.
 *
 * Input shape:
 *   {
 *     responsibilities:     string[],
 *     responsibilityGroups: Array<{
 *       responsibility: string,
 *       components:     Array<{ name: string, blastRadius: 'High' | 'Medium' | 'Low' }>,
 *     }>,
 *     complexity:           'Low' | 'Medium' | 'High',
 *     maintainability:      'Low' | 'Medium' | 'High',
 *     fileCount:            number,
 *   }
 *
 * Output: string[] — one paragraph per responsibility, same order as input.
 */

const FOLDER_CLUSTERS = [
  {
    key: 'http',
    keywords: ['http request', 'endpoint', 'route', 'controller', 'api', 'rest', 'handle', 'incoming', 'expose'],
    what: () => `Acts as the entry layer for external traffic — receiving requests and delegating work to the appropriate service logic.`,
    why:  () => `Keeping request handling separate from business logic means the transport layer can evolve without touching what the system actually does.`,
  },
  {
    key: 'business-logic',
    keywords: ['business logic', 'orchestrat', 'implement', 'service', 'operation'],
    what: () => `Owns the core business rules of this folder — the logic that defines what the system actually does rather than how it stores or presents data.`,
    why:  () => `Centralising domain logic here means product behaviour can be changed in one place without rippling through persistence or presentation layers.`,
  },
  {
    key: 'persistence',
    keywords: ['persist', 'data persist', 'retrieval', 'repository', 'database', 'storage', 'crud', 'query'],
    what: () => `Manages how data is read from and written to persistent storage, abstracting the underlying data layer from the rest of the folder.`,
    why:  () => `Isolating persistence here means storage implementation details — database choice, schema shape — can change without affecting business logic.`,
  },
  {
    key: 'domain',
    keywords: ['data struct', 'domain', 'entity', 'model', 'schema', 'defin'],
    what: () => `Defines the data structures and domain entities that the rest of the folder operates on.`,
    why:  () => `A shared set of well-defined types here prevents structural inconsistencies from spreading across layers.`,
  },
  {
    key: 'rendering',
    keywords: ['render', 'ui element', 'user interact', 'component', 'view', 'display', 'present'],
    what: () => `Builds the visual elements users interact with, translating application state into rendered output.`,
    why:  () => `Keeping UI concerns here, away from data and business logic, means visual changes can be made without touching what drives them.`,
  },
  {
    key: 'routing',
    keywords: ['page', 'routing', 'compose', 'page-level', 'navigation'],
    what: () => `Composes page-level views and owns navigation logic — the layer users land on when moving through the application.`,
    why:  () => `Separating page composition from component logic means routing and layout decisions stay in one place.`,
  },
  {
    key: 'pipeline',
    keywords: ['middleware', 'pipeline', 'process request', 'intercept', 'filter'],
    what: () => `Sits in the request/response pipeline, processing or transforming traffic before it reaches handlers or after handlers produce a result.`,
    why:  () => `Cross-cutting concerns handled here — logging, auth checks, response shaping — stay out of individual handler logic.`,
  },
  {
    key: 'auth',
    keywords: ['auth', 'guard', 'permission', 'access', 'authoriz', 'enforce'],
    what: () => `Enforces authentication and authorisation rules — deciding which callers can reach which resources before any business logic runs.`,
    why:  () => `Centralising access control here means security rules are defined once and applied consistently across the folder.`,
  },
  {
    key: 'utilities',
    keywords: ['util', 'helper', 'reusable', 'shared', 'common'],
    what: () => `Provides reusable utilities and helpers shared across the rest of the folder.`,
    why:  () => `Pulling shared logic here prevents duplication and gives the rest of the folder a single place to find and update common behaviour.`,
  },
  {
    key: 'config',
    keywords: ['config', 'setting', 'environment', 'application config'],
    what: () => `Manages configuration and environment settings that other parts of the folder depend on at startup and runtime.`,
    why:  () => `Environment-specific behaviour concentrated here means deployment differences don't scatter through application code.`,
  },
  {
    key: 'migrations',
    keywords: ['migration', 'schema evolution', 'database schema'],
    what: () => `Tracks and applies changes to the database schema over time, keeping the data layer in sync with application evolution.`,
    why:  () => `Versioned migrations here mean schema history is auditable and deployments can be applied incrementally without data loss.`,
  },
  {
    key: 'testing',
    keywords: ['test', 'validat', 'automated', 'behavior'],
    what: () => `Contains automated tests that verify application behaviour, acting as a safety net for changes elsewhere in the folder.`,
    why:  () => `A dedicated test layer here means regressions are caught before they reach production and refactoring is lower-risk.`,
  },
  {
    key: 'coordination',
    keywords: ['coordinat', 'interaction', 'between', 'source file'],
    what: (d) => `Coordinates the interactions between the ${d.fileCount} source files in this folder, ensuring they work together without tight coupling.`,
    why:  () => `Cross-file coordination owned here prevents ad-hoc coupling from spreading and makes the overall structure easier to reason about.`,
  },
  {
    key: 'architecture',
    keywords: ['architectural', 'concern'],
    what: (d) => `Implements the structural concerns of this folder's architecture, providing the scaffolding that other layers build on.`,
    why:  () => `Architectural plumbing kept here means the application's structural decisions are easy to locate and update as requirements evolve.`,
  },
];

class FolderResponsibilitiesNarrativeEngine {

  build(data) {
    const {
      responsibilities     = [],
      responsibilityGroups = [],
      complexity           = 'Medium',
      maintainability      = 'Medium',
      fileCount            = 0,
    } = data;

    // Index groups by responsibility text for fast lookup
    const groupMap = new Map();
    for (const g of responsibilityGroups) {
      groupMap.set(g.responsibility, g);
    }

    const ctx = { complexity, maintainability, fileCount };
    return responsibilities.map(resp => this._buildParagraph(resp, groupMap.get(resp) ?? null, ctx));
  }

  _buildParagraph(resp, group, ctx) {
    const lower = resp.toLowerCase();
    const cluster = FOLDER_CLUSTERS.find(c => c.keywords.some(kw => lower.includes(kw)));

    const sentences = [];

    // ── Sentence 1: what this responsibility does ─────────────────────────────
    if (cluster) {
      sentences.push(cluster.what(ctx));
    } else {
      const cleaned = resp.endsWith('.') ? resp.slice(0, -1) : resp;
      sentences.push(`${cleaned} is a core responsibility of this folder.`);
    }

    // ── Sentence 2: why it matters ────────────────────────────────────────────
    if (cluster) {
      sentences.push(cluster.why());
    }

    // ── Sentence 3: component blast-radius context ────────────────────────────
    const blastSentence = this._blastRadiusContext(group);
    if (blastSentence) sentences.push(blastSentence);

    // ── Sentence 4: health note (only when degraded) ─────────────────────────
    const healthSentence = this._healthContext(ctx.complexity, ctx.maintainability);
    if (healthSentence) sentences.push(healthSentence);

    return sentences.join(' ');
  }

  _blastRadiusContext(group) {
    if (!group || !group.components || group.components.length === 0) return null;

    const high   = group.components.filter(c => c.blastRadius === 'High').length;
    const total  = group.components.length;

    if (high > 0) {
      return `${total} component${total !== 1 ? 's' : ''} carry this responsibility, ${high === total ? 'all' : high} with high blast radius — changes here have wide downstream impact.`;
    }

    if (total > 1) {
      return `${total} components share this responsibility across the folder.`;
    }

    return null;
  }

  _healthContext(complexity, maintainability) {
    if (complexity === 'High' && maintainability === 'Low') {
      return `High complexity and low maintainability across this folder mean changes here carry elevated regression risk.`;
    }
    if (complexity === 'High') {
      return `High structural complexity in this folder means care is warranted when modifying this area.`;
    }
    if (maintainability === 'Low') {
      return `Low maintainability across this folder means this responsibility may be harder to change safely than it appears.`;
    }
    return null;
  }
}

module.exports = { FolderResponsibilitiesNarrativeEngine };
