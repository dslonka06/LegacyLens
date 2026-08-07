import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeService } from '@app/core/services/theme.service';
import { ElectronService, AiPreset, AiProviderStatus } from '@app/core/services/electron.service';
import { ThemeToggle } from '@app/shared/components/theme-toggle/theme-toggle';

type TestState = 'idle' | 'testing' | 'ok' | 'fail';
type OllamaSetupState = 'not-installed' | 'no-models' | 'ready';
type ConfirmAction = 'clearCache' | 'clearWorkspaces' | 'removeRepos' | 'factoryReset' | null;

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ThemeToggle],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
})
export class SettingsPage implements OnInit {

  // ── Preset data (from IPC) ────────────────────────────────────────────────
  presets: AiPreset[] = [];
  activeStatus: AiProviderStatus | null = null;

  // ── Selection state ───────────────────────────────────────────────────────
  selectedPresetId = '';
  aiModel = '';
  apiKeyInput = '';
  apiKeyConfigured = false;
  hostInput = '';

  // ── Ollama setup state machine ────────────────────────────────────────────
  ollamaSetupState: OllamaSetupState = 'not-installed';
  discoveredModels: string[] = [];
  discoveringModels = false;

  // ── UI state ──────────────────────────────────────────────────────────────
  testState: TestState = 'idle';
  testReason = '';
  saved = false;
  keySaved = false;
  saveError = '';
  showSetupHelp = false;
  showAiConfig = false;
  showProviderConfig = false;
  showStorageConfig = false;
  activeModel = '';

  // ── App info ──────────────────────────────────────────────────────────────
  appVersion = '';

  // ── Storage ───────────────────────────────────────────────────────────────
  dbPath = '';
  storageStats: { repositories: number; workspaces: number; analyses: number; files: number; dbSizeKb: number } | null = null;
  confirmAction: ConfirmAction = null;
  confirmInput = '';
  storageActionBusy = false;

  // ── How it works ─────────────────────────────────────────────────────────
  showHowItWorks = false;
  showHiwOverview = false;
  showHiwStructural = false;
  showHiwAiPipeline = false;
  showHiwPages = false;
  showHiwDocumentation = false;
  showHiwDiagrams = false;
  showHiwAiConfig = false;
  showHiwAiChat = false;

  constructor(
    readonly theme: ThemeService,
    readonly electron: ElectronService,
  ) {}

  async ngOnInit(): Promise<void> {
    if (this.electron.isElectron) {
      const [presets, settings, statuses, version] = await Promise.all([
        this.electron.aiGetPresets(),
        this.electron.getAllSettings(),
        this.electron.aiGetProviders(),
        this.electron.getAppVersion(),
      ]);

      this.presets = presets;
      this.activeStatus = statuses.find(s => s.active) ?? null;
      this.selectedPresetId = (settings['activePresetId'] as string) ?? '';
      this.aiModel = (settings['aiModel'] as string) ?? '';
      this.activeModel = this.aiModel;
      this.hostInput = (settings['ollamaHost'] as string)
        || (settings['openaiCompatBaseUrl'] as string)
        || '';
      this.appVersion = version;

      if (this.selectedPresetId) {
        await this._loadPresetState(this.selectedPresetId, true);
      }
    }
  }

  // ── Computed getters ──────────────────────────────────────────────────────

  get isConfigured(): boolean {
    return !!this.activeStatus;
  }

  get selectedPreset(): AiPreset | null {
    return this.presets.find(p => p.id === this.selectedPresetId) ?? null;
  }

  get activePreset(): AiPreset | null {
    if (!this.activeStatus) return null;
    return this.presets.find(p => p.id === this.activeStatus!.id) ?? null;
  }

  get cloudPresets(): AiPreset[] {
    return this.presets.filter(p => p.category === 'cloud');
  }

  get localPresets(): AiPreset[] {
    return this.presets.filter(p => p.category === 'local');
  }

  get isOllama(): boolean {
    return this.selectedPreset?.protocol === 'ollama';
  }

  get isAnthropic(): boolean {
    return this.selectedPreset?.protocol === 'anthropic';
  }

  get isOpenAICompat(): boolean {
    return this.selectedPreset?.protocol === 'openai-compat';
  }

  get isCustomEndpoint(): boolean {
    return this.selectedPresetId === 'openai-compat-custom';
  }

  get modelChoices(): string[] {
    if (this.isOllama && this.discoveredModels.length) return this.discoveredModels;
    return this.selectedPreset?.suggestedModels ?? [];
  }

  get hostPlaceholder(): string {
    return this.selectedPreset?.defaultBaseUrl ?? 'http://localhost:11434';
  }

  get effectiveHostLabel(): string {
    return this.isOllama ? 'Host' : 'Base URL';
  }

  get canTestConnection(): boolean {
    if (!this.selectedPresetId) return false;
    if (this.selectedPreset?.requiresApiKey) return this.apiKeyConfigured || !!this.apiKeyInput;
    return true;
  }

  get canSave(): boolean {
    return !!this.selectedPresetId;
  }

  get confirmIsFactoryReset(): boolean {
    return this.confirmAction === 'factoryReset';
  }

  get confirmReady(): boolean {
    if (this.confirmAction === 'factoryReset') return this.confirmInput.trim() === 'RESET';
    return true;
  }

  // ── Provider selection ────────────────────────────────────────────────────

  async selectPreset(presetId: string): Promise<void> {
    if (this.selectedPresetId === presetId) return;
    this.selectedPresetId = presetId;
    this.aiModel = '';
    this.apiKeyInput = '';
    this.apiKeyConfigured = false;
    this.hostInput = '';
    this.testState = 'idle';
    this.discoveredModels = [];
    this.ollamaSetupState = 'not-installed';
    this.showSetupHelp = false;
    await this._loadPresetState(presetId);
  }

  selectModel(model: string): void {
    this.aiModel = model;
  }

  // ── Ollama model discovery ────────────────────────────────────────────────

  async discoverOllamaModels(): Promise<void> {
    this.discoveringModels = true;
    try {
      this.discoveredModels = await this.electron.aiDiscoverModels(this.selectedPresetId);
      if (this.discoveredModels.length > 0) {
        this.ollamaSetupState = 'ready';
        if (!this.aiModel) this.aiModel = this.discoveredModels[0];
      } else {
        this.ollamaSetupState = 'no-models';
      }
    } catch {
      this.ollamaSetupState = 'no-models';
    } finally {
      this.discoveringModels = false;
    }
  }

  openDownloadUrl(): void {
    const url = this.selectedPreset?.downloadUrl;
    if (url) this.electron.openExternal(url);
  }

  openApiKeyUrl(): void {
    const url = this.selectedPreset?.apiKeyUrl;
    if (url) this.electron.openExternal(url);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async saveSettings(): Promise<void> {
    if (!this.electron.isElectron || !this.selectedPresetId) return;

    this.saveError = '';
    const savingKey = !!(this.selectedPreset?.requiresApiKey && this.apiKeyInput);

    const saves: Promise<void>[] = [
      this.electron.setSetting('activePresetId', this.selectedPresetId),
      this.electron.setSetting('aiModel', this.aiModel || null),
    ];

    const preset = this.selectedPreset;
    if (preset) {
      if (preset.requiresApiKey && this.apiKeyInput) {
        saves.push(this.electron.aiSetApiKey(this.selectedPresetId, this.apiKeyInput));
      }

      if (preset.protocol === 'ollama') {
        saves.push(this.electron.setSetting('ollamaHost', this.hostInput || null));
      } else if (preset.requiresHostInput) {
        saves.push(this.electron.setSetting('openaiCompatBaseUrl', this.hostInput || null));
      } else if (preset.defaultBaseUrl) {
        saves.push(this.electron.setSetting('openaiCompatBaseUrl', preset.defaultBaseUrl));
      }
    }

    try {
      await Promise.all(saves);
    } catch (err) {
      this.saveError = err instanceof Error ? err.message : 'Save failed';
      return;
    }

    if (savingKey) {
      this.apiKeyInput = '';
      this.apiKeyConfigured = true;
      this.keySaved = true;
      setTimeout(() => { this.keySaved = false; }, 4000);
    }

    const statuses = await this.electron.aiGetProviders();
    this.activeStatus = statuses.find(s => s.active) ?? null;
    this.activeModel = this.aiModel;

    this.saved = true;
    this.testState = 'idle';
    setTimeout(() => { this.saved = false; }, 2000);
  }

  // ── Test connection ───────────────────────────────────────────────────────

  async testConnection(): Promise<void> {
    this.testState = 'testing';
    this.testReason = '';
    try {
      const result = await this.electron.aiTestConnection();
      this.testState = result.ok ? 'ok' : 'fail';
      this.testReason = result.reason ?? '';
    } catch (err) {
      this.testState = 'fail';
      this.testReason = err instanceof Error ? err.message : String(err);
    }
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  // ── Storage management ────────────────────────────────────────────────────

  openDbFolder(): void {
    if (this.dbPath) this.electron.openExternal('file://' + this.dbPath.replace(/[^/\\]+$/, ''));
  }

  requestConfirm(action: ConfirmAction): void {
    this.confirmAction = action;
    this.confirmInput = '';
  }

  cancelConfirm(): void {
    this.confirmAction = null;
    this.confirmInput = '';
  }

  async executeConfirmedAction(): Promise<void> {
    if (!this.confirmAction || !this.confirmReady) return;
    this.storageActionBusy = true;
    try {
      // IPC handlers to be wired — stubs resolve immediately until main-process side is added
      switch (this.confirmAction) {
        case 'clearCache':
          // await this.electron.clearAnalysisCache();
          break;
        case 'clearWorkspaces':
          // await this.electron.clearAllWorkspaces();
          break;
        case 'removeRepos':
          // await this.electron.removeAllRepositories();
          break;
        case 'factoryReset':
          // await this.electron.factoryReset();
          break;
      }
    } finally {
      this.storageActionBusy = false;
      this.confirmAction = null;
      this.confirmInput = '';
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async _loadPresetState(presetId: string, autoDiscover = false): Promise<void> {
    const preset = this.presets.find(p => p.id === presetId);
    if (!preset) return;

    if (preset.requiresApiKey) {
      this.apiKeyConfigured = await this.electron.aiIsKeyConfigured(presetId);
    }

    if (preset.protocol === 'ollama' && autoDiscover) {
      await this.discoverOllamaModels();
    }

    if (!this.hostInput) {
      const settings = await this.electron.getAllSettings();
      if (preset.protocol === 'ollama') {
        this.hostInput = (settings['ollamaHost'] as string) ?? '';
      } else if (preset.requiresHostInput) {
        this.hostInput = (settings['openaiCompatBaseUrl'] as string) ?? '';
      }
    }
  }
}
