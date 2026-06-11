import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AnalysisSession } from '../../models/analysis-session.model';
import { CurrentAnalysisService } from '../../services/current-analysis.service';

@Component({
  selector: 'app-file-architecture-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './file-architecture-page.html',
  styleUrl: './file-architecture-page.scss'
})
export class FileArchitecturePage implements OnInit, OnDestroy {

  session: AnalysisSession | null = null;
  private sub: Subscription | null = null;

  constructor(private readonly currentAnalysis: CurrentAnalysisService) {}

  ngOnInit(): void {
    this.sub = this.currentAnalysis.session$.subscribe(s => { this.session = s; });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  get isAiPowered(): boolean {
    const arch = this.session?.aiAnalysis?.architecture;
    return !!(arch && (arch.patterns.length > 0 || arch.responsibilities.length > 0 || arch.dependencies.length > 0));
  }

  get patterns(): string[] {
    if (this.isAiPowered) return this.session!.aiAnalysis!.architecture.patterns;
    return this.session?.analysis.patterns ?? [];
  }

  get responsibilities(): string[] {
    if (this.isAiPowered) return this.session!.aiAnalysis!.architecture.responsibilities;
    return this.session?.analysis.responsibilities ?? [];
  }

  get dependencies(): string[] {
    if (this.isAiPowered) return this.session!.aiAnalysis!.architecture.dependencies;
    return this.session?.analysis.dependencies ?? [];
  }

  get architectureNarrative(): string {
    return this.session?.aiAnalysis?.summary ?? this.session?.analysis.architecture ?? '';
  }

  get architectureLayers(): string[] {
    return this.session?.analysis.architectureLayers ?? [];
  }

  get inputs(): string[] {
    return this.session?.analysis.inputs ?? [];
  }

  get outputs(): string[] {
    return this.session?.analysis.outputs ?? [];
  }

  patternDescription(name: string): string {
    const descriptions: Record<string, string> = {
      'Clean Architecture':        'Business logic isolated from infrastructure. Dependencies point inward.',
      'MVC':                       'Model, View, Controller separation — each layer has a distinct role.',
      'CQRS':                      'Read and write operations handled separately. Queries and commands are decoupled.',
      'Layered Architecture':      'Code organised into horizontal layers: presentation, business logic, data access.',
      'Microservice Architecture': 'Independently deployable services, each owning its own data.',
      'Feature-Sliced Design':     'Code grouped by feature slice rather than by technical layer.',
      'Hexagonal Architecture':    'Application core surrounded by ports and adapters.',
      'Singleton':                 'A single shared instance managed throughout the application lifecycle.',
      'Observer':                  'Event-driven updates propagated to subscribers when state changes.',
      'Factory':                   'Object creation delegated to a factory method or class.',
      'Repository':                'Data access abstracted behind a consistent interface.',
      'Service Layer':             'Business logic encapsulated in dedicated service classes.',
      'Decorator':                 'Behaviour added to objects dynamically without subclassing.',
      'Strategy':                  'Interchangeable algorithms encapsulated behind a common interface.',
    };
    return descriptions[name] ?? 'Architectural pattern detected from code structure analysis.';
  }
}
