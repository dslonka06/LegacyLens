import { Injectable } from '@angular/core';
import { ElectronService } from './electron.service';

export type AnalysisTarget = 'file' | 'folder' | 'repository';
export type DetectedTarget = 'file' | 'folder' | 'repository' | 'unknown' | 'invalid';

export interface ValidationResult {
  intended: AnalysisTarget;
  detected: DetectedTarget;
  path: string;
  valid: boolean;
  mismatch: boolean;
  suggestion: AnalysisTarget | null;
  message: string | null;
}

@Injectable({ providedIn: 'root' })
export class TargetValidationService {
  constructor(private readonly electron: ElectronService) {}

  async validate(path: string, intended: AnalysisTarget): Promise<ValidationResult> {
    if (!this.electron.isElectron) {
      return {
        intended,
        detected: intended,
        path,
        valid: true,
        mismatch: false,
        suggestion: null,
        message: null,
      };
    }

    const result = await this.electron.detectTarget(path);
    const detected = result.detected as DetectedTarget;

    if (detected === 'invalid') {
      return {
        intended,
        detected,
        path,
        valid: false,
        mismatch: false,
        suggestion: null,
        message: 'The selected path does not exist or cannot be accessed.',
      };
    }

    if (detected === 'unknown') {
      return {
        intended,
        detected,
        path,
        valid: false,
        mismatch: false,
        suggestion: null,
        message: 'The selected path could not be identified.',
      };
    }

    if (detected === intended) {
      return {
        intended,
        detected,
        path,
        valid: true,
        mismatch: false,
        suggestion: null,
        message: null,
      };
    }

    const suggestion = detected as AnalysisTarget;
    const message = this.buildMessage(intended, detected);

    return { intended, detected, path, valid: false, mismatch: true, suggestion, message };
  }

  private buildMessage(intended: AnalysisTarget, detected: DetectedTarget): string {
    if (intended === 'repository' && detected === 'folder') {
      return 'The selected folder does not appear to be a Git repository. Would you like to analyze it as a Folder Analysis instead?';
    }
    if (intended === 'folder' && detected === 'repository') {
      return 'A Git repository was detected in the selected folder. Would you like to analyze it as a Repository Analysis instead?';
    }
    if (intended === 'file' && detected === 'folder') {
      return 'The selected path is a folder, not a file. Would you like to switch to Folder Analysis?';
    }
    if (intended === 'file' && detected === 'repository') {
      return 'The selected path is a repository, not a file. Would you like to switch to Repository Analysis?';
    }
    if ((intended === 'folder' || intended === 'repository') && detected === 'file') {
      return 'The selected path is a single file. Would you like to switch to File Analysis?';
    }
    return `Expected a ${intended} but detected a ${detected}. Would you like to continue with the correct analysis type?`;
  }
}
