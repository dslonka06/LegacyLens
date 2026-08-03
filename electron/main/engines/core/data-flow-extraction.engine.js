'use strict';

// ── Verb detection patterns ───────────────────────────────────────────────────
// Checked in priority order against `this.<instanceName>.<method>(` calls.

const VERB_RULES = [
  { verb: 'reads',     pattern: /\.(?:get|find|fetch|load|read|query|select|list|retrieve)\w*\s*\(/ },
  { verb: 'writes',    pattern: /\.(?:save|create|add|insert|write|post|persist|store|put)\w*\s*\(/ },
  { verb: 'updates',   pattern: /\.(?:update|patch|merge|edit|modify|replace)\w*\s*\(/ },
  { verb: 'deletes',   pattern: /\.(?:delete|remove|destroy|drop|clear|purge)\w*\s*\(/ },
  { verb: 'publishes', pattern: /\.(?:send|publish|emit|next|dispatch|broadcast|notify|trigger)\w*\s*\(/ },
  { verb: 'navigates', pattern: /\.(?:navigate|redirect|route|go)\w*\s*\(/ },
];

// ── File-role content signals ─────────────────────────────────────────────────
// Priority order matters — check most-specific first.

const ROLE_SIGNALS = [
  { role: 'controller',   pattern: /@Controller\b|@Get\(|@Post\(|@Put\(|@Delete\(|@Patch\(|\[ApiController\]|\[HttpGet\]|\[HttpPost\]/ },
  { role: 'component',    pattern: /@Component\s*\(/ },
  { role: 'http-client',  pattern: /\bHttpClient\b/ },
  { role: 'state-store',  pattern: /\bBehaviorSubject\b|\bReplaySubject\b|\bSubject\b/ },
  { role: 'repository',   pattern: /\bRepository\b|\bDbContext\b|\bDbSet\b|EntityFramework/ },
  { role: 'service',      pattern: /@Injectable\s*\(|providedIn/ },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function allMatches(regex, text) {
  const results = [];
  const r = new RegExp(regex.source, regex.flags);
  let m;
  while ((m = r.exec(text)) !== null) {
    if (m[1] && !results.includes(m[1])) results.push(m[1]);
  }
  return results;
}

/**
 * Derive a camelCase instance-name guess from an import path.
 * "src/services/order.service.ts" → "orderService"
 * "user-repository"               → "userRepository"
 * Returns null when the name is too short to be useful.
 */
function guessInstanceName(importPath) {
  const base = importPath
    .split('/')
    .pop()
    .replace(/\.[^.]+$/, '')          // strip extension
    .replace(/[-_](\w)/g, (_, c) => c.toUpperCase()); // kebab/snake → camelCase

  // Too short to be a meaningful instance name (avoids false positives on 'db', 'fs', etc.)
  if (base.length < 4) return null;

  // Lowercase first char
  return base.charAt(0).toLowerCase() + base.slice(1);
}

/**
 * Infer the interaction verb between the current file and an import target.
 * Scans `content` for calls on the guessed instance name of the target.
 */
function inferVerb(importPath, content) {
  const instanceName = guessInstanceName(importPath);
  if (!instanceName) return 'calls';

  // Build a pattern that matches `this.instanceName.someMethod(`
  // Escape any regex-special chars in the instance name
  const escapedName = instanceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const prefix = new RegExp(`(?:this\\.)?${escapedName}\\.`, 'i');

  // Only search within sections of content that reference this instance name
  if (!prefix.test(content)) return 'calls';

  for (const { verb, pattern } of VERB_RULES) {
    // Combine: instance name must appear near the verb pattern
    const combined = new RegExp(
      `(?:this\\.)?${escapedName}${pattern.source}`,
      'i',
    );
    if (combined.test(content)) return verb;
  }

  return 'calls';
}

/**
 * Extract source signals from file content.
 * Returns human-readable labels like '@Input()', 'HTTP GET', 'HTTP POST'.
 */
function extractSources(content) {
  const sources = [];

  if (/@Input\s*\(/.test(content)) sources.push('@Input()');

  const httpVerbs = [
    { pattern: /@Get\s*\(|\[HttpGet\]/, label: 'HTTP GET' },
    { pattern: /@Post\s*\(|\[HttpPost\]/, label: 'HTTP POST' },
    { pattern: /@Put\s*\(|\[HttpPut\]/, label: 'HTTP PUT' },
    { pattern: /@Delete\s*\(|\[HttpDelete\]/, label: 'HTTP DELETE' },
    { pattern: /@Patch\s*\(|\[HttpPatch\]/, label: 'HTTP PATCH' },
  ];
  for (const { pattern, label } of httpVerbs) {
    if (pattern.test(content)) sources.push(label);
  }

  if (/localStorage\.getItem/.test(content)) sources.push('localStorage');
  if (/sessionStorage\.getItem/.test(content)) sources.push('sessionStorage');
  if (/ActivatedRoute|this\.route\./.test(content)) sources.push('Route params');

  return sources;
}

/**
 * Extract sink signals from file content.
 */
function extractSinks(content) {
  const sinks = [];

  if (/@Output\s*\(/.test(content)) sinks.push('@Output()');
  if (/\.navigate\s*\(/.test(content)) sinks.push('Router navigation');
  if (/localStorage\.setItem/.test(content)) sinks.push('localStorage write');
  if (/sessionStorage\.setItem/.test(content)) sinks.push('sessionStorage write');
  if (/\.emit\s*\(/.test(content)) sinks.push('EventEmitter.emit()');
  if (/\.next\s*\(/.test(content) && /Subject/.test(content)) sinks.push('Subject.next()');

  return sinks;
}

/**
 * Classify file role from content signals.
 * Name-based fallback when no content signal matches.
 */
function classifyRole(file) {
  const content = file.content ?? '';

  for (const { role, pattern } of ROLE_SIGNALS) {
    if (pattern.test(content)) return role;
  }

  // Name-based fallback
  const nameLower = (file.name ?? '').toLowerCase();
  if (/repository|\.repo\./.test(nameLower)) return 'repository';
  if (/service/.test(nameLower)) return 'service';
  if (/controller/.test(nameLower)) return 'controller';
  if (/component/.test(nameLower)) return 'component';

  return 'unknown';
}

// ── Engine ────────────────────────────────────────────────────────────────────

class DataFlowExtractionEngine {

  /**
   * Extract per-file data flow facts from parsed files.
   *
   * @param {Array<{name, path, extension, language, imports, content, parseError}>} parsedFiles
   * @returns {Array<DataFlowFact>}
   */
  extract(parsedFiles) {
    if (!Array.isArray(parsedFiles) || parsedFiles.length === 0) return [];

    return parsedFiles
      .filter(pf => !pf.parseError)
      .map(pf => this._extractFile(pf));
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _extractFile(pf) {
    const content = pf.content ?? '';

    const fileRole         = classifyRole(pf);
    const sources          = extractSources(content);
    const sinks            = extractSinks(content);
    const interactionVerbs = this._extractVerbs(pf.imports ?? [], content);

    return {
      path: pf.path,
      fileRole,
      sources,
      sinks,
      interactionVerbs,
    };
  }

  /**
   * Build a map of importPath → verb for each import this file makes.
   * Only includes imports where we can resolve a verb more specific than 'calls'.
   */
  _extractVerbs(imports, content) {
    const verbs = {};

    for (const importPath of imports) {
      if (!importPath || typeof importPath !== 'string') continue;
      const verb = inferVerb(importPath, content);
      // Store all verbs — even 'calls' is useful for diagram edge labels
      verbs[importPath] = verb;
    }

    return verbs;
  }
}

module.exports = { DataFlowExtractionEngine };
