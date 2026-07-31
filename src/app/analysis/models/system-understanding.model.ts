export type HealthLevel = 'Low' | 'Medium' | 'High';
export type CriticalityLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface SystemHealthSummary {
  complexity: HealthLevel;
  maintainability: HealthLevel;
  riskLevel: HealthLevel;
  interpretation: string;
}

export interface ImportantItem {
  name: string;
  path: string;
  whyImportant: string;
}

export interface ImportantWorkflow {
  name: string;
  description: string;
}

export interface ImportantDependency {
  name: string;
  type: 'external' | 'internal' | 'framework' | 'database' | 'queue' | 'storage';
  whyImportant: string;
}

export interface TechDebtHotspot {
  name: string;
  reason: string;
  impact: string;
}

export interface CoreCapability {
  name: string;
  description: string;
  businessValue: string;
}

export interface ResponsibilityComponent {
  name: string;
  path: string;
  whyImportant: string;
  blastRadius: 'High' | 'Medium' | 'Low';
}

export interface ResponsibilityGroup {
  responsibility: string;
  components: ResponsibilityComponent[];
}

export interface SystemUnderstanding {
  scope: 'file' | 'folder' | 'repository';

  executiveSummary: string;
  businessPurpose: string;
  whyItMatters: string;

  // File: responsibilities, Folder: major components, Repository: core capabilities
  keyResponsibilities: string[];

  keyWorkflows: string[];
  criticalAreas: string[];
  highRiskAreas: string[];

  // File: functions/classes, Folder: files/modules, Repository: components/services
  mostImportantItems: ImportantItem[];

  coreCapabilities: CoreCapability[];

  businessCriticality: CriticalityLevel;
  businessCriticalityReason: string;

  health: SystemHealthSummary;

  understandingNarrative: string;

  responsibilityGroups: ResponsibilityGroup[];

  // Repository-only (null for file/folder)
  technicalDebtHotspots: TechDebtHotspot[] | null;
  mostImportantWorkflows: ImportantWorkflow[] | null;
  mostImportantDependencies: ImportantDependency[] | null;

  generatedAt: string;
}
