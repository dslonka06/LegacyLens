import { ChangeDetectorRef, Component, ElementRef, EventEmitter, OnInit, OnDestroy, Output, ViewChild, Pipe, PipeTransform } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { marked } from 'marked';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { ElectronService } from '@app/core/services/electron.service';

@Pipe({ name: 'markdown', standalone: true })
export class MarkdownPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}
  transform(value: string): SafeHtml {
    const html = marked.parse(value, { async: false }) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const SUGGESTED_PROMPTS: Record<string, string[]> = {
  file: [
    'What does this file do?',
    'Are there any security concerns?',
    'What are the main dependencies?',
    'How complex is this file?',
  ],
  folder: [
    'What is the overall architecture?',
    'Which files are most important?',
    'What patterns are used here?',
    'Are there any security issues?',
  ],
  repository: [
    'Give me an overview of this codebase.',
    'Where should I start as a new developer?',
    'What are the biggest risks or issues?',
    'What are the main architectural patterns?',
  ],
  default: ['What did the analysis find?', 'Where should I start?', 'Are there any issues to fix?'],
};

@Component({
  selector: 'app-ai-chat-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownPipe],
  templateUrl: './ai-chat-panel.html',
  styleUrl: './ai-chat-panel.scss',
})
export class AiChatPanel implements OnInit, OnDestroy {
  @Output() closeRequested = new EventEmitter<void>();
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef<HTMLElement>;

  messages: ChatMessage[] = [];
  inputValue = '';
  isLoading = false;

  private workspaceId: string | null = null;
  private sub: Subscription | null = null;

  constructor(
    private readonly manager: WorkspaceManagerService,
    private readonly electron: ElectronService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.sub = this.manager.activeWorkspace$.subscribe((ws) => {
      if (ws?.id !== this.workspaceId) {
        this.messages = [];
        this.workspaceId = ws?.id ?? null;
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get suggestedPrompts(): string[] {
    const ws = this.manager.getActive();
    const key = ws?.type ?? 'default';
    return this.messages.length === 0
      ? (SUGGESTED_PROMPTS[key] ?? SUGGESTED_PROMPTS['default'])
      : [];
  }

  get hasMessages(): boolean {
    return this.messages.length > 0;
  }

  get hasContext(): boolean {
    return !!this.manager.getActive()?.knowledgeModel;
  }

  get workspaceName(): string {
    return this.manager.getActive()?.name ?? '';
  }

  selectPrompt(prompt: string): void {
    this.inputValue = prompt;
    this.send();
  }

  send(): void {
    const text = this.inputValue.trim();
    if (!text || this.isLoading) return;

    this.messages.push({
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    this.inputValue = '';
    this.isLoading = true;
    this.cdr.detectChanges();
    this.scrollToBottom();

    const knowledgeModel = this.manager.getActive()?.knowledgeModel ?? null;

    // Send only role+content — timestamps are local UI state, not part of the LLM exchange
    const payload = this.messages.map(m => ({ role: m.role, content: m.content }));

    this.electron.aiChat(payload, knowledgeModel).then(
      (response) => {
        this.messages.push({
          role: 'assistant',
          content: response ?? 'No response received.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
        this.isLoading = false;
        this.cdr.detectChanges();
        this.scrollToBottom();
      },
      (err) => {
        const reason = err instanceof Error ? err.message : String(err);
        this.messages.push({
          role: 'assistant',
          content: `Unable to reach the AI provider. ${reason}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
        this.isLoading = false;
        this.cdr.detectChanges();
        this.scrollToBottom();
      },
    );
  }

  private scrollToBottom(): void {
    // detectChanges must run first so the DOM reflects the new messages before we measure scrollHeight
    this.cdr.detectChanges();
    const el = this.messagesContainer?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }
}
