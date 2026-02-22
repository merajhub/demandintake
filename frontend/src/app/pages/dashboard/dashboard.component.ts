import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { HeaderComponent } from '../../components/header/header.component';
import { AuthService } from '../../services/auth.service';
import { RequestService } from '../../services/request.service';
import { IntakeRequest, User } from '../../models/interfaces';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterModule, ButtonModule,
    HeaderComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  currentUser: User | null = null;
  requests: IntakeRequest[] = [];
  statusFilter = '';
  statusOptions = [
    { value: '', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'scrub_review', label: 'Scrub Review' },
    { value: 'committee_review', label: 'Committee Review' },
    { value: 'approved', label: 'Approved' },
    { value: 'development', label: 'Development' },
  ];

  constructor(
    private auth: AuthService,
    private requestService: RequestService,
    private router: Router,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    if (!this.auth.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }
    this.currentUser = this.auth.currentUser;
    this.loadRequests();
  }

  get filteredRequests(): IntakeRequest[] {
    if (!this.statusFilter) return this.requests;
    return this.requests.filter(r => r.status === this.statusFilter);
  }

  loadRequests(): void {
    this.requestService.getRequests().subscribe({
      next: (data) => this.requests = data,
      error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load requests' })
    });
  }

  openRequest(id: number): void {
    this.router.navigate(['/request', id]);
  }

  formatStatus(status: string): string {
    return status.replace(/_/g, ' ');
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
