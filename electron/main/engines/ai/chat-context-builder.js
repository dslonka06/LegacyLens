/**
 * ChatContextBuilder — distils a KnowledgeModel into a compact context snapshot
 * suitable for inclusion in a chat system prompt.
 *
 * The full KnowledgeModel can be large. Dumping it into every chat request
 * wastes tokens and degrades answer quality. This builder selects only what
 * the LLM needs to answer workspace-level questions accurately.
 */

/**
 * @param {import('../../../../src/app/knowledge/models/knowledge-model.contract').KnowledgeModel} model
 * @returns {string} A compact plain-text context block for use as a system prompt addendum
 */
function buildChatContext(model) {
  if (!model) return '';

  const lines = [];

  // ── Identity ────────────────────────────────────────────────────────────
  lines.push(`Workspace: ${model.workspaceName ?? 'Unknown'}`);
  lines.push(`Type: ${model.targetType}`);

  // ── Structure ────────────────────────────────────────────────────────────
  const s = model.structure;
  if (s) {
    if (s.totalFiles) lines.push(`Files: ${s.totalFiles}`);
    if (s.languages?.length) lines.push(`Languages: ${s.languages.slice(0, 5).join(', ')}`);
    if (s.frameworks?.length) lines.push(`Frameworks: ${s.frameworks.slice(0, 5).join(', ')}`);
    if (s.technologies?.length) {
      const techs = s.technologies.slice(0, 8).map(t => t.technology ?? t).join(', ');
      lines.push(`Technologies: ${techs}`);
    }
  }

  // ── Architecture ─────────────────────────────────────────────────────────
  const patterns = model.relationships?.architecture?.patterns;
  if (patterns?.length) {
    const top = patterns
      .slice(0, 3)
      .map(p => p.name)
      .join(', ');
    lines.push(`Architecture patterns: ${top}`);
  }

  // ── AI understanding summary ──────────────────────────────────────────────
  const understanding = model.ai?.understanding;
  if (understanding) {
    if (understanding.executiveSummary) {
      lines.push(`\nSummary: ${understanding.executiveSummary}`);
    }
    if (understanding.businessPurpose) {
      lines.push(`Purpose: ${understanding.businessPurpose}`);
    }
    if (understanding.keyAreas?.length) {
      lines.push(`Key areas: ${understanding.keyAreas.slice(0, 5).join(', ')}`);
    }
  }

  // ── Security ──────────────────────────────────────────────────────────────
  const security = model.ai?.security;
  if (security) {
    if (security.overallRisk) lines.push(`Security risk: ${security.overallRisk}`);
    if (security.securityMaturity) lines.push(`Security maturity: ${security.securityMaturity}`);
    const findings = security.findings ?? [];
    if (findings.length > 0) {
      const byCat = {};
      for (const f of findings) {
        byCat[f.severity] = (byCat[f.severity] ?? 0) + 1;
      }
      const summary = Object.entries(byCat)
        .map(([sev, n]) => `${n} ${sev}`)
        .join(', ');
      lines.push(`Security findings: ${findings.length} total (${summary})`);
      const critical = findings.filter(f => f.severity === 'critical' || f.severity === 'high').slice(0, 3);
      if (critical.length) {
        lines.push(`Top findings: ${critical.map(f => f.title).join('; ')}`);
      }
    }
  }

  // ── Data flow ─────────────────────────────────────────────────────────────
  const dataFlow = model.ai?.dataFlow;
  if (dataFlow) {
    if (dataFlow.inputs?.length) {
      lines.push(`Data inputs: ${dataFlow.inputs.slice(0, 5).map(i => i.name ?? i).join(', ')}`);
    }
    if (dataFlow.outputs?.length) {
      lines.push(`Data outputs: ${dataFlow.outputs.slice(0, 5).map(o => o.name ?? o).join(', ')}`);
    }
    if (dataFlow.pattern) lines.push(`Data flow pattern: ${dataFlow.pattern}`);
    const workflows = dataFlow.primaryWorkflows;
    if (workflows?.length) {
      const wfNames = workflows.slice(0, 4).map(w => w.workflowName ?? w.name ?? w).join(', ');
      lines.push(`Primary workflows: ${wfNames}`);
    }
  }

  // ── Recommendations ───────────────────────────────────────────────────────
  const recs = model.ai?.recommendations;
  if (recs) {
    const allRecs = recs.recommendations ?? [];
    if (allRecs.length > 0) {
      const topRecs = allRecs
        .filter(r => r.priority === 'High' || r.priority === 'Critical')
        .slice(0, 3)
        .map(r => r.title ?? r.recommendation);
      if (topRecs.length) lines.push(`Top recommendations: ${topRecs.join('; ')}`);
    }
    if (recs.debtContext) lines.push(`Technical debt: ${recs.debtContext}`);
  }

  // ── Top-level symbols (file target only) ─────────────────────────────────
  if (model.targetType === 'file' && s?.sourceCode) {
    const symbols = Object.values(s.symbols ?? {})[0];
    if (symbols) {
      if (symbols.classes?.length) lines.push(`Classes: ${symbols.classes.slice(0, 5).join(', ')}`);
      if (symbols.methods?.length) lines.push(`Methods: ${symbols.methods.slice(0, 8).join(', ')}`);
    }
  }

  // ── Dependency hubs (most-connected files) ────────────────────────────────
  const hubs = model.relationships?.dependencies?.hubs;
  if (hubs?.length) {
    const hubNames = hubs.slice(0, 5).map(h => h.name).join(', ');
    const totalDeps = model.relationships?.dependencies?.totalDependencies;
    lines.push(`Central files: ${hubNames}${totalDeps ? ` (${totalDeps} total dependencies)` : ''}`);
  }

  return lines.join('\n');
}

module.exports = { buildChatContext };
