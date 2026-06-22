// Types from: @app/knowledge/models/knowledge.model
export interface SourceFile {
  path: string;
  content: string;
  extension: string;
  language?: string;
  size?: number;
}

export interface DependencyNode {
  id: string;
  name: string;
  type: string;
  path: string;
}

export interface DependencyEdge {
  source: string;
  target: string;
  relationshipType: string;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

// ── Regex patterns ────────────────────────────────────────────────────────────

// TypeScript/JavaScript: import { X } from './path' or import X from '../path'
const TS_IMPORT = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)[\s,]*(?:,\s*(?:\{[^}]*\}|\w+))?)\s+from\s+['"]([^'"]+)['"]/g;

// TypeScript/JavaScript: export { X } from './path'
const TS_REEXPORT = /export\s+(?:\{[^}]*\}|\*)\s+from\s+['"]([^'"]+)['"]/g;

// C#: using Namespace.Name;
const CS_USING = /^\s*using\s+([\w.]+)\s*;/gm;

// SQL: FROM TableName or JOIN TableName
const SQL_FROM  = /\bFROM\s+\[?(\w+)\]?/gi;
const SQL_JOIN  = /\bJOIN\s+\[?(\w+)\]?/gi;
const SQL_INTO  = /\bINSERT\s+INTO\s+\[?(\w+)\]?/gi;
const SQL_UPDATE = /\bUPDATE\s+\[?(\w+)\]?\s+SET\b/gi;

// ── Helpers ───────────────────────────────────────────────────────────────────

function nodeId(path: string): string {
  // Normalize separators and strip leading ./
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

function nameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const base = normalized.split('/').pop() ?? normalized;
  // Strip extension for display
  return base.replace(/\.[^.]+$/, '');
}

function allMatches(regex: RegExp, text: string): string[] {
  const results: string[] = [];
  let m: RegExpExecArray | null;
  // Clone regex to reset lastIndex on each call
  const r = new RegExp(regex.source, regex.flags);
  while ((m = r.exec(text)) !== null) {
    results.push(m[1]);
  }
  return results;
}

// ── Engine ────────────────────────────────────────────────────────────────────

export class DependencyMapperEngine {

  buildGraph(sourceFiles: SourceFile[]): DependencyGraph {
    const nodes = new Map<string, DependencyNode>();
    const edges: DependencyEdge[] = [];
    const edgeSeen = new Set<string>();

    // Register every source file as a node
    for (const sf of sourceFiles) {
      const id = nodeId(sf.path);
      nodes.set(id, {
        id,
        name: nameFromPath(sf.path),
        type: this.nodeType(sf.extension),
        path: sf.path,
      });
    }

    // Extract edges from each file
    for (const sf of sourceFiles) {
      const sourceId = nodeId(sf.path);
      const ext = sf.extension.toLowerCase();

      let targets: Array<{ target: string; rel: string }> = [];

      if (['ts', 'tsx', 'js', 'jsx', 'mjs'].includes(ext)) {
        targets = this.extractTypeScriptDeps(sf, sourceFiles);
      } else if (['cs', 'fs', 'vb'].includes(ext)) {
        targets = this.extractCSharpDeps(sf, sourceFiles);
      } else if (ext === 'sql') {
        targets = this.extractSqlDeps(sf);
      }

      for (const { target, rel } of targets) {
        const targetId = nodeId(target);

        // Ensure target node exists (may reference external or unloaded files)
        if (!nodes.has(targetId)) {
          nodes.set(targetId, {
            id: targetId,
            name: nameFromPath(target),
            type: this.inferExternalType(target),
            path: target,
          });
        }

        const edgeKey = `${sourceId}→${targetId}:${rel}`;
        if (!edgeSeen.has(edgeKey)) {
          edgeSeen.add(edgeKey);
          edges.push({ source: sourceId, target: targetId, relationshipType: rel });
        }
      }
    }

    return {
      nodes: Array.from(nodes.values()),
      edges,
    };
  }

  // ── Inbound/outbound query helpers ────────────────────────────────────────

  dependenciesOf(id: string, graph: DependencyGraph): DependencyNode[] {
    const targetIds = new Set(
      graph.edges.filter(e => e.source === id).map(e => e.target)
    );
    return graph.nodes.filter(n => targetIds.has(n.id));
  }

  dependentsOf(id: string, graph: DependencyGraph): DependencyNode[] {
    const sourceIds = new Set(
      graph.edges.filter(e => e.target === id).map(e => e.source)
    );
    return graph.nodes.filter(n => sourceIds.has(n.id));
  }

  // Most-connected = highest combined in+out degree
  mostConnected(graph: DependencyGraph, limit = 5): Array<{ node: DependencyNode; degree: number }> {
    const degree = new Map<string, number>();
    for (const e of graph.edges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    }
    return graph.nodes
      .map(n => ({ node: n, degree: degree.get(n.id) ?? 0 }))
      .filter(x => x.degree > 0)
      .sort((a, b) => b.degree - a.degree)
      .slice(0, limit);
  }

  // ── Extractors ────────────────────────────────────────────────────────────

  // Known @app/* path alias prefixes — maps alias prefix to real path prefix.
  // Covers the tsconfig.app.json paths without needing to read that file at runtime.
  private static readonly PATH_ALIASES: Array<{ prefix: string; real: string }> = [
    { prefix: '@app/core/',      real: 'src/app/core/' },
    { prefix: '@app/shell/',     real: 'src/app/shell/' },
    { prefix: '@app/workspace/', real: 'src/app/workspace/' },
    { prefix: '@app/knowledge/', real: 'src/app/knowledge/' },
    { prefix: '@app/analysis/',  real: 'src/app/analysis/' },
    { prefix: '@app/ai/',        real: 'src/app/ai/' },
    { prefix: '@app/features/',  real: 'src/app/features/' },
    { prefix: '@app/shared/',    real: 'src/app/shared/' },
  ];

  private extractTypeScriptDeps(
    sf: SourceFile,
    allFiles: SourceFile[]
  ): Array<{ target: string; rel: string }> {
    const imports = [
      ...allMatches(TS_IMPORT, sf.content),
      ...allMatches(TS_REEXPORT, sf.content),
    ];

    const results: Array<{ target: string; rel: string }> = [];

    for (const raw of imports) {
      if (raw.startsWith('.') || raw.startsWith('/')) {
        // Relative import — resolve normally
        const resolved = this.resolveRelativePath(sf.path, raw, allFiles);
        if (resolved) results.push({ target: resolved, rel: 'import' });
      } else {
        // Try to resolve known path aliases (@app/*)
        const resolved = this.resolveAliasPath(raw, allFiles);
        if (resolved) results.push({ target: resolved, rel: 'import' });
      }
    }

    return results;
  }

  private resolveAliasPath(importPath: string, allFiles: SourceFile[]): string | null {
    for (const { prefix, real } of DependencyMapperEngine.PATH_ALIASES) {
      if (!importPath.startsWith(prefix)) continue;
      const rest = importPath.slice(prefix.length);
      const base = real + rest;
      const candidates = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}/index.ts`,
      ];
      for (const candidate of candidates) {
        const match = allFiles.find(f =>
          f.path.replace(/\\/g, '/').endsWith(candidate) ||
          f.path.replace(/\\/g, '/') === candidate
        );
        if (match) return match.path;
      }
    }
    return null;
  }

  private extractCSharpDeps(
    sf: SourceFile,
    allFiles: SourceFile[]
  ): Array<{ target: string; rel: string }> {
    const namespaces = allMatches(CS_USING, sf.content);
    const results: Array<{ target: string; rel: string }> = [];

    for (const ns of namespaces) {
      // Try to match namespace to a known file
      const matched = allFiles.find(f => {
        const content = f.content;
        // Look for a file that declares this namespace
        return new RegExp(`namespace\\s+${ns.replace('.', '\\.')}\\b`).test(content);
      });

      if (matched) {
        results.push({ target: matched.path, rel: 'using' });
      } else {
        // Record as an external namespace node
        results.push({ target: ns, rel: 'using' });
      }
    }

    return results;
  }

  private extractSqlDeps(sf: SourceFile): Array<{ target: string; rel: string }> {
    const tables = new Set<string>();

    for (const t of allMatches(SQL_FROM, sf.content))   tables.add(t.toLowerCase());
    for (const t of allMatches(SQL_JOIN, sf.content))   tables.add(t.toLowerCase());
    for (const t of allMatches(SQL_INTO, sf.content))   tables.add(t.toLowerCase());
    for (const t of allMatches(SQL_UPDATE, sf.content)) tables.add(t.toLowerCase());

    // Filter out SQL keywords that match the patterns
    const SQL_KEYWORDS = new Set(['select', 'where', 'null', 'not', 'in', 'exists', 'dual']);
    return Array.from(tables)
      .filter(t => !SQL_KEYWORDS.has(t))
      .map(t => ({ target: `table:${t}`, rel: 'references' }));
  }

  // ── Path resolution ────────────────────────────────────────────────────────

  private resolveRelativePath(
    fromPath: string,
    importPath: string,
    allFiles: SourceFile[]
  ): string | null {
    const fromDir = this.parentDir(fromPath.replace(/\\/g, '/'));
    // Combine base dir with import path and normalize
    const combined = this.normalizePath(`${fromDir}/${importPath}`);

    // Try the exact path first, then with common extensions appended
    const candidates = [
      combined,
      `${combined}.ts`,
      `${combined}.tsx`,
      `${combined}.js`,
      `${combined}/index.ts`,
      `${combined}/index.js`,
    ];

    for (const candidate of candidates) {
      const match = allFiles.find(f =>
        f.path.replace(/\\/g, '/').endsWith(candidate) ||
        nodeId(f.path) === candidate
      );
      if (match) return match.path;
    }

    // Return the resolved path even if not found — it may be in the graph
    // as an external reference
    return `${combined}.ts`;
  }

  private parentDir(filePath: string): string {
    const idx = filePath.lastIndexOf('/');
    return idx >= 0 ? filePath.substring(0, idx) : '';
  }

  private normalizePath(path: string): string {
    const parts = path.split('/');
    const resolved: string[] = [];
    for (const part of parts) {
      if (part === '..') {
        resolved.pop();
      } else if (part !== '.') {
        resolved.push(part);
      }
    }
    return resolved.join('/');
  }

  private nodeType(extension: string): string {
    const map: Record<string, string> = {
      ts: 'module', tsx: 'module', js: 'module', jsx: 'module',
      cs: 'class', fs: 'module', vb: 'class',
      sql: 'query',
      html: 'template', vue: 'component', svelte: 'component',
    };
    return map[extension] ?? 'file';
  }

  private inferExternalType(path: string): string {
    if (path.startsWith('table:')) return 'table';
    if (!path.includes('/') && !path.includes('.')) return 'namespace';
    return 'external';
  }
}
