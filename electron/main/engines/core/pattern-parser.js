'use strict';

const { ICodeParser } = require('./i-code-parser');
const { AnalysisEngine } = require('../analysis/analysis.engine');

// Patterns for extracting structural elements from source text.
// These cover the languages AnalysisEngine already supports: TypeScript, C#, SQL.

const TS_CLASS    = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g;
const TS_IFACE    = /(?:export\s+)?interface\s+(\w+)/g;
const TS_FUNC     = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
const TS_METHOD   = /(?:public|private|protected|async|static|\s)+(\w+)\s*\([^)]*\)\s*(?::\s*\S+)?\s*\{/g;
const TS_IMPORT   = /import\s+(?:[^'"]+)\s+from\s+['"]([^'"]+)['"]/g;
const TS_EXPORT   = /export\s+(?:class|interface|function|const|enum|type)\s+(\w+)/g;

const CS_CLASS    = /(?:public|internal|private|protected|abstract|sealed|\s)+class\s+(\w+)/g;
const CS_IFACE    = /(?:public|internal)\s+interface\s+(\w+)/g;
const CS_METHOD   = /(?:public|private|protected|internal|static|async|virtual|override|\s)+\w[\w<>,?\[\]]*\s+(\w+)\s*\(/g;
const CS_USING    = /^\s*using\s+([\w.]+)\s*;/gm;

const SQL_TABLE   = /\b(?:FROM|JOIN|INTO|UPDATE)\s+\[?(\w+)\]?/gi;

function allMatches(re, text) {
  const out = [];
  const r = new RegExp(re.source, re.flags);
  let m;
  while ((m = r.exec(text)) !== null) {
    if (m[1] && !out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

function detectLanguage(file, analysisResult) {
  if (analysisResult.language && analysisResult.language !== 'Unknown') {
    return analysisResult.language;
  }
  const ext = (file.extension ?? '').toLowerCase();
  const map = { ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
                cs: 'C#', sql: 'SQL', py: 'Python', html: 'HTML', css: 'CSS', scss: 'SCSS' };
  return map[ext] ?? 'Unknown';
}

class PatternParser extends ICodeParser {

  constructor() {
    super();
    this._analysis = new AnalysisEngine();
  }

  get name() { return 'PatternParser'; }

  parse(file) {
    try {
      const content = file.content ?? '';
      const ar = this._analysis.analyze(content);
      const lang = detectLanguage(file, ar);

      let classes = [];
      let methods = [];
      let imports = [];
      let exports = [];

      if (lang === 'TypeScript' || lang === 'JavaScript') {
        classes  = [...allMatches(TS_CLASS, content), ...allMatches(TS_IFACE, content)];
        methods  = [...allMatches(TS_FUNC, content), ...allMatches(TS_METHOD, content)];
        imports  = allMatches(TS_IMPORT, content);
        exports  = allMatches(TS_EXPORT, content);
      } else if (lang === 'C#') {
        classes  = [...allMatches(CS_CLASS, content), ...allMatches(CS_IFACE, content)];
        methods  = allMatches(CS_METHOD, content);
        imports  = allMatches(CS_USING, content);
      } else if (lang === 'SQL') {
        imports  = allMatches(SQL_TABLE, content);
      }

      return {
        name: file.name,
        path: file.path,
        extension: file.extension ?? '',
        language: lang,
        type: ar.type,
        classes,
        methods,
        imports,
        exports,
        lineCount: content.split('\n').length,
        content,
        parseError: null,
        _analysisResult: ar,
      };
    } catch (err) {
      return {
        name: file.name,
        path: file.path,
        extension: file.extension ?? '',
        language: 'Unknown',
        type: 'Unknown',
        classes: [],
        methods: [],
        imports: [],
        exports: [],
        lineCount: 0,
        parseError: err.message,
        _analysisResult: null,
      };
    }
  }
}

module.exports = { PatternParser };
