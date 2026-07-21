import type { KnowledgeModel, AIStage } from '@app/knowledge/models/knowledge-model.contract';
import type { Workspace } from '@app/workspace/models/workspace-entity.model';
import type { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';

export type PipelineStageState = 'idle' | 'running' | 'complete' | 'partial' | 'failed';

export interface AIPipelineSubstep {
  key: string;
  label: string;
  state: Exclude<PipelineStageState, 'partial'>;
}

export interface AIPipelineStage {
  id: string;
  label: string;
  state: PipelineStageState;
  substeps?: AIPipelineSubstep[];
}

export interface AIPipelineState {
  stages: AIPipelineStage[];
  isRunning: boolean;
  hasFailure: boolean;
  /** True when generate was skipped because no AI provider URL is configured. */
  noProvider: boolean;
}

const DERIVE_STAGE_LABELS: Partial<Record<AIStage, string>> = {
  understanding: 'Understanding',
  security: 'Security',
  recommendations: 'Recommendations',
  architecture: 'Architecture',
  dataFlow: 'Data Flow',
  learningPath: 'Learning Path',
};

const DERIVE_STAGES: AIStage[] = [
  'understanding', 'security', 'recommendations', 'architecture', 'dataFlow', 'learningPath',
];

function stageState(
  stage: AIStage,
  ai: { completedStages: AIStage[]; failedStages: AIStage[]; partialStages?: AIStage[] } | undefined,
  running: Set<AIStage>,
): PipelineStageState {
  if (!ai) return running.has(stage) ? 'running' : 'idle';
  if (ai.completedStages.includes(stage)) return 'complete';
  if (ai.partialStages?.includes(stage)) return 'partial';
  if (ai.failedStages.includes(stage)) return 'failed';
  if (running.has(stage)) return 'running';
  return 'idle';
}

export function buildAIPipelineState(
  model: KnowledgeModel | null,
  workspace: Workspace | null,
  manager: WorkspaceManagerService,
): AIPipelineState {
  const ai = model?.ai;
  const wsId = workspace?.id ?? '';
  const running = manager.getActiveStages(wsId);
  const wsStatus = workspace?.status;

  // ── Scan ─────────────────────────────────────────────────────────────────
  let scanState: PipelineStageState = 'idle';
  if (model) {
    scanState = 'complete';
  } else if (wsStatus === 'processing') {
    scanState = 'running';
  }

  // ── Derive ────────────────────────────────────────────────────────────────
  const deriveSubsteps: AIPipelineSubstep[] = DERIVE_STAGES.map(s => ({
    key: s,
    label: DERIVE_STAGE_LABELS[s] ?? s,
    // Individual derive stages are never partial — only the derive group is.
    state: stageState(s, ai, running) as Exclude<PipelineStageState, 'partial'>,
  }));
  const anyDeriveRunning  = DERIVE_STAGES.some(s => running.has(s));
  const allDeriveSettled  = !!ai && DERIVE_STAGES.every(s =>
    ai.completedStages.includes(s) || ai.failedStages.includes(s),
  );
  const someDeriveComplete = !!ai && DERIVE_STAGES.some(s => ai.completedStages.includes(s));
  const someDerveFailed    = !!ai && DERIVE_STAGES.some(s => ai.failedStages.includes(s));
  let deriveState: PipelineStageState = 'idle';
  if (anyDeriveRunning)                      deriveState = 'running';
  else if (allDeriveSettled && someDerveFailed) deriveState = 'partial';
  else if (allDeriveSettled)                   deriveState = 'complete';
  else if (someDeriveComplete)                 deriveState = 'partial';

  // ── Prompt ────────────────────────────────────────────────────────────────
  const promptState   = stageState('prompt', ai, running);

  // ── Generate ─────────────────────────────────────────────────────────────
  const generateState = stageState('generate', ai, running);

  // noProvider: generate was attempted but failed with the sentinel error message
  const noProvider = ai?.failedStages.includes('generate') === true
    && ai?.stageErrors?.['generate'] === 'no-provider';

  // ── Finalise ─────────────────────────────────────────────────────────────
  const finaliseState: PipelineStageState = wsStatus === 'ready' && !!ai ? 'complete' : 'idle';

  const isRunning  = running.size > 0 || wsStatus === 'processing';
  const hasFailure = (ai?.failedStages?.length ?? 0) > 0;

  return {
    isRunning,
    hasFailure,
    noProvider,
    stages: [
      { id: 'scan',     label: 'Scan',     state: scanState },
      { id: 'derive',   label: 'Derive',   state: deriveState, substeps: deriveSubsteps },
      { id: 'prompt',   label: 'Prompt',   state: promptState },
      { id: 'generate', label: 'Generate', state: generateState },
      { id: 'finalise', label: 'Finalise', state: finaliseState },
    ],
  };
}
