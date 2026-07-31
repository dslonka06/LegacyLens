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
  KnowledgeModel,
  ProcessWorkspaceRequest,
  IncrementalCheckResult,
  AnalysisTargetType,
  PersistedWorkspace,
} from '../../../electron';

export interface AiProviderStatus {
  id: string;
  displayName: string;
  category: 'cloud' | 'local';
  configured: boolean;
  active: boolean;
  available: boolean | null;
  lastTestedAt: string | null;
  reason?: string;
}

export interface AiProviderCapabilities {
  supportsModelDiscovery: boolean;
  supportedModels: string[];
  requiresApiKey: boolean;
  requiresHost: boolean;
}

export interface AiPreset {
  id: string;
  displayName: string;
  category: 'cloud' | 'local';
  protocol: 'anthropic' | 'ollama' | 'openai-compat';
  defaultBaseUrl: string | null;
  requiresApiKey: boolean;
  requiresHostInput: boolean;
  supportsModelDiscovery: boolean;
  suggestedModels: string[];
  apiKeyUrl: string | null;
  downloadUrl: string | null;
  description: string | null;
}

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

  // ── App info ──────────────────────────────────────────────────────────────

  async getAppVersion(): Promise<string> {
    if (!this.api) return '';
    try { return await this.api.app.getVersion(); } catch { return ''; }
  }

  async openExternal(url: string): Promise<void> {
    if (!this.api) return;
    await this.api.app.openExternal(url);
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

  async updateRepository(
    id: string,
    updates: UpdateRepositoryRequest,
  ): Promise<ElectronRepository | null> {
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

  async syncFileMetadata(
    repositoryId: string,
    files: SyncFileEntry[],
  ): Promise<{ upserted: number; unchanged: number } | null> {
    if (!this.api) return null;
    return this.api.files.sync(repositoryId, files);
  }

  async getFileMetadata(repositoryId: string): Promise<ElectronFileMetadata[]> {
    if (!this.api) return [];
    return this.api.files.getAll(repositoryId);
  }

  async getChangedFiles(
    repositoryId: string,
    currentFiles: Array<{ relativePath: string; hash: string }>,
  ): Promise<string[]> {
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

  async pickFile(
    title = 'Select File',
    filters?: OpenDialogOptions['filters'],
  ): Promise<string | null> {
    const paths = await this.openDialog({ title, properties: ['openFile'], filters });
    return paths?.[0] ?? null;
  }

  async readDirectory(dirPath: string): Promise<ElectronDirectoryEntry[] | null> {
    if (!this.api) return null;
    return this.api.filesystem.readDirectory(dirPath);
  }

  async readFile(filePath: string): Promise<string | null> {
    if (!this.api) return null;
    return this.api.filesystem.readFile(filePath);
  }

  async cancelScan(scanId: string): Promise<void> {
    if (!this.api) return;
    return this.api.filesystem.cancelScan(scanId);
  }

  onScanProgress(callback: (event: ScanProgressEvent) => void): (() => void) | null {
    if (!this.api) return null;
    return this.api.filesystem.onScanProgress(callback);
  }

  async pickAndReadFolder(
    title = 'Select Folder',
  ): Promise<{ folderPath: string; files: ElectronDirectoryEntry[] } | null> {
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

  async aiExplain(prompt: string, maxTokens?: number): Promise<string | null> {
    if (!this.api) return null;
    return this.api.ai.explain(prompt, maxTokens);
  }

  async aiAnalyze(fileName: string, sourceCode: string): Promise<unknown> {
    if (!this.api) return null;
    return this.api.ai.analyze(fileName, sourceCode);
  }

  async aiChat(messages: Array<{ role: string; content: string }>, knowledgeModel?: unknown): Promise<string | null> {
    if (!this.api) return null;
    return this.api.ai.chat(messages, knowledgeModel ?? null);
  }

  async aiGetProviders(): Promise<AiProviderStatus[]> {
    if (!this.api) return [];
    return this.api.ai.getProviders();
  }

  async aiGetPresets(): Promise<AiPreset[]> {
    if (!this.api) return [];
    return this.api.ai.getPresets();
  }

  async aiGetCapabilities(presetId?: string): Promise<AiProviderCapabilities | null> {
    if (!this.api) return null;
    return this.api.ai.getCapabilities(presetId ?? undefined);
  }

  async aiDiscoverModels(presetId?: string): Promise<string[]> {
    if (!this.api) return [];
    return this.api.ai.discoverModels(presetId);
  }

  async aiTestConnection(): Promise<{ ok: boolean; reason?: string }> {
    if (!this.api) return { ok: false, reason: 'Not running in Electron' };
    return this.api.ai.testConnection();
  }

  async aiSetApiKey(presetId: string, plainKey: string): Promise<void> {
    if (!this.api) return;
    return this.api.ai.setApiKey(presetId, plainKey);
  }

  async aiIsKeyConfigured(presetId: string): Promise<boolean> {
    if (!this.api) return false;
    return this.api.ai.isKeyConfigured(presetId);
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

  async intelligenceExploreDependencies(
    graph: unknown,
  ): Promise<{ hubs: unknown[]; orphans: unknown[]; ranked: unknown[] } | null> {
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

  async intelligenceSystemUnderstanding(model: KnowledgeModel): Promise<unknown> {
    if (!this.api) return null;
    return this.api.intelligence.systemUnderstanding(model);
  }

  async intelligenceHubDirective(data: {
    securityCount: number;
    securityHasCritical: boolean;
    securityHasHigh: boolean;
    recommendationCount: number;
    scope: string;
  }): Promise<string> {
    if (!this.api) return '';
    return this.api.intelligence.hubDirective(data);
  }

  async intelligenceExploreWorkflows(flows: unknown[]): Promise<unknown[]> {
    if (!this.api) return [];
    return this.api.intelligence.exploreWorkflows(flows);
  }

  async intelligenceLearningPath(
    model: KnowledgeModel,
    understanding: unknown,
    scope: string,
  ): Promise<unknown> {
    if (!this.api) return null;
    return this.api.intelligence.learningPath(model);
  }

  async intelligenceDiscoverDataFlows(knowledge: unknown, structure: unknown): Promise<unknown[]> {
    if (!this.api) return [];
    return this.api.intelligence.discoverDataFlows(knowledge, structure);
  }

  async intelligenceRecommendations(model: KnowledgeModel): Promise<unknown> {
    if (!this.api) return null;
    return this.api.intelligence.recommendations(model);
  }

  async intelligenceSecurity(model: KnowledgeModel): Promise<unknown> {
    if (!this.api) return null;
    return this.api.intelligence.security(model);
  }

  async intelligenceArchitectureAnalysis(model: KnowledgeModel): Promise<unknown> {
    if (!this.api) return null;
    return this.api.intelligence.architectureAnalysis(model);
  }

  async intelligenceDataFlowAnalysis(model: KnowledgeModel): Promise<unknown> {
    if (!this.api) return null;
    return this.api.intelligence.dataFlowAnalysis(model);
  }

  async intelligenceInsights(knowledge: unknown): Promise<unknown[]> {
    if (!this.api) return [];
    return this.api.intelligence.insights(knowledge);
  }

  async intelligenceBuildSummary(
    workspaceContext: unknown,
    knowledge: unknown,
    session: unknown,
  ): Promise<unknown> {
    if (!this.api) return null;
    return this.api.intelligence.buildSummary(workspaceContext, knowledge, session);
  }

  // ── Validation ────────────────────────────────────────────────────────────

  async detectTarget(path: string): Promise<{ detected: string }> {
    if (!this.api) return { detected: 'unknown' };
    return this.api.validation.detectTarget(path);
  }

  // ── Capability Pipeline (D2/D3) ───────────────────────────────────────────

  async runPipeline(
    targetType: 'file' | 'folder' | 'repository',
    files: unknown[],
  ): Promise<unknown> {
    if (!this.api) return null;
    return this.api.intelligence.runPipeline(targetType, files);
  }

  async capabilitiesFor(targetType: 'file' | 'folder' | 'repository'): Promise<string[]> {
    if (!this.api) return [];
    return this.api.intelligence.capabilitiesFor(targetType);
  }

  async buildKnowledgeModel(
    targetType: 'file' | 'folder' | 'repository',
    files: unknown[],
    options?: {
      repositoryPath?: string;
      workspaceName?: string;
      repositoryId?: string;
      persist?: boolean;
    },
  ): Promise<unknown> {
    if (!this.api) return null;
    return this.api.intelligence.buildKnowledgeModel(targetType, files, options);
  }

  async getKnowledgeModel(repositoryId: string): Promise<unknown> {
    if (!this.api) return null;
    return this.api.intelligence.getKnowledgeModel(repositoryId);
  }

  async buildContext(
    contextType: 'repository' | 'workflow' | 'security' | 'analysis',
    knowledgeModel: unknown,
    extras?: unknown,
  ): Promise<unknown> {
    if (!this.api) return null;
    return this.api.intelligence.buildContext(contextType, knowledgeModel as any, extras);
  }

  async checkIncremental(
    repositoryId: string,
    currentFiles: Array<{ relativePath: string; hash: string }>,
    targetType: AnalysisTargetType,
  ): Promise<IncrementalCheckResult | null> {
    if (!this.api) return null;
    return this.api.intelligence.checkIncremental(repositoryId, currentFiles, targetType);
  }

  async processWorkspace(request: ProcessWorkspaceRequest): Promise<KnowledgeModel | null> {
    if (!this.api) return null;
    return this.api.intelligence.processWorkspace(request);
  }

  // ── Workspace Persistence ─────────────────────────────────────────────────

  async getPersistedWorkspaces(): Promise<PersistedWorkspace[]> {
    if (!this.api) return [];
    return this.api.workspaces.getAll();
  }

  async saveWorkspace(workspace: PersistedWorkspace): Promise<PersistedWorkspace | null> {
    if (!this.api) return null;
    return this.api.workspaces.save(workspace);
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    if (!this.api) return false;
    return this.api.workspaces.delete(id);
  }
}
