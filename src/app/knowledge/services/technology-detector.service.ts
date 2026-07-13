import { Injectable } from '@angular/core';
import { FileMetadata } from '@app/workspace/models/workspace.model';
import { ElectronService } from '@app/core/services/electron.service';

export interface TechnologyDetectionResult {
  name: string;
  category: string;
  confidence: number;
  detectedBy: string;
  sourceFile?: string;
}

@Injectable({ providedIn: 'root' })
export class TechnologyDetectorService {
  constructor(private readonly electron: ElectronService) {}

  async detect(files: FileMetadata[]): Promise<TechnologyDetectionResult[]> {
    return this.electron.intelligenceDetectTechnologies(files) as Promise<
      TechnologyDetectionResult[]
    >;
  }

  frameworks(results: TechnologyDetectionResult[]): string[] {
    return results.filter((r) => r.category === 'framework').map((r) => r.name);
  }
}
