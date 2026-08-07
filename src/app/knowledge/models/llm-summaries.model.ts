export interface LLMSummaryEntry {
  content: string;
  status: 'complete' | 'failed' | 'stale';
  provider: string;
  model: string;
  generatedAt: string;
  error?: string;
  errorCode?: 'auth' | 'network' | 'timeout' | 'unknown';
}

export interface LLMSummaries {
  understanding?: LLMSummaryEntry;
  security?: LLMSummaryEntry;
  recommendations?: LLMSummaryEntry;
  learningPath?: LLMSummaryEntry;
  architecture?: LLMSummaryEntry;
  dataFlow?: LLMSummaryEntry;
}

export type LLMSummaryKey = keyof LLMSummaries;
