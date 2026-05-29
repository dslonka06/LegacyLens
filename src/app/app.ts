import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Sidebar } from './components/sidebar/sidebar';
import { CodeEditor } from './components/code-editor/code-editor';
import { AnalysisPanel } from './components/analysis-panel/analysis-panel';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    Sidebar,
    CodeEditor,
    AnalysisPanel
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('legacy-lens');
}