import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeService } from '@app/core/services/theme.service';
import { ElectronService } from '@app/core/services/electron.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
})
export class SettingsPage implements OnInit {
  aiProvider = '';
  aiModel = '';
  aiProviderUrl = '';
  saved = false;

  constructor(
    readonly theme: ThemeService,
    readonly electron: ElectronService,
  ) {}

  ngOnInit(): void {
    if (this.electron.isElectron) {
      Promise.all([this.electron.getAllSettings(), this.electron.getAiProviderUrl()]).then(
        ([settings, providerUrl]) => {
          this.aiProvider = (settings['aiProvider'] as string) ?? '';
          this.aiModel = (settings['aiModel'] as string) ?? '';
          this.aiProviderUrl = providerUrl ?? '';
        },
      );
    }
  }

  async saveAiSettings(): Promise<void> {
    if (!this.electron.isElectron) return;
    await Promise.all([
      this.electron.setSetting('aiProvider', this.aiProvider || null),
      this.electron.setSetting('aiModel', this.aiModel || null),
      this.electron.setAiProviderUrl(this.aiProviderUrl || null),
    ]);
    this.saved = true;
    setTimeout(() => {
      this.saved = false;
    }, 2000);
  }
}
