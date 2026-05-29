import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from './components/sidebar/sidebar';
import { CodeEditor } from './components/code-editor/code-editor';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Sidebar, CodeEditor],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('legacy-lens');
}
