// Types from: @app/workspace/models/workspace.model
export interface FileMetadata {
  name: string;
  path: string;
  extension: string;
  language: string;
  size: number;
}

// Types from: @app/knowledge/models/technology.model
export type TechnologyCategory =
  | 'Framework'
  | 'Runtime'
  | 'BuildTool'
  | 'ContainerOrOrchestration'
  | 'CI_CD'
  | 'Database'
  | 'TestingFramework'
  | 'PackageManager';

export interface TechnologyDetectionResult {
  technology: string;
  category: TechnologyCategory;
  confidence: number;
  detectionMethod: 'filename' | 'content';
  sourceFile: string;
}

interface DetectionRule {
  // Returns the source file path if the rule matches, null otherwise
  match: (files: FileMetadata[]) => string | null;
  technology: string;
  category: TechnologyCategory;
  confidence: number;
}

// Rules are evaluated in order. First match wins for each technology.
// All rules use detectionMethod: 'filename' — content-based enrichment is Stage 3.
const DETECTION_RULES: DetectionRule[] = [

  // ── Frameworks ────────────────────────────────────────────────────────────

  {
    technology: 'Angular',
    category: 'Framework',
    confidence: 0.97,
    match: files => findByName(files, 'angular.json'),
  },
  {
    technology: 'React',
    category: 'Framework',
    confidence: 0.90,
    // jsx/tsx presence is a strong signal even without package.json
    match: files => findByExtension(files, ['jsx', 'tsx']),
  },
  {
    technology: 'Vue',
    category: 'Framework',
    confidence: 0.95,
    match: files => findByExtension(files, ['vue']),
  },
  {
    technology: 'Next.js',
    category: 'Framework',
    confidence: 0.97,
    match: files => findByNames(files, ['next.config.js', 'next.config.ts', 'next.config.mjs']),
  },
  {
    technology: 'Nuxt',
    category: 'Framework',
    confidence: 0.97,
    match: files => findByNames(files, ['nuxt.config.js', 'nuxt.config.ts']),
  },
  {
    technology: 'Svelte',
    category: 'Framework',
    confidence: 0.97,
    match: files => findByNames(files, ['svelte.config.js', 'svelte.config.ts'])
      ?? findByExtension(files, ['svelte']),
  },
  {
    technology: 'ASP.NET',
    category: 'Framework',
    confidence: 0.97,
    match: files => findByExtension(files, ['csproj', 'fsproj', 'vbproj']),
  },
  {
    technology: 'Django',
    category: 'Framework',
    confidence: 0.92,
    match: files => findByName(files, 'manage.py'),
  },
  {
    technology: 'Flask',
    category: 'Framework',
    confidence: 0.85,
    match: files => findByName(files, 'wsgi.py') ?? findByName(files, 'app.py'),
  },
  {
    technology: 'FastAPI',
    category: 'Framework',
    confidence: 0.82,
    match: files => findByName(files, 'main.py'),
  },
  {
    technology: 'Spring Boot',
    category: 'Framework',
    confidence: 0.90,
    match: files => findByName(files, 'pom.xml')
      ?? findByNames(files, ['build.gradle', 'build.gradle.kts']),
  },

  // ── Runtimes ──────────────────────────────────────────────────────────────

  {
    technology: 'Node.js',
    category: 'Runtime',
    confidence: 0.95,
    match: files => findByName(files, 'package.json'),
  },
  {
    technology: '.NET',
    category: 'Runtime',
    confidence: 0.97,
    match: files => findByExtension(files, ['csproj', 'fsproj', 'sln']),
  },
  {
    technology: 'Python',
    category: 'Runtime',
    confidence: 0.92,
    match: files => findByNames(files, ['pyproject.toml', 'setup.py', 'requirements.txt', 'Pipfile']),
  },
  {
    technology: 'Rust',
    category: 'Runtime',
    confidence: 0.98,
    match: files => findByName(files, 'Cargo.toml'),
  },
  {
    technology: 'Go',
    category: 'Runtime',
    confidence: 0.98,
    match: files => findByName(files, 'go.mod'),
  },
  {
    technology: 'Java',
    category: 'Runtime',
    confidence: 0.90,
    match: files => findByExtension(files, ['java']),
  },
  {
    technology: 'Ruby',
    category: 'Runtime',
    confidence: 0.95,
    match: files => findByName(files, 'Gemfile'),
  },
  {
    technology: 'PHP',
    category: 'Runtime',
    confidence: 0.95,
    match: files => findByName(files, 'composer.json'),
  },

  // ── Build Tools ───────────────────────────────────────────────────────────

  {
    technology: 'Vite',
    category: 'BuildTool',
    confidence: 0.97,
    match: files => findByNames(files, ['vite.config.ts', 'vite.config.js', 'vite.config.mjs']),
  },
  {
    technology: 'Webpack',
    category: 'BuildTool',
    confidence: 0.97,
    match: files => findByNames(files, ['webpack.config.js', 'webpack.config.ts']),
  },
  {
    technology: 'Rollup',
    category: 'BuildTool',
    confidence: 0.97,
    match: files => findByNames(files, ['rollup.config.js', 'rollup.config.ts']),
  },
  {
    technology: 'esbuild',
    category: 'BuildTool',
    confidence: 0.90,
    match: files => findByName(files, 'esbuild.config.js'),
  },
  {
    technology: 'Turbopack',
    category: 'BuildTool',
    confidence: 0.90,
    match: files => findByName(files, 'turbo.json'),
  },
  {
    technology: 'MSBuild',
    category: 'BuildTool',
    confidence: 0.90,
    match: files => findByExtension(files, ['csproj', 'props', 'targets']),
  },
  {
    technology: 'Maven',
    category: 'BuildTool',
    confidence: 0.97,
    match: files => findByName(files, 'pom.xml'),
  },
  {
    technology: 'Gradle',
    category: 'BuildTool',
    confidence: 0.97,
    match: files => findByNames(files, ['build.gradle', 'build.gradle.kts']),
  },
  {
    technology: 'Make',
    category: 'BuildTool',
    confidence: 0.90,
    match: files => findByName(files, 'Makefile'),
  },

  // ── Container & Orchestration ─────────────────────────────────────────────

  {
    technology: 'Docker',
    category: 'ContainerOrOrchestration',
    confidence: 0.98,
    match: files => findByName(files, 'Dockerfile'),
  },
  {
    technology: 'Docker Compose',
    category: 'ContainerOrOrchestration',
    confidence: 0.98,
    match: files => findByNames(files, ['docker-compose.yml', 'docker-compose.yaml']),
  },
  {
    technology: 'Kubernetes',
    category: 'ContainerOrOrchestration',
    confidence: 0.85,
    // Helm charts or k8s manifests are the strongest filename signal
    match: files => findByName(files, 'Chart.yaml')
      ?? findByName(files, 'values.yaml'),
  },

  // ── CI/CD ─────────────────────────────────────────────────────────────────

  {
    technology: 'Azure DevOps',
    category: 'CI_CD',
    confidence: 0.97,
    match: files => findByName(files, 'azure-pipelines.yml')
      ?? findByName(files, 'azure-pipelines.yaml'),
  },
  {
    technology: 'GitHub Actions',
    category: 'CI_CD',
    confidence: 0.97,
    // Files under .github/workflows/
    match: files => findByPathSegment(files, '.github'),
  },
  {
    technology: 'GitLab CI',
    category: 'CI_CD',
    confidence: 0.97,
    match: files => findByName(files, '.gitlab-ci.yml'),
  },
  {
    technology: 'Jenkins',
    category: 'CI_CD',
    confidence: 0.97,
    match: files => findByName(files, 'Jenkinsfile'),
  },
  {
    technology: 'CircleCI',
    category: 'CI_CD',
    confidence: 0.97,
    match: files => findByPathSegment(files, '.circleci'),
  },

  // ── Database ──────────────────────────────────────────────────────────────

  {
    technology: 'SQL Server',
    category: 'Database',
    confidence: 0.80,
    match: files => findByExtension(files, ['sql']),
  },
  {
    technology: 'Entity Framework',
    category: 'Database',
    confidence: 0.85,
    match: files => findByName(files, 'ApplicationDbContext.cs')
      ?? findByNameContaining(files, 'DbContext.cs'),
  },

  // ── Testing ───────────────────────────────────────────────────────────────

  {
    technology: 'Jest',
    category: 'TestingFramework',
    confidence: 0.90,
    match: files => findByNames(files, ['jest.config.js', 'jest.config.ts', 'jest.config.mjs']),
  },
  {
    technology: 'Vitest',
    category: 'TestingFramework',
    confidence: 0.92,
    match: files => findByNames(files, ['vitest.config.ts', 'vitest.config.js']),
  },
  {
    technology: 'Cypress',
    category: 'TestingFramework',
    confidence: 0.95,
    match: files => findByNames(files, ['cypress.config.ts', 'cypress.config.js']),
  },
  {
    technology: 'Playwright',
    category: 'TestingFramework',
    confidence: 0.95,
    match: files => findByNames(files, ['playwright.config.ts', 'playwright.config.js']),
  },

  // ── Package Managers ──────────────────────────────────────────────────────

  {
    technology: 'pnpm',
    category: 'PackageManager',
    confidence: 0.98,
    match: files => findByName(files, 'pnpm-lock.yaml'),
  },
  {
    technology: 'Yarn',
    category: 'PackageManager',
    confidence: 0.98,
    match: files => findByName(files, 'yarn.lock'),
  },
  {
    technology: 'npm',
    category: 'PackageManager',
    confidence: 0.95,
    match: files => findByName(files, 'package-lock.json'),
  },
  {
    technology: 'Bun',
    category: 'PackageManager',
    confidence: 0.98,
    match: files => findByName(files, 'bun.lockb'),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findByName(files: FileMetadata[], name: string): string | null {
  const match = files.find(f => f.name.toLowerCase() === name.toLowerCase());
  return match?.path ?? null;
}

function findByNames(files: FileMetadata[], names: string[]): string | null {
  const nameSet = new Set(names.map(n => n.toLowerCase()));
  const match = files.find(f => nameSet.has(f.name.toLowerCase()));
  return match?.path ?? null;
}

function findByExtension(files: FileMetadata[], extensions: string[]): string | null {
  const extSet = new Set(extensions.map(e => e.toLowerCase()));
  const match = files.find(f => extSet.has(f.extension.toLowerCase()));
  return match?.path ?? null;
}

function findByPathSegment(files: FileMetadata[], segment: string): string | null {
  const seg = segment.toLowerCase();
  const match = files.find(f => {
    const normalized = f.path.replace(/\\/g, '/').toLowerCase();
    return normalized.split('/').includes(seg);
  });
  return match?.path ?? null;
}

function findByNameContaining(files: FileMetadata[], substring: string): string | null {
  const sub = substring.toLowerCase();
  const match = files.find(f => f.name.toLowerCase().includes(sub));
  return match?.path ?? null;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class TechnologyDetectorEngine {

  detect(files: FileMetadata[]): TechnologyDetectionResult[] {
    const results: TechnologyDetectionResult[] = [];
    const seen = new Set<string>();

    for (const rule of DETECTION_RULES) {
      if (seen.has(rule.technology)) continue;

      const sourceFile = rule.match(files);
      if (sourceFile !== null) {
        results.push({
          technology: rule.technology,
          category: rule.category,
          confidence: rule.confidence,
          detectionMethod: 'filename',
          sourceFile,
        });
        seen.add(rule.technology);
      }
    }

    return results;
  }

  // Convenience: derive framework list from detection results
  frameworks(results: TechnologyDetectionResult[]): string[] {
    return results
      .filter(r => r.category === 'Framework')
      .sort((a, b) => b.confidence - a.confidence)
      .map(r => r.technology);
  }
}
