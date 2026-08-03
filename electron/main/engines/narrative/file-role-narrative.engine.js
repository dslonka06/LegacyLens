'use strict';

/**
 * FileRoleNarrativeEngine — per-file one-liner for the File Roles panel
 * on the Data Flow page (folder + repo scope, multi-file only).
 *
 * Input shape (per file):
 *   {
 *     name:              string,   // file name
 *     fileRole:          string,   // 'controller'|'service'|'repository'|'http-client'|'state-store'|'component'|'unknown'
 *     sources:           string[], // detected inbound data sources
 *     sinks:             string[], // detected outbound data exits
 *     interactionVerbs:  Record<string, string>,  // importPath → verb
 *     totalInRole:       number,   // how many files share this role
 *     scope:             'folder' | 'repository',
 *   }
 *
 * Output: string — a single sentence describing the file's role in the data flow.
 */

class FileRoleNarrativeEngine {

  build(file) {
    return this._pick(this._conditions, file) ?? this._fallback(file);
  }

  buildAll(files, scope) {
    const countByRole = {};
    for (const f of files) {
      countByRole[f.fileRole] = (countByRole[f.fileRole] ?? 0) + 1;
    }
    return files.map(f => this.build({ ...f, totalInRole: countByRole[f.fileRole] ?? 1, scope }));
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _conditions = [

    // ── Controller: has HTTP sources ───────────────────────────────────────
    {
      weight: 200,
      when: (d) => d.fileRole === 'controller' && this._hasSink(d, ['http', 'request', 'route', 'get', 'post', 'put', 'delete']),
      produce: (d) => `HTTP entry point — accepts ${d.sources.length > 0 ? d.sources.join(', ') : 'incoming requests'} and delegates to ${d.sinks.length} downstream ${d.sinks.length === 1 ? 'target' : 'targets'}.`,
    },

    // ── Controller: no clear HTTP source ──────────────────────────────────
    {
      weight: 190,
      when: (d) => d.fileRole === 'controller',
      produce: (d) => `Entry point with ${Object.keys(d.interactionVerbs).length} outbound calls — orchestrates the flow from the outside world into the ${this._scopeLabel(d.scope)}.`,
    },

    // ── State store: many sinks (subscribers) ─────────────────────────────
    {
      weight: 185,
      when: (d) => d.fileRole === 'state-store' && d.sinks.length >= 2,
      produce: (d) => `Shared state container that emits to ${d.sinks.length} downstream consumers — a change here propagates broadly.`,
    },

    // ── State store: general ───────────────────────────────────────────────
    {
      weight: 180,
      when: (d) => d.fileRole === 'state-store',
      produce: (d) => `Manages shared reactive state — reads and writes flow through this file as a single source of truth.`,
    },

    // ── Repository: both read and write ────────────────────────────────────
    {
      weight: 175,
      when: (d) => d.fileRole === 'repository' && this._hasVerb(d, 'writes') && this._hasVerb(d, 'reads'),
      produce: (d) => `Dual-access data boundary — handles both read queries and write mutations for the ${this._scopeLabel(d.scope)}.`,
    },

    // ── Repository: read-only ──────────────────────────────────────────────
    {
      weight: 170,
      when: (d) => d.fileRole === 'repository' && !this._hasVerb(d, 'writes') && !this._hasVerb(d, 'updates') && !this._hasVerb(d, 'deletes'),
      produce: (d) => `Read-only data accessor — queries persistent state without mutating it.`,
    },

    // ── Repository: general ────────────────────────────────────────────────
    {
      weight: 165,
      when: (d) => d.fileRole === 'repository',
      produce: (d) => `Data access layer — the persistence boundary that the rest of the ${this._scopeLabel(d.scope)} calls through.`,
    },

    // ── HTTP client ────────────────────────────────────────────────────────
    {
      weight: 160,
      when: (d) => d.fileRole === 'http-client',
      produce: (d) => `External API bridge — crosses the network boundary on behalf of ${Object.keys(d.interactionVerbs).length} internal callers.`,
    },

    // ── Service: high number of interaction verbs (orchestrator) ──────────
    {
      weight: 155,
      when: (d) => d.fileRole === 'service' && Object.keys(d.interactionVerbs).length >= 5,
      produce: (d) => `Orchestrator service — ${Object.keys(d.interactionVerbs).length} outbound interactions make it a hub of business logic in this ${this._scopeLabel(d.scope)}.`,
    },

    // ── Service: publishes events ──────────────────────────────────────────
    {
      weight: 150,
      when: (d) => d.fileRole === 'service' && this._hasVerb(d, 'publishes'),
      produce: (d) => `Event-publishing service — drives reactive flows by emitting to subscribers downstream.`,
    },

    // ── Service: general ───────────────────────────────────────────────────
    {
      weight: 145,
      when: (d) => d.fileRole === 'service',
      produce: (d) => `Business logic service with ${Object.keys(d.interactionVerbs).length} outbound ${Object.keys(d.interactionVerbs).length === 1 ? 'dependency' : 'dependencies'}.`,
    },

    // ── Component: complex (many sinks) ───────────────────────────────────
    {
      weight: 140,
      when: (d) => d.fileRole === 'component' && d.sinks.length >= 2,
      produce: (d) => `UI component that emits ${d.sinks.join(', ')} — an interactive boundary between user and system.`,
    },

    // ── Component: general ────────────────────────────────────────────────
    {
      weight: 135,
      when: (d) => d.fileRole === 'component',
      produce: (d) => `Presentation layer file — renders UI and handles user interaction.`,
    },
  ];

  _fallback(d) {
    const verbCount = Object.keys(d.interactionVerbs).length;
    return `${verbCount > 0 ? verbCount + ' outbound interaction' + (verbCount === 1 ? '' : 's') + ' detected' : 'No interaction verbs detected'} — role inferred from file naming.`;
  }

  _hasSink(d, keywords) {
    const all = [...(d.sources ?? []), ...Object.values(d.interactionVerbs ?? {})].join(' ').toLowerCase();
    return keywords.some(k => all.includes(k));
  }

  _hasVerb(d, verb) {
    return Object.values(d.interactionVerbs ?? {}).some(v => v === verb);
  }

  _scopeLabel(scope) {
    return scope === 'repository' ? 'codebase' : 'module';
  }

  _pick(conditions, data) {
    const matching = conditions
      .filter(c => c.when(data))
      .sort((a, b) => b.weight - a.weight);
    return matching[0]?.produce(data) ?? null;
  }
}

module.exports = { FileRoleNarrativeEngine };
