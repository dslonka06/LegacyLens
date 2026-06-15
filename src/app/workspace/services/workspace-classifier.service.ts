import { Injectable } from '@angular/core';
import { FileMetadata, WorkspaceProfile, WorkspaceType } from '../models/workspace.model';
import { TechnologyDetectorService } from '@app/knowledge/services/technology-detector.service';
import { RepositoryScannerService } from '@app/knowledge/services/repository-scanner.service';
import { ProjectDiscoveryService } from '@app/knowledge/services/project-discovery.service';

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

interface ClassificationSignals {
  projectFileCount: number;
  solutionFileCount: number;
  projectRoots: string[];
}

@Injectable({ providedIn: 'root' })
export class WorkspaceClassifierService {

  constructor(
    private readonly technologyDetector: TechnologyDetectorService,
    private readonly repositoryScanner: RepositoryScannerService,
    private readonly projectDiscovery: ProjectDiscoveryService,
  ) {}

  classify(files: FileMetadata[]): WorkspaceProfile {
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

  private extractSignals(files: FileMetadata[]): ClassificationSignals {
    let projectFileCount = 0;
    let solutionFileCount = 0;
    const projectRootDirs = new Set<string>();

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

  private determineType(
    totalFiles: number,
    signals: ClassificationSignals
  ): { workspaceType: WorkspaceType; confidence: number } {

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

  private uniqueLanguages(files: FileMetadata[]): string[] {
    const langs = new Set<string>();
    for (const f of files) {
      if (f.language && f.language !== 'Unknown') langs.add(f.language);
    }
    return Array.from(langs).sort();
  }

  // Stage 1 technology list — preserved for backward compatibility.
  // Derives flat names from the richer Stage 2 detector output to avoid
  // maintaining two separate detection tables.
  private detectLegacyTechnologies(files: FileMetadata[]): string[] {
    return this.technologyDetector
      .detect(files)
      .map(r => r.technology)
      .sort();
  }

  private parentDir(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    const idx = normalized.lastIndexOf('/');
    return idx >= 0 ? normalized.substring(0, idx) : '';
  }
}
