import { Routes } from '@angular/router';

export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
    { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },
    { path: 'request/new', loadComponent: () => import('./pages/request-detail/request-detail.component').then(m => m.RequestDetailComponent) },
    { path: 'request/:id', loadComponent: () => import('./pages/request-detail/request-detail.component').then(m => m.RequestDetailComponent) },
    { path: '**', redirectTo: 'login' }
];
