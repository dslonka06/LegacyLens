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

  // ── Security headline ─────────────────────────────────────────────────────
  const security = model.ai?.security;
  if (security?.riskLevel && security.riskLevel !== 'low') {
    lines.push(`Security risk level: ${security.riskLevel}`);
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
    lines.push(`Central files: ${hubNames}`);
  }

  return lines.join('\n');
}

module.exports = { buildChatContext };
