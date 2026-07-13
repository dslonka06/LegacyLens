import { Component, EventEmitter, Input, Output, OnInit, OnChanges, OnDestroy, SimpleChanges, ChangeDetectorRef, NgZone } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { SyntaxHighlightService } from '@app/core/services/syntax-highlight.service';
import { ElectronService } from '@app/core/services/electron.service';
import { AnalysisService } from '@app/analysis/services/analysis.service';
import { AiAnalysisService } from '@app/ai/services/ai-analysis.service';
import { WorkspaceClassifierService } from '@app/workspace/services/workspace-classifier.service';
import { CurrentWorkspaceService } from '@app/workspace/services/current-workspace.service';
import { ActiveWorkspaceService } from '@app/core/services/active-workspace.service';
import { AnalysisSession } from '@app/analysis/models/analysis-session.model';
import { WorkspaceProfile, FileMetadata } from '@app/workspace/models/workspace.model';
import { WorkspaceType } from '@app/workspace/models/workspace-entity.model';

// Extension → Shiki language ID
const EXT_LANGUAGE_MAP: Record<string, string> = {
  cs:     'csharp',
  ts:     'typescript',
  tsx:    'typescript',
  js:     'javascript',
  jsx:    'javascript',
  html:   'html',
  htm:    'html',
  css:    'css',
  scss:   'scss',
  less:   'less',
  sql:    'sql',
  py:     'python',
  json:   'json',
  xml:    'xml',
  csproj: 'xml',
  props:  'xml',
  config: 'xml',
  md:     'markdown',
  txt:    'plaintext',
  sh:     'shellscript',
  bash:   'shellscript',
  yml:    'yaml',
  yaml:   'yaml',
};

const LANGUAGE_LABEL: Record<string, string> = {
  csharp:     'C#',
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  html:       'HTML',
  css:        'CSS',
  scss:       'SCSS',
  less:       'Less',
  sql:        'SQL',
  python:     'Python',
  json:       'JSON',
  xml:        'XML',
  markdown:   'Markdown',
  plaintext:  'Plain Text',
  shellscript: 'Shell',
  yaml:       'YAML',
};

@Component({
  selector: 'app-code-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './code-editor.html',
  styleUrl: './code-editor.scss'
})
export class CodeEditor implements OnInit, OnChanges, OnDestroy {

  @Input() restoredFileName: string | null = null;
  @Input() restoredSourceCode: string | null = null;
  @Input() readOnly = false;
  @Input() hideFolderUpload = false;

  @Output() readonly analyze = new EventEmitter<AnalysisSession>();
  @Output() readonly workspaceReady = new EventEmitter<WorkspaceProfile | null>();
  @Output() readonly filesUploaded = new EventEmitter<File[]>();

  code = '';
  fileName = 'untitled.txt';
  isAnalyzing = false;
  isLoadingFile = false;
  lastAnalyzedLabel: string | null = null;
  highlightedHtml: SafeHtml | null = null;

  uploadedFiles: File[] = [];
  workspaceProfile: WorkspaceProfile | null = null;

  private currentLanguage = 'plaintext';
  private themeSub: Subscription | null = null;

  aiError: string | null = null;

  constructor(
    private readonly analysisService: AnalysisService,
    private readonly aiAnalysisService: AiAnalysisService,
    private readonly workspaceClassifier: WorkspaceClassifierService,
    private readonly currentWorkspace: CurrentWorkspaceService,
    private readonly activeWorkspace: ActiveWorkspaceService,
    private readonly cdr: ChangeDetectorRef,
    private readonly zone: NgZone,
    private readonly highlighter: SyntaxHighlightService,
    private readonly sanitizer: DomSanitizer,
    readonly electronService: ElectronService
  ) {}

  ngOnInit(): void {
    this.themeSub = this.highlighter.themeChange$.subscribe(() => {
      if (this.code) this.renderHighlight();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['restoredFileName'] && this.restoredFileName) {
      this.fileName = this.restoredFileName;
    }
    if (changes['restoredSourceCode'] && this.restoredSourceCode !== null) {
      const incomingCode = this.restoredSourceCode;
      if (this.code !== incomingCode) {
        this.code = incomingCode;
      }
      this.lastAnalyzedLabel = 'Restored';
      this.currentLanguage = this.restoredFileName
        ? this.languageFromFileName(this.restoredFileName)
        : this.languageFromContent(incomingCode);
      this.renderHighlight();
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    this.themeSub?.unsubscribe();
  }

  private renderHighlight(): void {
    if (!this.code) {
      this.highlightedHtml = null;
      return;
    }
    this.highlighter.highlight(this.code, this.currentLanguage).then(html => {
      this.zone.run(() => {
        this.highlightedHtml = this.sanitizer.bypassSecurityTrustHtml(html);
        this.cdr.detectChanges();
      });
    });
  }

  get detectedLanguage(): string {
    return LANGUAGE_LABEL[this.currentLanguage] ?? 'Auto';
  }

  get langBadgeClass(): string {
    const map: Record<string, string> = {
      csharp:     'lang-csharp',
      typescript: 'lang-typescript',
      javascript: 'lang-javascript',
      sql:        'lang-sql',
      python:     'lang-python',
      html:       'lang-html',
      css:        'lang-css',
      scss:       'lang-css',
      json:       'lang-json',
      xml:        'lang-xml',
      markdown:   'lang-markdown',
    };
    return map[this.currentLanguage] ?? 'lang-default';
  }

  get langIconType(): string {
    const map: Record<string, string> = {
      csharp:     'csharp',
      typescript: 'typescript',
      javascript: 'javascript',
      sql:        'database',
      python:     'python',
      html:       'html',
      json:       'json',
    };
    return map[this.currentLanguage] ?? 'file';
  }

  get lineCount(): number {
    return this.code ? this.code.split('\n').length : 1;
  }

  get isMultiFileWorkspace(): boolean {
    return this.uploadedFiles.length > 1;
  }

  get additionalFileCount(): number {
    return Math.max(0, this.uploadedFiles.length - 1);
  }

  loadFile(name: string, content: string): void {
    this.fileName = name;
    this.code = content;
    this.lastAnalyzedLabel = null;
    this.currentLanguage = this.languageFromFileName(name) ?? this.languageFromContent(content);
    this.renderHighlight();
    this.cdr.detectChanges();
  }

  clearFile(): void {
    this.code = '';
    this.fileName = 'untitled.txt';
    this.lastAnalyzedLabel = null;
    this.currentLanguage = 'plaintext';
    this.highlightedHtml = null;
    this.uploadedFiles = [];
    this.workspaceProfile = null;
    this.currentWorkspace.clear();
    this.workspaceReady.emit(null);
    this.filesUploaded.emit([]);
    this.cdr.detectChanges();
  }

  onTextareaBlur(): void {
    if (!this.code.trim()) return;
    this.currentLanguage = this.languageFromContent(this.code);
    this.renderHighlight();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    this.processFiles(Array.from(input.files));
    input.value = '';
  }

  onFolderSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const files = Array.from(input.files).filter(f => !this.isIgnoredPath(f));
    this.processFiles(files);
    input.value = '';
  }

  async onElectronFolderPick(): Promise<void> {
    const result = await this.electronService.pickAndReadFolder('Select Project Folder');
    if (!result) return;

    const files = result.files.map(entry => {
      // content is null for non-source/oversized files — empty blob preserves workspace
      // structure (file count, extension distribution) without loading unnecessary bytes
      const blob = new Blob([entry.content ?? ''], { type: 'text/plain' });
      const file = new File([blob], entry.name, { type: 'text/plain' });
      Object.defineProperty(file, 'webkitRelativePath', {
        value: entry.relativePath,
        writable: false,
      });
      return file;
    });

    this.zone.run(() => this.processFiles(files));
  }

  private async processFiles(files: File[]): Promise<void> {
    if (files.length === 0) return;

    this.isLoadingFile = true;
    this.uploadedFiles = files;

    const metadata = this.buildFileMetadata(files);
    this.workspaceProfile = await this.workspaceClassifier.classify(metadata);
    this.currentWorkspace.set(this.workspaceProfile, files);
    this.workspaceReady.emit(this.workspaceProfile);
    this.filesUploaded.emit(files);

    const primaryFile = this.selectPrimaryFile(files);
    this.fileName = primaryFile.name;

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      this.code = content;
      this.isLoadingFile = false;
      this.lastAnalyzedLabel = null;
      this.currentLanguage = this.languageFromFileName(primaryFile.name)
        ?? this.languageFromContent(content);
      this.renderHighlight();
      this.cdr.detectChanges();
      this.analyzeCode();
    };
    reader.readAsText(primaryFile);
  }

  private selectPrimaryFile(files: File[]): File {
    const sourceExtensions = new Set(['cs', 'ts', 'js', 'py', 'java', 'go', 'rs', 'rb', 'php', 'cpp', 'c']);
    const sourceFile = files.find(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      return sourceExtensions.has(ext);
    });
    return sourceFile ?? files[0];
  }

  private isIgnoredPath(file: File): boolean {
    const path = (file as any).webkitRelativePath || file.name;
    const segments = path.split('/');
    const ignoredDirs = new Set(['node_modules', '.git', 'bin', 'obj', 'dist', '.angular', 'coverage', '.nyc_output']);
    return segments.some((seg: string) => ignoredDirs.has(seg));
  }

  async analyzeCode(): Promise<void> {
    if (!this.code.trim() || this.isAnalyzing) return;

    this.isAnalyzing = true;
    this.aiError = null;
    this.cdr.detectChanges();

    const patternResult = await this.analysisService.analyze(this.code);
    const session: AnalysisSession = {
      scope: this.activeScope,
      fileName: this.fileName,
      sourceCode: this.code,
      analysis: patternResult,
      createdAt: new Date().toISOString(),
      workspaceContext: this.workspaceProfile ?? undefined,
    };
    this.analyze.emit(session);
    this.cdr.detectChanges();

    try {
      const aiResult = await firstValueFrom(
        this.aiAnalysisService.analyze(this.fileName, this.code)
      );
      const enrichedSession: AnalysisSession = { ...session, aiAnalysis: aiResult };
      this.analyze.emit(enrichedSession);
      this.lastAnalyzedLabel = `AI · ${aiResult.model}`;
    } catch {
      this.aiError = 'AI analysis unavailable. Showing pattern-based results.';
      this.lastAnalyzedLabel = 'Just now';
    } finally {
      this.isAnalyzing = false;
      this.cdr.detectChanges();
    }
  }

  private get activeScope(): WorkspaceType {
    const ws = this.activeWorkspace.workspace;
    if (ws === 'folder')     return 'folder';
    if (ws === 'repository') return 'repository';
    return 'file';
  }

  // ─── Language detection ───────────────────────────────

  private languageFromFileName(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    return EXT_LANGUAGE_MAP[ext] ?? 'plaintext';
  }

  private languageFromContent(code: string): string {
    if (!code?.trim()) return 'plaintext';

    if (code.includes('using System') || code.includes('namespace ') ||
        (code.includes('public class') && code.includes('{'))) return 'csharp';

    if (code.includes('@Component') || code.includes('@NgModule') ||
        code.includes('@Injectable') || code.includes('import {')) return 'typescript';

    if (code.includes('export class') || code.includes('export default') ||
        code.includes('export const') || code.includes('export function')) return 'typescript';

    if (code.trimStart().startsWith('<!DOCTYPE') ||
        code.trimStart().startsWith('<html') ||
        (code.includes('<div') && code.includes('</div>'))) return 'html';

    const upper = code.toUpperCase();
    if (upper.includes('SELECT ') && (upper.includes(' FROM ') || upper.includes('\nFROM '))) return 'sql';
    if (upper.includes('INSERT INTO') || upper.includes('CREATE TABLE')) return 'sql';

    if ((code.trimStart().startsWith('{') || code.trimStart().startsWith('[')) &&
        (code.trimEnd().endsWith('}') || code.trimEnd().endsWith(']'))) {
      try { JSON.parse(code); return 'json'; } catch { /* not valid JSON */ }
    }

    if (code.trimStart().startsWith('<?xml') || code.trimStart().startsWith('<Project')) return 'xml';

    return 'plaintext';
  }

  private buildFileMetadata(files: File[]): FileMetadata[] {
    const EXT_TO_LANGUAGE: Record<string, string> = {
      cs: 'C#', ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
      html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'SCSS', less: 'Less', sql: 'SQL',
      py: 'Python', json: 'JSON', xml: 'XML', md: 'Markdown', txt: 'Plain Text',
      sh: 'Shell', bash: 'Shell', yml: 'YAML', yaml: 'YAML',
      rs: 'Rust', go: 'Go', java: 'Java', kt: 'Kotlin', swift: 'Swift',
      rb: 'Ruby', php: 'PHP', cpp: 'C++', c: 'C', h: 'C/C++ Header', hpp: 'C++ Header',
    };
    return files.map(f => {
      const name = f.name;
      const path = (f as any).webkitRelativePath || name;
      const parts = name.toLowerCase().split('.');
      const extension = parts.length > 1 ? parts[parts.length - 1] : '';
      return { name, path, extension, language: EXT_TO_LANGUAGE[extension] ?? 'Unknown', size: f.size };
    });
  }
}
