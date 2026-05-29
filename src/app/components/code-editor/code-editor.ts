import { Component, EventEmitter, Output, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-code-editor',
  imports: [FormsModule],
  templateUrl: './code-editor.html',
  styleUrl: './code-editor.scss',
})
export class CodeEditor {

  code = '';
  isLoadingFile = false;

  constructor(
    private readonly cdr: ChangeDetectorRef
  ) {}

  @Output()
  analyze = new EventEmitter<any>();

  onFileSelected(event: Event): void {

    console.log('File selected');

    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];

    console.log('Loading file:', file.name);

    this.isLoadingFile = true;

    const reader = new FileReader();

    reader.onload = () => {

      console.log('File loaded');

      this.code = reader.result as string;

      this.isLoadingFile = false;

      this.cdr.detectChanges();

      console.log('Code updated');
    };

    reader.readAsText(file);
  }

  analyzeCode() {

    const lineCount = this.code
      .split('\n')
      .filter(line => line.trim().length > 0)
      .length;

    let complexity = 'Low';

    if (lineCount >= 75) {
      complexity = 'High';
    }
    else if (lineCount >= 30) {
      complexity = 'Medium';
    }

    let analysis: any;

    if (
      this.code.includes('[ApiController]') ||
      this.code.includes('Controller')
    ) {

      analysis = {
        language: 'C#',
        type: 'API Controller',
        complexity,
        maintainability: 'Medium',
        summary:
          'This appears to be an ASP.NET API controller responsible for handling HTTP requests.',
        risks: [
          'Endpoint validation should be reviewed',
          'Authorization requirements should be verified'
        ],
        suggestions: [
          'Add request validation',
          'Add exception handling',
          'Review authorization attributes'
        ]
      };

    } else if (
      this.code.includes('Repository')
    ) {

      analysis = {
        language: 'C#',
        type: 'Repository',
        complexity,
        maintainability: 'Medium',
        summary:
          'This appears to be a repository responsible for database access.',
        risks: [
          'Potential data access bottlenecks'
        ],
        suggestions: [
          'Add caching where appropriate',
          'Review query performance'
        ]
      };

    } else if (
      this.code.includes('interface')
    ) {

      analysis = {
        language: 'C#',
        type: 'Interface',
        complexity: 'Low',
        maintainability: 'High',
        summary:
          'This appears to define a contract through an interface.',
        risks: [],
        suggestions: [
          'Keep interfaces focused and small'
        ]
      };

    } else if (
      this.code.includes('@Component')
    ) {

      analysis = {
        language: 'TypeScript',
        type: 'Angular Component',
        complexity,
        maintainability: 'Medium',
        summary:
          'This appears to be an Angular component responsible for UI behavior.',
        risks: [
          'UI logic may become difficult to maintain if it grows too large'
        ],
        suggestions: [
          'Move business logic into services',
          'Keep components focused on presentation'
        ]
      };

    } else if (
      this.code.includes('export class')
    ) {

      analysis = {
        language: 'TypeScript',
        type: 'TypeScript Class',
        complexity,
        maintainability: 'Medium',
        summary:
          'This appears to be a TypeScript class.',
        risks: [],
        suggestions: [
          'Review separation of concerns'
        ]
      };

    } else if (
      !this.code.includes('export class') &&
      this.code.includes('class') &&
      this.code.includes('Service')
    ) {

      analysis = {
        language: 'C#',
        type: 'Service Class',
        complexity,
        maintainability: 'Medium',
        summary:
          'This appears to be a service class responsible for business logic.',
        risks: [
          'No error handling detected'
        ],
        suggestions: [
          'Add logging',
          'Add dependency injection'
        ]
      };

    } else if (
      this.code.includes('[HttpGet]') ||
      this.code.includes('[HttpPost]') ||
      this.code.includes('[HttpPut]') ||
      this.code.includes('[HttpDelete]')
    ) {

      analysis = {
        language: 'C#',
        type: 'API Endpoint',
        complexity,
        maintainability: 'Medium',
        summary:
          'This appears to define one or more API endpoints.',
        risks: [
          'Input validation should be verified'
        ],
        suggestions: [
          'Review status code handling',
          'Review authentication and authorization'
        ]
      };

    } else if (
      this.code.toUpperCase().includes('SELECT')
    ) {

      analysis = {
        language: 'SQL',
        type: 'Database Query',
        complexity,
        maintainability: 'High',
        summary:
          'This appears to be a SQL query.',
        risks: [
          'Potential performance issues'
        ],
        suggestions: [
          'Review indexes',
          'Avoid SELECT *'
        ]
      };

    } else {

      analysis = {
        language: 'Unknown',
        type: 'Unknown',
        complexity: 'Unknown',
        maintainability: 'Unknown',
        summary:
          'LegacyLens could not identify the code type.',
        risks: [],
        suggestions: []
      };

    }

    this.analyze.emit(analysis);
  }
}