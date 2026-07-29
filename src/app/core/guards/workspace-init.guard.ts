import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { WorkspaceManagerService } from '@app/workspace/services/workspace-manager.service';
import { WorkspaceType } from '@app/workspace/models/workspace-entity.model';

function typeFromSegments(segments: string[]): WorkspaceType | null {
  const first = segments[0];
  if (first === 'file-analysis') return 'file';
  if (first === 'folder-analysis') return 'folder';
  if (first === 'repository-analysis') return 'repository';
  return null;
}

export const workspaceInitGuard: CanActivateFn = async (route, state) => {
  const manager = inject(WorkspaceManagerService);
  const router = inject(Router);

  const segments = state.url.split('?')[0].split('/').filter(Boolean);
  const type = typeFromSegments(segments);
  if (!type) return true;

  await manager.ready;

  const forceNew = route.queryParamMap.get('new') === '1';
  const result = forceNew ? manager.createNew(type) : manager.activateOrCreateForType(type);
  if (result === null) {
    // Limit reached — limitReached$ was emitted, stay on the active workspace
    // route (or home if no workspace is active) so the page can open the modal.
    const active = manager.getActive();
    if (active) {
      const activeBase =
        active.type === 'file'
          ? 'file-analysis'
          : active.type === 'folder'
            ? 'folder-analysis'
            : 'repository-analysis';
      return router.createUrlTree([activeBase]);
    }
    return router.createUrlTree(['/']);
  }
  return true;
};
