/**
 * DebtHotspotNarrativeEngine — per-hotspot interpretation text for the
 * Technical Debt Hotspots panel on the System Understanding page (repo scope).
 *
 * Each hotspot arrives with a name, a structural reason (e.g. "handles N inbound
 * and M outbound dependencies"), and a generic impact sentence from the detection
 * engine. This engine replaces that generic impact with a reading that uses the
 * specific numbers and hotspot type to say something the developer can act on.
 *
 * Input shape (per hotspot):
 *   {
 *     name:       string,   // file/component name
 *     reason:     string,   // raw reason string from buildDebtHotspots
 *     impact:     string,   // generic impact (we replace this)
 *     inbound:    number,   // parsed from reason where available
 *     outbound:   number,   // parsed from reason where available
 *     isLegacy:   boolean,  // true when reason mentions "legacy" or "deprecated"
 *     totalFiles: number,   // total file count in the repo
 *   }
 *
 * Output: string — a single paragraph specific to this hotspot.
 */

class DebtHotspotNarrativeEngine {

  /**
   * Build a narrative for a single hotspot.
   * Caller is responsible for parsing inbound/outbound from the reason string
   * before passing the enriched shape in.
   */
  build(hotspot) {
    const enriched = this._enrich(hotspot);
    return this._pick(this._conditions, enriched) ?? hotspot.impact;
  }

  /**
   * Build narratives for an array of hotspots and return them in the same order.
   * totalFiles is used for relative-impact framing.
   */
  buildAll(hotspots, totalFiles = 0) {
    return hotspots.map(h => this.build(this._enrich({ ...h, totalFiles })));
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _enrich(h) {
    // Parse inbound/outbound from the reason string if not already present
    const inboundMatch  = h.reason?.match(/(\d+)\s+inbound/);
    const outboundMatch = h.reason?.match(/(\d+)\s+outbound/);
    return {
      ...h,
      inbound:  h.inbound  ?? (inboundMatch  ? parseInt(inboundMatch[1],  10) : 0),
      outbound: h.outbound ?? (outboundMatch ? parseInt(outboundMatch[1], 10) : 0),
      isLegacy: h.isLegacy ?? /legacy|deprecated|unused|old\b|v1\b/i.test(h.reason ?? ''),
    };
  }

  _conditions = [

    // ── Legacy / deprecated files ───────────────────────────────────────────

    {
      weight: 200,
      when:    (d) => d.isLegacy,
      produce: (d) => `${d.name} is flagged as legacy or deprecated code. Files with these names are commonly left in place rather than removed, and tend to accumulate callers over time — developers reach for them because they exist and appear to work, not because they're the right abstraction. The risk is not that the file will break, but that it extends the lifetime of patterns that were already superseded. Before making changes nearby, confirm whether this file is still actively called or whether it can be safely removed; keeping it means maintaining two parallel implementations indefinitely.`,
    },

    // ── Extreme god object: very high inbound AND outbound ──────────────────

    {
      weight: 190,
      when:    (d) => !d.isLegacy && d.inbound >= 6 && d.outbound >= 6,
      produce: (d) => `${d.name} sits at the centre of the dependency graph with ${d.inbound} components depending on it and ${d.outbound} components it depends on. This bidirectional coupling is the classic god-object signature — the file both knows too much about the rest of the codebase and is too well-known by it. Any change here has blast radius in both directions: callers break if its interface shifts, and its own tests become impossible to run in isolation because of how many dependencies it pulls in. The most effective long-term fix is to identify the distinct concerns it serves and extract each into a focused module, breaking the fan-in and fan-out separately.`,
    },

    // ── High inbound bottleneck ─────────────────────────────────────────────

    {
      weight: 180,
      when:    (d) => !d.isLegacy && d.inbound >= 6 && d.outbound < 6,
      produce: (d) => `${d.name} is a structural bottleneck — ${d.inbound} other components depend on it, making it one of the most load-bearing files in the codebase. High inbound degree means the interface it exposes has become a de facto contract across the project. Any signature change, even a safe refactor, must account for every caller. The practical concern is not that the file is poorly written, but that its centrality creates coordination overhead: developers working in unrelated areas must reason about it, and bugs here have an unusually wide blast radius. Introducing a facade or splitting it by responsibility domain would reduce the coupling surface without breaking callers immediately.`,
    },

    // ── High outbound orchestrator ──────────────────────────────────────────

    {
      weight: 170,
      when:    (d) => !d.isLegacy && d.outbound >= 6 && d.inbound < 6,
      produce: (d) => `${d.name} has ${d.outbound} outbound dependencies, making it one of the heaviest orchestrators in the codebase. High outbound count means this file imports from or calls a large portion of the system — it effectively knows about everything. The problem this creates is not structural breakage but cognitive load: understanding what this file does requires understanding all ${d.outbound} of its dependencies first. It also tends to become a dumping ground for new logic because "it already imports everything." Decomposing its responsibilities into smaller coordinators, each with a narrower set of dependencies, would reduce this load and make the individual pieces more testable.`,
    },

    // ── Moderate god object ─────────────────────────────────────────────────

    {
      weight: 160,
      when:    (d) => !d.isLegacy && d.inbound >= 3 && d.outbound >= 3,
      produce: (d) => `${d.name} shows early god-object characteristics with ${d.inbound} inbound and ${d.outbound} outbound connections. It is not yet a structural crisis, but the coupling is bidirectional — it is both a dependency and a dependent — which limits how independently it can evolve. The pattern typically accelerates: files at the intersection of many concerns attract more concerns over time. Worth monitoring and keeping a note that the next significant change to this file is a good opportunity to extract a focused concern rather than adding to it.`,
    },

    // ── Moderate inbound only ───────────────────────────────────────────────

    {
      weight: 100,
      when:    (d) => !d.isLegacy && d.inbound >= 3,
      produce: (d) => `${d.name} is depended on by ${d.inbound} other components, which means changes to it carry meaningful blast radius. It is not an extreme case, but its position in the graph warrants care: adding responsibilities here makes it progressively harder to reason about, and removing functionality risks breaking callers that may not be obvious from a local view. When working in this file, check the dependency graph before changing signatures.`,
    },

    // ── Fallback ────────────────────────────────────────────────────────────

    {
      weight: 1,
      when:    () => true,
      produce: (d) => `${d.name} was flagged as a debt hotspot: ${d.reason} Changes here carry higher-than-average risk and warrant review before modification.`,
    },

  ];

  _pick(conditions, data) {
    const matching = conditions
      .filter(c => c.when(data))
      .sort((a, b) => b.weight - a.weight);
    return matching[0]?.produce(data) ?? null;
  }
}

module.exports = { DebtHotspotNarrativeEngine };
