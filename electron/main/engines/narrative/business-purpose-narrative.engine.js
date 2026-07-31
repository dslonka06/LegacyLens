/**
 * BusinessPurposeNarrativeEngine — heuristic "so what" text for the
 * Business Purpose card on the System Understanding page.
 *
 * Sits below the AI-generated businessPurpose string and adds context:
 *   1. Criticality framing  — how important this is to the business and why
 *   2. Responsibility shape — what it owns and how focused vs broad that is
 *   3. Health consequence   — what the current metrics mean for the business
 *
 * All inputs available at end of derive stage. No LLM required.
 *
 * Input shape:
 *   {
 *     scope:                     'file' | 'folder' | 'repository',
 *     name:                      string,
 *     businessCriticality:       'Critical' | 'High' | 'Medium' | 'Low',
 *     businessCriticalityReason: string,
 *     responsibilityCount:       number,
 *     capabilityCount:           number,
 *     complexity:                'Low' | 'Medium' | 'High',
 *     maintainability:           'Low' | 'Medium' | 'High',
 *     riskCount:                 number,
 *   }
 */

class BusinessPurposeNarrativeEngine {

  build(data) {
    const criticality    = this._pick(this._criticalityConditions,    data);
    const responsibility = this._pick(this._responsibilityConditions, data);
    const health         = this._pick(this._healthConditions,         data);
    return [criticality, responsibility, health].filter(Boolean).join(' ');
  }

  // ── Sentence 1: Criticality framing ──────────────────────────────────────

  _criticalityConditions = [
    {
      weight: 100,
      when:    (d) => d.businessCriticality === 'Critical',
      produce: (d) => `${d.name} is business-critical${d.businessCriticalityReason ? ' — ' + d.businessCriticalityReason : ''}.`,
    },
    {
      weight: 80,
      when:    (d) => d.businessCriticality === 'High',
      produce: (d) => `${d.name} carries high business importance${d.businessCriticalityReason ? ': ' + d.businessCriticalityReason : ''}.`,
    },
    {
      weight: 60,
      when:    (d) => d.businessCriticality === 'Medium',
      produce: (d) => `${d.name} plays a supporting role in the system${d.businessCriticalityReason ? ' — ' + d.businessCriticalityReason : ''}.`,
    },
    {
      weight: 40,
      when:    (d) => d.businessCriticality === 'Low',
      produce: (d) => `${d.name} is a lower-priority area of the codebase${d.businessCriticalityReason ? ', though ' + d.businessCriticalityReason : ''}.`,
    },
    {
      weight: 1,
      when:    () => true,
      produce: (d) => `${d.name} serves a defined role in the system.`,
    },
  ];

  // ── Sentence 2: Responsibility shape ─────────────────────────────────────

  _responsibilityConditions = [
    {
      // Broad surface: many responsibilities and capabilities
      weight: 100,
      when:    (d) => d.responsibilityCount >= 4 && d.capabilityCount >= 4,
      produce: (d) => `It owns ${d.responsibilityCount} distinct responsibilities across ${d.capabilityCount} capabilities — a broad surface that makes it one of the heavier components to reason about.`,
    },
    {
      // Wide ownership, fewer capabilities
      weight: 90,
      when:    (d) => d.responsibilityCount >= 4,
      produce: (d) => `It spans ${d.responsibilityCount} responsibilities — a wide ownership surface where understanding how they interact is key before making changes.`,
    },
    {
      // Single focused responsibility — clean, narrow scope
      weight: 85,
      when:    (d) => d.responsibilityCount === 1 && d.capabilityCount <= 2,
      produce: (d) => `It has a single, focused responsibility${d.capabilityCount > 0 ? ' with ' + d.capabilityCount + ' supporting ' + (d.capabilityCount === 1 ? 'capability' : 'capabilities') : ''} — a clean, narrow scope that is easy to reason about in isolation.`,
    },
    {
      // Balanced: two or three responsibilities with capabilities
      weight: 70,
      when:    (d) => d.responsibilityCount >= 2 && d.responsibilityCount <= 3 && d.capabilityCount >= 2,
      produce: (d) => `It holds ${d.responsibilityCount} responsibilities backed by ${d.capabilityCount} capabilities — well-scoped without being too narrow.`,
    },
    {
      // Two or three responsibilities, no capability data
      weight: 60,
      when:    (d) => d.responsibilityCount >= 2 && d.responsibilityCount <= 3,
      produce: (d) => `It covers ${d.responsibilityCount} responsibilities — a manageable scope that is neither too scattered nor too specialised.`,
    },
    {
      // Folder/repo with large capability footprint
      weight: 75,
      when:    (d) => d.scope !== 'file' && d.capabilityCount >= 5,
      produce: (d) => `Across its ${d.responsibilityCount} responsibility areas it exposes ${d.capabilityCount} distinct capabilities — a significant footprint within the broader system.`,
    },
    {
      weight: 1,
      when:    () => true,
      produce: () => `Its responsibilities define a clear area of ownership within the system.`,
    },
  ];

  // ── Sentence 3: Health consequence ───────────────────────────────────────

  _healthConditions = [
    {
      // Critical + worst-case health
      weight: 100,
      when:    (d) => d.businessCriticality === 'Critical' && d.complexity === 'High' && d.maintainability === 'Low',
      produce: () => `Given its criticality, high complexity and low maintainability together represent significant business risk — changes here carry elevated likelihood of regression.`,
    },
    {
      // Critical + one degraded axis
      weight: 90,
      when:    (d) => d.businessCriticality === 'Critical' && (d.complexity === 'High' || d.maintainability === 'Low'),
      produce: (d) => `Its business criticality amplifies the impact of its ${d.complexity === 'High' ? 'high complexity' : 'low maintainability'} — technical debt here translates directly to business risk.`,
    },
    {
      // High criticality + clean health — reassuring
      weight: 85,
      when:    (d) => (d.businessCriticality === 'Critical' || d.businessCriticality === 'High') && d.complexity !== 'High' && d.maintainability !== 'Low' && d.riskCount === 0,
      produce: () => `Despite its importance, structural health is sound — complexity is under control and no risks have been flagged, making it safer to work in than its criticality might suggest.`,
    },
    {
      // High criticality + risks flagged
      weight: 80,
      when:    (d) => (d.businessCriticality === 'Critical' || d.businessCriticality === 'High') && d.riskCount > 0,
      produce: (d) => `${d.riskCount} structural risk${d.riskCount !== 1 ? 's have' : ' has'} been flagged — given its business importance, these warrant review before proceeding with changes.`,
    },
    {
      // Lower criticality + bad health — debt to schedule, not panic
      weight: 70,
      when:    (d) => (d.businessCriticality === 'Medium' || d.businessCriticality === 'Low') && d.complexity === 'High' && d.maintainability === 'Low',
      produce: () => `Complexity is high and maintainability is low, though its lower criticality means this is technical debt to schedule rather than an immediate priority.`,
    },
    {
      // Clean bill of health
      weight: 50,
      when:    (d) => d.complexity === 'Low' && d.maintainability === 'High' && d.riskCount === 0,
      produce: () => `Structural health is excellent across all metrics — well-maintained code with no flagged risks.`,
    },
    {
      // Middle ground
      weight: 40,
      when:    (d) => d.complexity === 'Medium' && d.maintainability === 'Medium',
      produce: () => `Structural health is in the middle range — no immediate concerns, but worth monitoring as the codebase evolves.`,
    },
    {
      weight: 1,
      when:    () => true,
      produce: (d) => `Current health shows ${(d.complexity ?? 'moderate').toLowerCase()} complexity and ${(d.maintainability ?? 'moderate').toLowerCase()} maintainability.`,
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

module.exports = { BusinessPurposeNarrativeEngine };
