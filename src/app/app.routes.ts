import { Routes, ActivatedRouteSnapshot } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { CollectionService } from './services/collection.service';
import { ToastService } from './components/toast/toast';
import { EditorPageComponent } from './components/editor-page/editor-page';

/**
 * `/` lands on the last-opened Project when one exists; a ?data share link
 * (and a project-less first run) stays on the Scratch Canvas. The decision
 * itself lives in CollectionService.resolveRootTarget.
 */
const rootRedirectGuard = (route: ActivatedRouteSnapshot) => {
  const collectionService = inject(CollectionService);
  const router = inject(Router);
  const target = collectionService.resolveRootTarget(route.queryParamMap.has('data'));
  return target === null ? true : router.createUrlTree(['/p', target]);
};

/** Unknown or deleted Project ids redirect to `/` with an error toast. */
const projectExistsGuard = (route: ActivatedRouteSnapshot) => {
  const collectionService = inject(CollectionService);
  if (collectionService.getProject(route.paramMap.get('projectId') ?? '')) return true;
  inject(ToastService).show('Project not found', 'error');
  return inject(Router).createUrlTree(['/']);
};

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: EditorPageComponent,
    canActivate: [rootRedirectGuard],
  },
  {
    path: 'p/:projectId',
    component: EditorPageComponent,
    canActivate: [projectExistsGuard],
  },
  { path: '**', redirectTo: '' },
];
