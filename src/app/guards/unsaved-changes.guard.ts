import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { UnsavedChangesService } from '../services/unsaved-changes.service';

export const unsavedChangesGuard: CanDeactivateFn<unknown> = () => {
  return inject(UnsavedChangesService).confirm();
};
