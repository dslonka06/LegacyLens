import { Injectable } from '@angular/core';
// Types come from src/electron.d.ts which is picked up globally by tsconfig
import type {
  ElectronRepository,
  AddRepositoryRequest,
  UpdateRepositoryRequest,
  ElectronAnalysis,
  SaveAnalysisRequest,
  ElectronFileMetadata,
  SyncFileEntry,
  ElectronDirectoryEntry,
  ScanProgressEvent,
} from '../../../electron';

export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles'>;
  filters?: Array<{ name: string; extensions: string[] }>;
}

@Injectable({ providedIn: 'root' })
export class ElectronService {

  get isElectron(): boolean {
    return !!(window as any).electronAPI;
  }

  private get api() {
    return (window as any).electronAPI ?? null;
  }

  // ── Repositories ──────────────────────────────────────────────────────────

  async getRepositories(): Promise<ElectronRepository[]> {
    if (!this.api) return [];
    return this.api.repositories.getAll();
  }

  async addRepository(request: AddRepositoryRequest): Promise<ElectronRepository | null> {
    if (!this.api) return null;
    return this.api.repositories.add(request);
  }

  async updateRepository(id: string, updates: UpdateRepositoryRequest): Promise<ElectronRepository | null> {
    if (!this.api) return null;
    return this.api.repositories.update(id, updates);
  }

  async touchRepository(id: string): Promise<void> {
    if (!this.api) return;
    return this.api.repositories.touch(id);
  }

  async removeRepository(id: string): Promise<boolean> {
    if (!this.api) return false;
    return this.api.repositories.remove(id);
  }

  // ── Analysis ──────────────────────────────────────────────────────────────

  async saveAnalysis(data: SaveAnalysisRequest): Promise<ElectronAnalysis | null> {
    if (!this.api) return null;
    return this.api.analysis.save(data);
  }

  async getLatestAnalysis(repositoryId: string): Promise<ElectronAnalysis | null> {
    if (!this.api) return null;
    return this.api.analysis.getLatest(repositoryId);
  }

  async getAnalysisHistory(repositoryId: string): Promise<ElectronAnalysis[]> {
    if (!this.api) return [];
    return this.api.analysis.getHistory(repositoryId);
  }

  async deleteAnalysis(id: string): Promise<boolean> {
    if (!this.api) return false;
    return this.api.analysis.delete(id);
  }

  // ── File Metadata ─────────────────────────────────────────────────────────

  async syncFileMetadata(repositoryId: string, files: SyncFileEntry[]): Promise<{ upserted: number; unchanged: number } | null> {
    if (!this.api) return null;
    return this.api.files.sync(repositoryId, files);
  }

  async getFileMetadata(repositoryId: string): Promise<ElectronFileMetadata[]> {
    if (!this.api) return [];
    return this.api.files.getAll(repositoryId);
  }

  async getChangedFiles(repositoryId: string, currentFiles: Array<{ relativePath: string; hash: string }>): Promise<string[]> {
    if (!this.api) return [];
    return this.api.files.getChanged(repositoryId, currentFiles);
  }

  // ── Filesystem ────────────────────────────────────────────────────────────

  async openDialog(options?: OpenDialogOptions): Promise<string[] | null> {
    if (!this.api) return null;
    return this.api.filesystem.openDialog(options ?? {});
  }

  async pickFolder(title = 'Select Folder'): Promise<string | null> {
    const paths = await this.openDialog({ title, properties: ['openDirectory'] });
    return paths?.[0] ?? null;
  }

  async pickFile(title = 'Select File', filters?: OpenDialogOptions['filters']): Promise<string | null> {
    const paths = await this.openDialog({ title, properties: ['openFile'], filters });
    return paths?.[0] ?? null;
  }

  async readDirectory(dirPath: string): Promise<ElectronDirectoryEntry[] | null> {
    if (!this.api) return null;
    return this.api.filesystem.readDirectory(dirPath);
  }

  async cancelScan(scanId: string): Promise<void> {
    if (!this.api) return;
    return this.api.filesystem.cancelScan(scanId);
  }

  onScanProgress(callback: (event: ScanProgressEvent) => void): (() => void) | null {
    if (!this.api) return null;
    return this.api.filesystem.onScanProgress(callback);
  }

  async pickAndReadFolder(title = 'Select Folder'): Promise<{ folderPath: string; files: ElectronDirectoryEntry[] } | null> {
    const folderPath = await this.pickFolder(title);
    if (!folderPath) return null;
    const files = await this.readDirectory(folderPath);
    if (!files) return null;
    return { folderPath, files };
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  async getSetting(key: string): Promise<unknown> {
    if (!this.api) return null;
    return this.api.settings.get(key);
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    if (!this.api) return;
    return this.api.settings.set(key, value);
  }

  async getAllSettings(): Promise<Record<string, unknown>> {
    if (!this.api) return {};
    return this.api.settings.getAll();
  }

  // ── AI ────────────────────────────────────────────────────────────────────

  async aiExplain(prompt: string): Promise<string | null> {
    if (!this.api) return null;
    return this.api.ai.explain(prompt);
  }

  async aiAnalyze(fileName: string, sourceCode: string): Promise<unknown> {
    if (!this.api) return null;
    return this.api.ai.analyze(fileName, sourceCode);
  }

  async getAiProviderUrl(): Promise<string | null> {
    if (!this.api) return null;
    return this.api.ai.getProviderUrl();
  }

  async setAiProviderUrl(url: string | null): Promise<void> {
    if (!this.api) return;
    return this.api.ai.setProviderUrl(url);
  }

  // ── Intelligence Engine ───────────────────────────────────────────────────

  async intelligenceAnalyzeCode(code: string): Promise<unknown> {
    if (!this.api) return null;
    return this.api.intelligence.analyzeCode(code);
  }

  async intelligenceDetectArchitecture(structure: unknown, graph: unknown): Promise<unknown> {
    if (!this.api) return null;
    return this.api.intelligence.detectArchitecture(structure, graph);
  }

  async intelligenceBuildDependencyGraph(sourceFiles: unknown[]): Promise<unknown> {
    if (!this.api) return null;
    return this.api.intelligence.buildDependencyGraph(sourceFiles);
  }

  async intelligenceExploreDependencies(graph: unknown): Promise<{ hubs: unknown[]; orphans: unknown[]; ranked: unknown[] } | null> {
    if (!this.api) return null;
    return this.api.intelligence.exploreDependencies(graph);
  }

  async intelligenceDetectTechnologies(files: unknown[]): Promise<unknown[]> {
    if (!this.api) return [];
    return this.api.intelligence.detectTechnologies(files);
  }

  async intelligenceDiscoverProjects(files: unknown[]): Promise<unknown[]> {
    if (!this.api) return [];
    return this.api.intelligence.discoverProjects(files);
  }

  async intelligenceScanRepository(files: unknown[]): Promise<unknown> {
    if (!this.api) return null;
    return this.api.intelligence.scanRepository(files);
  }

  async intelligenceClassifyWorkspace(files: unknown[]): Promise<unknown> {
    if (!this.api) return null;
    return this.api.intelligence.classifyWorkspace(files);
  }

  async intelligenceSystemUnderstanding(session: unknown, knowledge: unknown): Promise<unknown> {
    if (!this.api) return null;
    return this.api.intelligence.systemUnderstanding(session, knowledge);
  }

  async intelligenceExploreWorkflows(flows: unknown[]): Promise<unknown[]> {
    if (!this.api) return [];
    return this.api.intelligence.exploreWorkflows(flows);
  }

  async intelligenceLearningPath(session: unknown, knowledge: unknown, understanding: unknown, scope: string): Promise<unknown> {
    if (!this.api) return null;
    return this.api.intelligence.learningPath(session, knowledge, understanding, scope);
  }

  async intelligenceDiscoverDataFlows(knowledge: unknown, structure: unknown): Promise<unknown[]> {
    if (!this.api) return [];
    return this.api.intelligence.discoverDataFlows(knowledge, structure);
  }

  async intelligenceRecommendations(session: unknown, knowledge: unknown): Promise<unknown> {
    if (!this.api) return null;
    return this.api.intelligence.recommendations(session, knowledge);
  }

  async intelligenceSecurity(session: unknown, knowledge: unknown): Promise<unknown> {
    if (!this.api) return null;
    return this.api.intelligence.security(session, knowledge);
  }

  async intelligenceInsights(knowledge: unknown): Promise<unknown[]> {
    if (!this.api) return [];
    return this.api.intelligence.insights(knowledge);
  }

  async intelligenceBuildSummary(workspaceContext: unknown, knowledge: unknown, session: unknown): Promise<unknown> {
    if (!this.api) return null;
    return this.api.intelligence.buildSummary(workspaceContext, knowledge, session);
  }

  // ── Validation ────────────────────────────────────────────────────────────

  async detectTarget(path: string): Promise<{ detected: string }> {
    if (!this.api) return { detected: 'unknown' };
    return this.api.validation.detectTarget(path);
  }

  // ── Capability Pipeline (D2/D3) ───────────────────────────────────────────

  async runPipeline(targetType: 'file' | 'folder' | 'repository', files: unknown[]): Promise<unknown> {
    if (!this.api) return null;
    return this.api.intelligence.runPipeline(targetType, files);
  }

  async capabilitiesFor(targetType: 'file' | 'folder' | 'repository'): Promise<string[]> {
    if (!this.api) return [];
    return this.api.intelligence.capabilitiesFor(targetType);
  }
}
