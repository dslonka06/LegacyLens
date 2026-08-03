'use strict';

/**
 * ReadingOrderNarrativeEngine — per-file one-liner for the Reading Order panel
 * on the System Understanding page (folder + repo scope).
 *
 * Input shape (per file):
 *   {
 *     name:       string,   // file name
 *     path:       string,   // file path
 *     type:       string,   // detected type from AnalysisEngine (e.g. "Service", "Component")
 *     role:       string,   // dataFlowFacts fileRole (higher quality: "service", "controller", etc.)
 *     inbound:    number,   // files that depend on this one
 *     outbound:   number,   // files this one depends on
 *     total:      number,   // inbound + outbound
 *     totalFiles: number,   // total file count in the target, for relative framing
 *   }
 *
 * Output: string — a single sentence explaining why this file belongs on the reading list.
 */

class ReadingOrderNarrativeEngine {

  build(file) {
    return this._pick(this._conditions, file) ?? this._fallback(file);
  }

  buildAll(files, totalFiles = 0) {
    return files.map(f => this.build({ ...f, totalFiles }));
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _conditions = [

    // ── Controllers / entry points with high inbound ────────────────────────
    {
      weight: 200,
      when:   (d) => this._isRole(d, ['controller', 'http-client']) && d.inbound >= 4,
      produce:(d) => `Entry point for ${d.inbound} consumers — reading this file maps the full request surface of the system.`,
    },

    // ── Controllers / entry points low inbound ──────────────────────────────
    {
      weight: 190,
      when:   (d) => this._isRole(d, ['controller', 'http-client']),
      produce:(d) => `Request handler with ${d.outbound} downstream dependencies — a good starting point for tracing how external calls flow inward.`,
    },

    // ── State stores ────────────────────────────────────────────────────────
    {
      weight: 185,
      when:   (d) => this._isRole(d, ['state-store']) && d.inbound >= 3,
      produce:(d) => `Central state store depended on by ${d.inbound} files — understanding it explains how shared data moves across the application.`,
    },

    {
      weight: 184,
      when:   (d) => this._isRole(d, ['state-store']),
      produce:(d) => `State store — read this to understand the data contract that the rest of the application reads from and writes to.`,
    },

    // ── Repositories / data access ──────────────────────────────────────────
    {
      weight: 180,
      when:   (d) => this._isRole(d, ['repository']) && d.inbound >= 5,
      produce:(d) => `Data access layer with ${d.inbound} callers — this file defines the persistence contract the rest of the codebase depends on.`,
    },

    {
      weight: 175,
      when:   (d) => this._isRole(d, ['repository']) && d.inbound > 0,
      produce:(d) => `Repository with ${d.inbound} caller${d.inbound === 1 ? '' : 's'} — reading it clarifies what data shapes and queries the application is built around.`,
    },

    // ── Services: high outbound orchestrators ───────────────────────────────
    {
      weight: 170,
      when:   (d) => this._isRole(d, ['service']) && d.outbound >= 6,
      produce:(d) => `Orchestrator service that coordinates ${d.outbound} downstream dependencies — the most efficient place to understand how business logic is assembled.`,
    },

    // ── Services: highly depended on ────────────────────────────────────────
    {
      weight: 165,
      when:   (d) => this._isRole(d, ['service']) && d.inbound >= 6,
      produce:(d) => `Core service depended on by ${d.inbound} other files — changes here have the widest reach in the codebase.`,
    },

    {
      weight: 160,
      when:   (d) => this._isRole(d, ['service']) && d.inbound >= 3,
      produce:(d) => `Service consumed by ${d.inbound} callers — a load-bearing piece of the business logic layer.`,
    },

    {
      weight: 155,
      when:   (d) => this._isRole(d, ['service']),
      produce:(d) => `Service with ${d.outbound} dependencies — worth reading early to understand how the logic layer is structured.`,
    },

    // ── Components: high inbound (shared UI) ────────────────────────────────
    {
      weight: 150,
      when:   (d) => this._isRole(d, ['component']) && d.inbound >= 5,
      produce:(d) => `Shared UI component used in ${d.inbound} places — reading it gives a feel for the component contract the whole UI is built on.`,
    },

    {
      weight: 145,
      when:   (d) => this._isRole(d, ['component']) && d.outbound >= 5,
      produce:(d) => `Root or container component that pulls in ${d.outbound} child dependencies — a good entry point for understanding the UI structure.`,
    },

    // ── High inbound, unknown role ───────────────────────────────────────────
    {
      weight: 120,
      when:   (d) => d.inbound >= 6,
      produce:(d) => `Depended on by ${d.inbound} files — one of the most widely referenced files in the codebase.`,
    },

    {
      weight: 110,
      when:   (d) => d.inbound >= 3,
      produce:(d) => `Referenced by ${d.inbound} other files — understanding it clarifies a shared contract in the codebase.`,
    },

    // ── High outbound orchestrators, unknown role ────────────────────────────
    {
      weight: 100,
      when:   (d) => d.outbound >= 6,
      produce:(d) => `Coordinates ${d.outbound} downstream files — reading it gives the broadest view of how the system hangs together.`,
    },

  ];

  _fallback(d) {
    return `Structurally connected to ${d.total} other files — read it to understand a key seam in the codebase.`;
  }

  _isRole(d, roles) {
    // role comes from dataFlowFacts.fileRole — a controlled enum — so exact match only.
    // type is a freeform string from the dependency graph, so substring match is acceptable.
    const r = (d.role ?? '').toLowerCase();
    const t = (d.type ?? '').toLowerCase();
    return roles.some(role =>
      r === role ||
      t === role ||
      t.includes(role)
    );
  }

  _pick(conditions, data) {
    const matching = conditions
      .filter(c => c.when(data))
      .sort((a, b) => b.weight - a.weight);
    return matching[0]?.produce(data) ?? null;
  }
}

module.exports = { ReadingOrderNarrativeEngine };
