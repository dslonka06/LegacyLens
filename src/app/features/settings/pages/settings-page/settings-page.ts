import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ThemeService } from '@app/core/services/theme.service';
import { ElectronService, AiPreset, AiProviderStatus } from '@app/core/services/electron.service';

type TestState = 'idle' | 'testing' | 'ok' | 'fail';
type OllamaSetupState = 'not-installed' | 'no-models' | 'ready';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
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
  showChangeProvider = false;
  activeModel = '';

  constructor(
    readonly theme: ThemeService,
    readonly electron: ElectronService,
  ) {}

  async ngOnInit(): Promise<void> {
    if (!this.electron.isElectron) return;

    const [presets, settings, statuses] = await Promise.all([
      this.electron.aiGetPresets(),
      this.electron.getAllSettings(),
      this.electron.aiGetProviders(),
    ]);

    this.presets = presets;
    this.activeStatus = statuses.find(s => s.active) ?? null;
    this.selectedPresetId = (settings['activePresetId'] as string) ?? '';
    this.aiModel = (settings['aiModel'] as string) ?? '';
    this.activeModel = this.aiModel;
    this.hostInput = (settings['ollamaHost'] as string)
      || (settings['openaiCompatBaseUrl'] as string)
      || '';

    if (this.selectedPresetId) {
      await this._loadPresetState(this.selectedPresetId);
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
    await this._loadPresetState(presetId);
  }

  selectModel(model: string): void {
    this.aiModel = model;
  }

  // ── Ollama model discovery ────────────────────────────────────────────────

  async discoverOllamaModels(): Promise<void> {
    this.discoveringModels = true;
    try {
      this.discoveredModels = await this.electron.aiDiscoverModels();
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
    if (url) (window as any).electronAPI?.shell?.openExternal(url);
  }

  openApiKeyUrl(): void {
    const url = this.selectedPreset?.apiKeyUrl;
    if (url) (window as any).electronAPI?.shell?.openExternal(url);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async saveSettings(): Promise<void> {
    if (!this.electron.isElectron || !this.selectedPresetId) return;

    const saves: Promise<void>[] = [
      this.electron.setSetting('activePresetId', this.selectedPresetId),
      this.electron.setSetting('aiModel', this.aiModel || null),
    ];

    const preset = this.selectedPreset;
    if (preset) {
      if (preset.requiresApiKey && this.apiKeyInput) {
        saves.push(this.electron.aiSetApiKey(this.selectedPresetId, this.apiKeyInput));
        this.apiKeyInput = '';
        this.apiKeyConfigured = true;
      }

      if (preset.protocol === 'ollama') {
        saves.push(this.electron.setSetting('ollamaHost', this.hostInput || null));
      } else if (preset.requiresHostInput) {
        saves.push(this.electron.setSetting('openaiCompatBaseUrl', this.hostInput || null));
      } else if (preset.defaultBaseUrl) {
        saves.push(this.electron.setSetting('openaiCompatBaseUrl', preset.defaultBaseUrl));
      }
    }

    await Promise.all(saves);

    // Refresh active status after save
    const statuses = await this.electron.aiGetProviders();
    this.activeStatus = statuses.find(s => s.active) ?? null;
    this.activeModel = this.aiModel;

    this.saved = true;
    this.testState = 'idle';
    this.showChangeProvider = false;
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

  // ── Change provider toggle ────────────────────────────────────────────────

  startChangeProvider(): void {
    this.showChangeProvider = true;
    this.selectedPresetId = this.activeStatus?.id ?? '';
    this.testState = 'idle';
  }

  cancelChangeProvider(): void {
    this.showChangeProvider = false;
    this.selectedPresetId = this.activeStatus?.id ?? '';
    this.testState = 'idle';
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async _loadPresetState(presetId: string): Promise<void> {
    const preset = this.presets.find(p => p.id === presetId);
    if (!preset) return;

    if (preset.requiresApiKey) {
      this.apiKeyConfigured = await this.electron.aiIsKeyConfigured(presetId);
    }

    if (preset.protocol === 'ollama') {
      await this.discoverOllamaModels();
    }

    // Pre-fill host from saved settings or preset default
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
