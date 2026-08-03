'use strict';

/**
 * LayerBreakdownNarrativeEngine — per-layer one-liner for the Layer Breakdown panel
 * on the Architecture page (folder + repo scope).
 *
 * Input shape (per layer):
 *   {
 *     name:         string,   // e.g. "Service", "Repository", "Controller"
 *     fileCount:    number,   // files matching this layer
 *     totalFiles:   number,   // total files in the target
 *     patternName:  string,   // dominant pattern, e.g. "Layered Architecture"
 *     allLayers:    Array<{ name: string, fileCount: number }>,
 *     scope:        'folder' | 'repository',
 *   }
 *
 * Output: string — a single sentence describing the layer's structural role.
 */

class LayerBreakdownNarrativeEngine {

  build(layer) {
    return this._pick(this._conditions, layer) ?? this._fallback(layer);
  }

  buildAll(layers, patternName, totalFiles, scope) {
    return layers.map(l => this.build({
      ...l,
      patternName,
      totalFiles,
      scope,
      allLayers: layers,
    }));
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _conditions = [

    // ── Dominant layer (most files) ────────────────────────────────────────
    {
      weight: 200,
      when: (d) => {
        const max = Math.max(...d.allLayers.map(l => l.fileCount));
        const tiedCount = d.allLayers.filter(l => l.fileCount === max).length;
        return d.fileCount === max && max > 0 && d.allLayers.length > 1 && tiedCount === 1;
      },
      produce: (d) => `The heaviest layer in this ${this._scopeLabel(d.scope)} — ${d.fileCount} of ${d.totalFiles} files concentrate here. ${this._patternLayerNote(d)}`
    },

    // ── Very thin layer (1–2 files) ────────────────────────────────────────
    {
      weight: 190,
      when: (d) => d.fileCount >= 1 && d.fileCount <= 2,
      produce: (d) => `Thin layer with only ${d.fileCount} file${d.fileCount === 1 ? '' : 's'} — either well-encapsulated or underdeveloped for the ${this._scopeLabel(d.scope)}'s scale.`,
    },

    // ── Controller layer ───────────────────────────────────────────────────
    {
      weight: 170,
      when: (d) => this._isLayer(d, ['controller', 'api', 'handler']),
      produce: (d) => `${d.fileCount} request-handling ${d.fileCount === 1 ? 'file' : 'files'} — the surface area where external calls enter the ${this._scopeLabel(d.scope)}.`,
    },

    // ── Service layer ──────────────────────────────────────────────────────
    {
      weight: 165,
      when: (d) => this._isLayer(d, ['service', 'application', 'usecase']),
      produce: (d) => `${d.fileCount} ${d.fileCount === 1 ? 'file' : 'files'} in the business logic layer — where orchestration and domain rules live in this ${this._scopeLabel(d.scope)}.`,
    },

    // ── Repository / data access layer ─────────────────────────────────────
    {
      weight: 160,
      when: (d) => this._isLayer(d, ['repository', 'data', 'infrastructure', 'dao']),
      produce: (d) => `${d.fileCount} data access ${d.fileCount === 1 ? 'file' : 'files'} — the persistence boundary for the ${this._scopeLabel(d.scope)}.`,
    },

    // ── Domain / entity layer ──────────────────────────────────────────────
    {
      weight: 155,
      when: (d) => this._isLayer(d, ['domain', 'entity', 'model', 'aggregate']),
      produce: (d) => `${d.fileCount} domain ${d.fileCount === 1 ? 'model' : 'models'} — the core data contracts everything else is built around.`,
    },

    // ── View / presentation layer ──────────────────────────────────────────
    {
      weight: 150,
      when: (d) => this._isLayer(d, ['view', 'presentation', 'page', 'component']),
      produce: (d) => `${d.fileCount} presentation ${d.fileCount === 1 ? 'file' : 'files'} — the UI surface of the ${this._scopeLabel(d.scope)}.`,
    },

    // ── Angular Feature Module layers ──────────────────────────────────────
    {
      weight: 145,
      when: (d) => this._isLayer(d, ['feature']),
      produce: (d) => `${d.fileCount} ${d.fileCount === 1 ? 'file' : 'files'} across feature modules — each module encapsulates its own pages, components, and routing.`,
    },
    {
      weight: 144,
      when: (d) => this._isLayer(d, ['core']),
      produce: (d) => `${d.fileCount} ${d.fileCount === 1 ? 'file' : 'files'} in the core layer — app-wide singletons: guards, interceptors, and foundational services.`,
    },
    {
      weight: 143,
      when: (d) => this._isLayer(d, ['shared']),
      produce: (d) => `${d.fileCount} ${d.fileCount === 1 ? 'file' : 'files'} in the shared layer — reusable components, pipes, and utilities consumed across features.`,
    },
    {
      weight: 142,
      when: (d) => this._isLayer(d, ['knowledge']),
      produce: (d) => `${d.fileCount} ${d.fileCount === 1 ? 'file' : 'files'} in the knowledge layer — data contracts, type definitions, and domain models.`,
    },
    {
      weight: 141,
      when: (d) => this._isLayer(d, ['workspace']),
      produce: (d) => `${d.fileCount} ${d.fileCount === 1 ? 'file' : 'files'} managing workspace state — session lifecycle, persistence, and multi-workspace coordination.`,
    },
    {
      weight: 140,
      when: (d) => this._isLayer(d, ['shell']),
      produce: (d) => `${d.fileCount} ${d.fileCount === 1 ? 'file' : 'files'} in the shell layer — app chrome: sidebar, navigation, layout, and top-level UI structure.`,
    },
    {
      weight: 139,
      when: (d) => this._isLayer(d, ['analysis']),
      produce: (d) => `${d.fileCount} ${d.fileCount === 1 ? 'file' : 'files'} in the analysis layer — pipeline orchestration, result models, and analysis services.`,
    },
    {
      weight: 138,
      when: (d) => this._isLayer(d, ['ai']),
      produce: (d) => `${d.fileCount} ${d.fileCount === 1 ? 'file' : 'files'} in the AI layer — prompt construction, model communication, and AI result handling.`,
    },
  ];

  _fallback(d) {
    return `${d.fileCount} ${d.fileCount === 1 ? 'file' : 'files'} grouped under this layer by folder and naming conventions.`;
  }

  _patternLayerNote(d) {
    const n = (d.name ?? '').toLowerCase();
    if (n.includes('service') || n.includes('application')) {
      return 'Consider whether orchestration is distributed too broadly.';
    }
    if (n.includes('controller') || n.includes('api')) {
      return 'A heavy entry layer may indicate logic that belongs further down the stack.';
    }
    if (n.includes('repository') || n.includes('data') || n.includes('infrastructure')) {
      return 'A data-heavy layer is normal for persistence-intensive systems.';
    }
    if (n.includes('feature')) {
      return 'Review for feature module sprawl — large feature counts can hide cross-cutting dependencies.';
    }
    return 'Review for layer bloat if files are growing rapidly.';
  }

  _isLayer(d, keywords) {
    const n = (d.name ?? '').toLowerCase();
    return keywords.some(k => n.includes(k));
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

module.exports = { LayerBreakdownNarrativeEngine };
