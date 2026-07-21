export interface LLMSummaries {
  understanding?: string;
  security?: string;
  recommendations?: string;
  learningPath?: string;
  architecture?: string;
  dataFlow?: string;
}

export type LLMSummaryKey = keyof LLMSummaries;
