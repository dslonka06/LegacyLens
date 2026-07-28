/**
 * HubNarrativeEngine — condition-driven narrative builder for the hub header panel.
 *
 * Generates prose in two passes:
 *   Pass 1 (structural — available immediately after derive):
 *     - role/importance sentence
 *     - metrics interpretation sentence
 *     - structural counts sentence
 *   Pass 2 (directive — appended once security + recommendations AI stages complete):
 *     - one sentence citing security finding count, recommendation count, and directing
 *       the user to the highest-priority next page
 *
 * Each sentence slot is a prioritized list of NarrativeConditions. The highest-weight
 * matching condition fires. Different conditions produce structurally different sentences —
 * not the same template with swapped values.
 *
 * NarrativeCondition shape:
 *   { when: (data) => boolean, weight: number, produce: (data) => string }
 */

class HubNarrativeEngine {

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Pass 1 — structural narrative. Call immediately after derive stage completes.
   * @param {object} data - { inboundDeps, outboundDeps, complexity, maintainability,
   *                          riskCount, symbolCount, flowSteps, scope, fileName,
   *                          fileCount, couplingRatio, architecturePatterns }
   * @returns {string}
   */
  buildStructural(data) {
    const role       = this._pick(this._roleConditions,    data);
    const metrics    = this._pick(this._metricsConditions, data);
    const structural = this._pick(this._structuralConditions, data);

    return [role, metrics, structural].filter(Boolean).join(' ');
  }

  /**
   * Pass 2 — directive sentence. Call once both security + recommendations stages complete.
   * Appends to (or replaces the last sentence of) the structural narrative.
   * @param {object} data - { securityCount, securityHasCritical, securityHasHigh,
   *                          recommendationCount, scope }
   * @returns {string}
   */
  buildDirective(data) {
    return this._pick(this._directiveConditions, data) ?? '';
  }

  // ── Sentence slot: Role / Importance ─────────────────────────────────────

  _roleConditions = [
    {
      // High inbound + critical health — load-bearing and broken
      weight: 100,
      when: (d) => d.inboundDeps >= 5 && (d.complexity === 'High' || d.maintainability === 'Low'),
      produce: (d) => `${d.fileName} is a load-bearing ${d.scope} — depended on by ${d.inboundDeps} components — and its current health signals make it high risk to modify without careful review.`,
    },
    {
      // High inbound + healthy — central and stable
      weight: 90,
      when: (d) => d.inboundDeps >= 5 && d.complexity !== 'High' && d.maintainability !== 'Low',
      produce: (d) => `${d.fileName} sits at the center of ${d.inboundDeps} dependencies and is in good structural health — stable, but changes here propagate widely across the codebase.`,
    },
    {
      // Moderate inbound + degraded health
      weight: 80,
      when: (d) => d.inboundDeps >= 2 && d.inboundDeps < 5 && (d.complexity === 'High' || d.maintainability === 'Low'),
      produce: (d) => `${d.fileName} is connected to ${d.inboundDeps} other components and shows signs of accumulated complexity — worth understanding before extending.`,
    },
    {
      // Moderate inbound + healthy
      weight: 70,
      when: (d) => d.inboundDeps >= 2 && d.inboundDeps < 5,
      produce: (d) => `${d.fileName} is a moderately connected ${d.scope} with ${d.inboundDeps} inbound dependencies — changes are contained but not isolated.`,
    },
    {
      // Isolated + complex — encapsulated but dense
      weight: 60,
      when: (d) => d.inboundDeps < 2 && d.complexity === 'High',
      produce: (d) => `${d.fileName} is largely self-contained with minimal external dependencies, but its internal complexity is high — changes are low blast-radius but non-trivial to make safely.`,
    },
    {
      // Isolated + healthy — clean leaf node
      weight: 50,
      when: (d) => d.inboundDeps < 2 && d.complexity !== 'High' && d.maintainability !== 'Low',
      produce: (d) => `${d.fileName} is a well-contained, healthy ${d.scope} with limited blast radius — one of the lower-risk areas of the codebase to work in.`,
    },
    {
      // Folder/repo: large + tightly coupled
      weight: 85,
      when: (d) => d.scope !== 'file' && d.fileCount >= 50 && d.couplingRatio > 3,
      produce: (d) => `This ${d.scope} spans ${d.fileCount} files with an average coupling ratio of ${d.couplingRatio.toFixed(1)} — changes propagate broadly, making it important to understand the dependency structure before making modifications.`,
    },
    {
      // Folder/repo: moderate size
      weight: 55,
      when: (d) => d.scope !== 'file' && d.fileCount >= 10,
      produce: (d) => `This ${d.scope} contains ${d.fileCount} files${d.architecturePatterns?.length ? ` following a ${d.architecturePatterns[0]} architecture` : ''} — a discrete area of the codebase with defined responsibilities.`,
    },
    {
      // Fallback
      weight: 1,
      when: () => true,
      produce: (d) => `${d.fileName ?? 'This'} is a ${d.scope} in the analyzed codebase.`,
    },
  ];

  // ── Sentence slot: Metrics Interpretation ────────────────────────────────

  _metricsConditions = [
    {
      // Crisis: high complexity + low maintainability
      weight: 100,
      when: (d) => d.complexity === 'High' && d.maintainability === 'Low',
      produce: () => `Complexity is high and maintainability is low — this combination typically indicates accumulated debt where the code is both hard to follow and brittle to change.`,
    },
    {
      // Paradox: high complexity + high maintainability — sophisticated but clean
      weight: 90,
      when: (d) => d.complexity === 'High' && d.maintainability === 'High',
      produce: () => `Despite high complexity, maintainability is strong — this is sophisticated code that has been kept well-structured, likely through deliberate design.`,
    },
    {
      // Hidden issue: low complexity + low maintainability
      weight: 85,
      when: (d) => d.complexity !== 'High' && d.maintainability === 'Low',
      produce: () => `Complexity appears manageable but maintainability is low — structural issues may not be immediately obvious from coupling alone, but the code is harder to change safely than it looks.`,
    },
    {
      // With risks: any degraded + issues found
      weight: 80,
      when: (d) => d.riskCount > 0 && (d.complexity === 'High' || d.maintainability === 'Low'),
      produce: (d) => `${d.riskCount} structural risk${d.riskCount !== 1 ? 's were' : ' was'} flagged alongside degraded health metrics — these compound each other and should be reviewed together.`,
    },
    {
      // Medium complexity + medium maintainability — middle ground
      weight: 60,
      when: (d) => d.complexity === 'Medium' && d.maintainability === 'Medium',
      produce: () => `Complexity and maintainability are both in the middle range — manageable now, but worth monitoring as the codebase grows.`,
    },
    {
      // Clean: low complexity + high maintainability
      weight: 50,
      when: (d) => d.complexity === 'Low' && d.maintainability === 'High' && d.riskCount === 0,
      produce: () => `All structural health signals are green — low complexity, high maintainability, and no flagged risks. This is straightforward, well-maintained code.`,
    },
    {
      // Clean but some risks
      weight: 45,
      when: (d) => d.complexity === 'Low' && d.maintainability === 'High' && d.riskCount > 0,
      produce: (d) => `Structural health is good, but ${d.riskCount} risk finding${d.riskCount !== 1 ? 's were' : ' was'} identified — the code is clean but not without concerns.`,
    },
    {
      // Fallback
      weight: 1,
      when: () => true,
      produce: (d) => `Complexity is ${d.complexity?.toLowerCase() ?? 'unknown'} and maintainability is ${d.maintainability?.toLowerCase() ?? 'unknown'}.`,
    },
  ];

  // ── Sentence slot: Structural Counts ─────────────────────────────────────

  _structuralConditions = [
    {
      // File scope: symbols + flow steps
      weight: 80,
      when: (d) => d.scope === 'file' && d.symbolCount > 0 && d.flowSteps > 0,
      produce: (d) => `${d.symbolCount} symbol${d.symbolCount !== 1 ? 's are' : ' is'} defined across ${d.flowSteps} data flow step${d.flowSteps !== 1 ? 's' : ''} — the Data Flow and System Understanding pages map these in detail.`,
    },
    {
      // File scope: symbols only
      weight: 70,
      when: (d) => d.scope === 'file' && d.symbolCount > 0,
      produce: (d) => `${d.symbolCount} symbol${d.symbolCount !== 1 ? 's are' : ' is'} defined — the System Understanding page breaks down what each one does.`,
    },
    {
      // File scope: deps + symbols
      weight: 75,
      when: (d) => d.scope === 'file' && d.outboundDeps > 0 && d.symbolCount > 0,
      produce: (d) => `It declares ${d.symbolCount} symbol${d.symbolCount !== 1 ? 's' : ''} and pulls in ${d.outboundDeps} dependenc${d.outboundDeps !== 1 ? 'ies' : 'y'} — the Data Flow page traces how inputs move through them.`,
    },
    {
      // Folder/repo: patterns + deps
      weight: 80,
      when: (d) => d.scope !== 'file' && d.architecturePatterns?.length > 0 && d.inboundDeps > 0,
      produce: (d) => `${d.architecturePatterns.length} architectural pattern${d.architecturePatterns.length !== 1 ? 's were' : ' was'} detected across ${d.fileCount} files with ${d.inboundDeps} dependency relationships — the Architecture and Data Flow pages map the full structure.`,
    },
    {
      // Folder/repo: deps only
      weight: 60,
      when: (d) => d.scope !== 'file' && d.inboundDeps > 0,
      produce: (d) => `${d.inboundDeps} dependency relationship${d.inboundDeps !== 1 ? 's connect' : ' connects'} components across this ${d.scope} — the Architecture page shows how they fit together.`,
    },
    {
      // Fallback
      weight: 1,
      when: () => true,
      produce: () => `The Data Flow and System Understanding pages provide a deeper breakdown of the structure.`,
    },
  ];

  // ── Sentence slot: Directive (pass 2) ────────────────────────────────────

  _directiveConditions = [
    {
      // Critical security findings — security is highest priority
      weight: 100,
      when: (d) => d.securityHasCritical && d.recommendationCount > 0,
      produce: (d) => `${d.securityCount} security issue${d.securityCount !== 1 ? 's were' : ' was'} found including critical findings, and ${d.recommendationCount} code change${d.recommendationCount !== 1 ? 's are' : ' is'} recommended — the Security page is the highest priority next step.`,
    },
    {
      // Critical security, no recs
      weight: 95,
      when: (d) => d.securityHasCritical,
      produce: (d) => `${d.securityCount} security issue${d.securityCount !== 1 ? 's were' : ' was'} found including critical findings — review the Security page before making any changes.`,
    },
    {
      // High security findings + recs
      weight: 85,
      when: (d) => d.securityHasHigh && d.recommendationCount > 0,
      produce: (d) => `${d.securityCount} security issue${d.securityCount !== 1 ? 's' : ''} and ${d.recommendationCount} recommendation${d.recommendationCount !== 1 ? 's were' : ' was'} surfaced — start with Security, then review Code Changes for improvement opportunities.`,
    },
    {
      // High security, no recs
      weight: 80,
      when: (d) => d.securityHasHigh,
      produce: (d) => `${d.securityCount} security issue${d.securityCount !== 1 ? 's were' : ' was'} found with high-severity findings — the Security page is the recommended next step.`,
    },
    {
      // Low security findings + recs
      weight: 70,
      when: (d) => d.securityCount > 0 && d.recommendationCount > 0,
      produce: (d) => `${d.securityCount} lower-severity security finding${d.securityCount !== 1 ? 's' : ''} and ${d.recommendationCount} recommendation${d.recommendationCount !== 1 ? 's were' : ' was'} identified — neither critical, but worth reviewing in Code Changes and Security.`,
    },
    {
      // Security only, no recs
      weight: 65,
      when: (d) => d.securityCount > 0 && d.recommendationCount === 0,
      produce: (d) => `${d.securityCount} security finding${d.securityCount !== 1 ? 's were' : ' was'} surfaced — none critical, but the Security page is worth a look.`,
    },
    {
      // Recs only, no security
      weight: 60,
      when: (d) => d.securityCount === 0 && d.recommendationCount > 0,
      produce: (d) => `No security issues were found. ${d.recommendationCount} code change recommendation${d.recommendationCount !== 1 ? 's are' : ' is'} available in the Code Changes page.`,
    },
    {
      // Both clean
      weight: 50,
      when: (d) => d.securityCount === 0 && d.recommendationCount === 0,
      produce: () => `Analysis is clean — no security issues and no recommendations flagged.`,
    },
    {
      // Fallback
      weight: 1,
      when: () => true,
      produce: () => `Review the Security and Code Changes pages for the full breakdown.`,
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

module.exports = { HubNarrativeEngine };
