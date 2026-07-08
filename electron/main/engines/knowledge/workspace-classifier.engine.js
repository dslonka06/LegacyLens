const { TechnologyDetectorEngine } = require('./technology-detector.engine');
const { RepositoryScannerEngine } = require('./repository-scanner.engine');
const { ProjectDiscoveryEngine } = require('./project-discovery.engine');

// Files whose presence indicates a project root
const PROJECT_FILE_NAMES = new Set([
  'package.json',
  'cargo.toml',
  'go.mod',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'pyproject.toml',
  'setup.py',
  'gemfile',
  'composer.json',
]);

// Extensions that indicate a project root (e.g. .csproj, .fsproj, .vbproj)
const PROJECT_EXTENSIONS = new Set(['csproj', 'fsproj', 'vbproj', 'vcxproj']);

// Extensions that indicate a multi-project solution
const SOLUTION_EXTENSIONS = new Set(['sln']);

class WorkspaceClassifierEngine {

  constructor() {
    this.technologyDetector = new TechnologyDetectorEngine();
    this.repositoryScanner = new RepositoryScannerEngine();
    this.projectDiscovery = new ProjectDiscoveryEngine();
  }

  classify(files) {
    const signals = this.extractSignals(files);
    const languages = this.uniqueLanguages(files);

    // Stage 1: flat technology list retained for backward compatibility
    const legacyTechnologies = this.detectLegacyTechnologies(files);

    // Stage 2: enriched detection with confidence and method
    const detectedTechnologies = this.technologyDetector.detect(files);

    // Stage 2: repository structure — build tree then attach discovered projects
    const repositoryStructure = this.repositoryScanner.scan(files);
    repositoryStructure.projects = this.projectDiscovery.discoverProjects(files);

    const { workspaceType, confidence } = this.determineType(files.length, signals);

    return {
      workspaceType,
      classificationConfidence: confidence,
      totalFiles: files.length,
      languages,
      technologies: legacyTechnologies,
      projectFileCount: signals.projectFileCount,
      solutionFileCount: signals.solutionFileCount,
      hasRepositoryIndicators: workspaceType === 'Repository',
      files,
      detectedTechnologies,
      repositoryStructure,
    };
  }

  extractSignals(files) {
    let projectFileCount = 0;
    let solutionFileCount = 0;
    const projectRootDirs = new Set();

    for (const f of files) {
      const nameLower = f.name.toLowerCase();

      if (SOLUTION_EXTENSIONS.has(f.extension)) {
        solutionFileCount++;
        continue;
      }

      if (PROJECT_EXTENSIONS.has(f.extension) || PROJECT_FILE_NAMES.has(nameLower)) {
        projectFileCount++;
        const dir = this.parentDir(f.path);
        projectRootDirs.add(dir);
      }
    }

    return {
      projectFileCount,
      solutionFileCount,
      projectRoots: Array.from(projectRootDirs),
    };
  }

  determineType(totalFiles, signals) {
    const { projectFileCount, solutionFileCount, projectRoots } = signals;

    if (solutionFileCount > 0) {
      return { workspaceType: 'Repository', confidence: 0.97 };
    }
    if (projectRoots.length >= 2) {
      return { workspaceType: 'Repository', confidence: 0.95 };
    }
    if (projectFileCount >= 2) {
      return { workspaceType: 'Repository', confidence: 0.85 };
    }
    if (projectFileCount === 1) {
      const confidence = totalFiles > 5 ? 0.93 : 0.82;
      return { workspaceType: 'Project', confidence };
    }
    if (totalFiles <= 1) {
      return { workspaceType: 'SingleFile', confidence: 1.0 };
    }

    return { workspaceType: 'MultiFile', confidence: 0.90 };
  }

  uniqueLanguages(files) {
    const langs = new Set();
    for (const f of files) {
      if (f.language && f.language !== 'Unknown') langs.add(f.language);
    }
    return Array.from(langs).sort();
  }

  // Stage 1 technology list — preserved for backward compatibility.
  // Derives flat names from the richer Stage 2 detector output to avoid
  // maintaining two separate detection tables.
  detectLegacyTechnologies(files) {
    return this.technologyDetector
      .detect(files)
      .map(r => r.technology)
      .sort();
  }

  parentDir(filePath) {
    const normalized = filePath.replace(/\\/g, '/');
    const idx = normalized.lastIndexOf('/');
    return idx >= 0 ? normalized.substring(0, idx) : '';
  }
}

module.exports = { WorkspaceClassifierEngine };
