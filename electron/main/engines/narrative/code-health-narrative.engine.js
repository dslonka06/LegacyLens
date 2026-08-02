/**
 * CodeHealthNarrativeEngine — heuristic interpretation text for the right
 * panel of the Code Health card on the System Understanding page.
 *
 * Produces a single paragraph explaining what the health metrics mean
 * for THIS specific target — not generic advice but a reading of the
 * combination of complexity, maintainability, riskCount, and scope.
 *
 * All inputs available at end of derive stage. No LLM required.
 *
 * Input shape:
 *   {
 *     scope:              'file' | 'folder' | 'repository',
 *     name:               string,
 *     complexity:         'Low' | 'Medium' | 'High',
 *     maintainability:    'Low' | 'Medium' | 'High',
 *     riskCount:          number,
 *     fileCount:          number,     // folder/repo: number of files
 *     // Optional — only present when architecture stage has completed (two-pass enrichment)
 *     hubCount?:          number,
 *     couplingAssessment?: 'Low' | 'Moderate' | 'High' | 'Critical',
 *     circularDependencyCount?: number,
 *   }
 */

class CodeHealthNarrativeEngine {

  build(data) {
    return this._pick(this._conditions, data) ?? '';
  }

  _conditions = [

    // ── Worst case: all three degraded ───────────────────────────────────────

    {
      weight: 200,
      when:    (d) => d.complexity === 'High' && d.maintainability === 'Low' && d.riskCount > 2,
      produce: (d) => `${d.name} is showing strain across every health dimension. High complexity means the internal structure is tightly coupled and hard to follow; low maintainability means changes are brittle and likely to cause unintended side effects; and ${d.riskCount} flagged risks compound the picture. This is a codebase area that needs deliberate attention before new features are added — understanding the existing structure thoroughly is the safest path forward.`,
    },

    // ── High complexity + low maintainability ────────────────────────────────

    {
      weight: 190,
      when:    (d) => d.complexity === 'High' && d.maintainability === 'Low',
      produce: (d) => `The combination of high complexity and low maintainability is the most common precursor to regression-heavy development. In ${d.name}, this means the code is both hard to reason about and fragile to modify — changes in one area have a higher-than-average chance of breaking something elsewhere. Refactoring toward smaller, more cohesive units would improve both dimensions simultaneously.`,
    },

    // ── High complexity + high maintainability ───────────────────────────────

    {
      weight: 180,
      when:    (d) => d.complexity === 'High' && d.maintainability === 'High',
      produce: (d) => `${d.name} is complex but well-structured. High complexity here reflects genuine domain or architectural complexity — not disorder — and the high maintainability score confirms the code has been kept organised despite that complexity. This is sophisticated code that rewards time spent understanding it before making changes, but it is not fragile.`,
    },

    // ── Low complexity + low maintainability ─────────────────────────────────

    {
      weight: 170,
      when:    (d) => d.complexity === 'Low' && d.maintainability === 'Low',
      produce: (d) => `${d.name} presents a counterintuitive health profile — complexity appears low, but maintainability is poor. This often indicates structural issues that coupling metrics alone don't capture: unclear naming, poor separation of concerns, or implicit dependencies that aren't visible in the dependency graph. The low complexity score shouldn't be taken as reassurance; the maintainability signal is the one to act on.`,
    },

    // ── High complexity + medium maintainability + risks ─────────────────────

    {
      weight: 160,
      when:    (d) => d.complexity === 'High' && d.maintainability === 'Medium' && d.riskCount > 0,
      produce: (d) => `${d.name} has high structural complexity with ${d.riskCount} flagged risk${d.riskCount !== 1 ? 's' : ''} and middling maintainability. The complexity is the primary driver of change risk here — tracing the full impact of a modification requires understanding a significant number of interconnections. The Data Flow and Architecture pages can help map those paths before committing to a change.`,
    },

    // ── High complexity only ──────────────────────────────────────────────────

    {
      weight: 150,
      when:    (d) => d.complexity === 'High',
      produce: (d) => `Complexity is the dominant health signal for ${d.name}. The internal structure has significant coupling, meaning that changes tend to have wider blast radii than they appear to. Maintainability is holding at ${(d.maintainability ?? 'medium').toLowerCase()}, which keeps the situation manageable — but reducing coupling over time would lower the cost of every future change.`,
    },

    // ── Low maintainability only ──────────────────────────────────────────────

    {
      weight: 140,
      when:    (d) => d.maintainability === 'Low',
      produce: (d) => `Maintainability is the weak point in ${d.name}'s health profile. Despite manageable complexity, the code is harder to change safely than it should be — likely due to high coupling between concerns, missing abstractions, or accumulated workarounds. Addressing maintainability proactively will reduce the risk of future changes causing regressions.`,
    },

    // ── Risks flagged but metrics healthy ────────────────────────────────────

    {
      weight: 130,
      when:    (d) => d.riskCount > 0 && d.complexity !== 'High' && d.maintainability !== 'Low',
      produce: (d) => `Complexity and maintainability metrics are both favourable for ${d.name}, but ${d.riskCount} structural risk${d.riskCount !== 1 ? 's were' : ' was'} flagged during analysis. The metrics suggest the code is well-structured; the risks likely represent specific patterns or edge cases that the aggregate scores don't capture. Worth reviewing before making changes in those areas.`,
    },

    // ── Medium across the board ──────────────────────────────────────────────

    {
      weight: 80,
      when:    (d) => d.complexity === 'Medium' && d.maintainability === 'Medium',
      produce: (d) => `${d.name} sits in the middle of the health range on both dimensions. Complexity is present but not excessive; maintainability is adequate but not pristine. This is a healthy baseline — the code is workable and changes are reasonably safe — but neither metric has significant headroom before it becomes a concern as the system grows.`,
    },

    // ── Clean: low complexity + high maintainability ─────────────────────────

    {
      weight: 70,
      when:    (d) => d.complexity === 'Low' && d.maintainability === 'High' && d.riskCount === 0,
      produce: (d) => `${d.name} has a clean health profile across all dimensions. Low complexity means the internal structure is easy to follow and changes have limited blast radius; high maintainability means the code is well-organised and safe to modify. No structural risks were flagged. This is one of the lower-risk areas of the codebase to work in.`,
    },

    // ── Low complexity + high maintainability but some risks ─────────────────

    {
      weight: 65,
      when:    (d) => d.complexity === 'Low' && d.maintainability === 'High',
      produce: (d) => `${d.name} scores well on both complexity and maintainability, though ${d.riskCount} risk${d.riskCount !== 1 ? 's were' : ' was'} identified. The structural fundamentals are sound — the risks are specific findings rather than systemic issues, and worth addressing individually rather than indicating deeper problems.`,
    },

    // ── Structural enrichment — only when architecture stage has completed ────

    {
      weight: 250,
      when:    (d) => d.couplingAssessment === 'Critical' && d.hubCount >= 3,
      produce: (d) => `${d.name} has a critical coupling profile: ${d.hubCount} hub nodes are each depended on by a disproportionate number of other modules, creating a structural bottleneck that amplifies the blast radius of every change. Combined with ${d.circularDependencyCount > 0 ? `${d.circularDependencyCount} circular dependencies and ` : ''}${d.complexity?.toLowerCase() ?? 'moderate'} complexity, this is the highest-risk structural configuration. Decomposing the hub nodes and breaking circular chains should be the first priority before adding new functionality.`,
    },

    {
      weight: 245,
      when:    (d) => d.couplingAssessment === 'Critical',
      produce: (d) => `Coupling has reached a critical level in ${d.name} — a significant proportion of the codebase routes through a small number of highly-connected nodes. Any change to these nodes has unpredictable downstream effects, and the cost of future features scales non-linearly with this coupling. Refactoring toward smaller, single-responsibility modules would break the dependency concentration and stabilise the change cost.`,
    },

    {
      weight: 240,
      when:    (d) => d.couplingAssessment === 'High' && d.circularDependencyCount >= 3,
      produce: (d) => `${d.name} has both high coupling and ${d.circularDependencyCount} circular dependency chains. The circular dependencies indicate that modules have become mutually aware of each other's internals, which prevents independent deployment and makes it hard to reason about initialisation order. High coupling compounds this — the affected modules are also the most-referenced in the graph, so fixing them has outsized positive impact.`,
    },

    {
      weight: 235,
      when:    (d) => d.couplingAssessment === 'High' && d.complexity === 'High',
      produce: (d) => `${d.name} scores high on both structural coupling and code complexity. High coupling means many modules share state or call chains through a small set of hubs; high complexity means those hubs are themselves hard to understand. This combination is the most maintenance-intensive profile — isolating the hub responsibilities into dedicated abstractions would improve both metrics simultaneously.`,
    },

    {
      weight: 230,
      when:    (d) => d.couplingAssessment === 'High' && d.hubCount > 0,
      produce: (d) => `${d.name} has high architectural coupling, concentrated across ${d.hubCount} hub node${d.hubCount !== 1 ? 's' : ''} that act as structural chokepoints. Changes near these hubs carry higher risk than the rest of the codebase, and the ${(d.complexity ?? 'moderate').toLowerCase()} complexity of the surrounding code means tracing the full impact of a modification requires careful path analysis.`,
    },

    {
      weight: 225,
      when:    (d) => d.circularDependencyCount >= 2 && d.complexity === 'High',
      produce: (d) => `${d.name} has ${d.circularDependencyCount} circular dependency chains intersecting with high code complexity. Circular dependencies are a signal that module boundaries have blurred — these modules know too much about each other. Resolving them typically involves extracting shared state into a dedicated dependency, which also tends to reduce complexity in the affected modules.`,
    },

    // ── Fallback ──────────────────────────────────────────────────────────────

    {
      weight: 1,
      when:    () => true,
      produce: (d) => `${d.name} shows ${(d.complexity ?? 'moderate').toLowerCase()} complexity and ${(d.maintainability ?? 'moderate').toLowerCase()} maintainability${d.riskCount > 0 ? ` with ${d.riskCount} flagged risk${d.riskCount !== 1 ? 's' : ''}` : ''}.`,
    },
  ];

  // ── Condition evaluator ───────────────────────────────────────────────────

  _pick(conditions, data) {
    const matching = conditions
      .filter(c => c.when(data))
      .sort((a, b) => b.weight - a.weight);
    return matching[0]?.produce(data) ?? null;
  }
}

module.exports = { CodeHealthNarrativeEngine };
