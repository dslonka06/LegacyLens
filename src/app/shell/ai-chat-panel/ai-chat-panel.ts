import { Component, EventEmitter, OnInit, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const SUGGESTED_PROMPTS: Record<string, string[]> = {
  file: [
    'What does this file do?',
    'What are the main dependencies?',
    'Are there any security concerns?',
  ],
  folder: [
    'What is the overall architecture?',
    'Which files are most important?',
    'What patterns are used here?',
  ],
  repository: [
    'Give me an overview of this codebase.',
    'Where should I start as a new developer?',
    'What are the main components?',
  ],
  default: [
    'What did the analysis find?',
    'Where should I start?',
    'Are there any issues to fix?',
  ],
};

@Component({
  selector: 'app-ai-chat-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-chat-panel.html',
  styleUrl: './ai-chat-panel.scss',
})
export class AiChatPanel implements OnInit, OnDestroy {

  @Output() closeRequested = new EventEmitter<void>();

  messages: ChatMessage[] = [];
  inputValue = '';
  isLoading  = false;

  private workspaceId: string | null = null;
  private sub: Subscription | null = null;

  constructor(private readonly manager: WorkspaceManagerService) {}

  ngOnInit(): void {
    this.sub = this.manager.activeWorkspace$.subscribe(ws => {
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
    return this.messages.length === 0 ? (SUGGESTED_PROMPTS[key] ?? SUGGESTED_PROMPTS['default']) : [];
  }

  get hasMessages(): boolean {
    return this.messages.length > 0;
  }

  selectPrompt(prompt: string): void {
    this.inputValue = prompt;
    this.send();
  }

  send(): void {
    const text = this.inputValue.trim();
    if (!text || this.isLoading) return;

    this.messages.push({ role: 'user', content: text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    this.inputValue = '';
    this.isLoading  = true;

    // Placeholder until AiKnowledgeService is wired in Phase B
    setTimeout(() => {
      this.messages.push({
        role:      'assistant',
        content:   'AI chat will be fully wired to the knowledge model in the next phase.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      this.isLoading = false;
    }, 600);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }
}
