import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { ButtonModule } from 'primeng/button';
import { AccordionModule } from 'primeng/accordion';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { HeaderComponent } from '../../components/header/header.component';
import { WorkflowStepperComponent } from '../../components/workflow-stepper/workflow-stepper.component';
import { AuthService } from '../../services/auth.service';
import { RequestService } from '../../services/request.service';
import {
  IntakeRequest, User, RequestorInfo, ProjectSpec,
  RequestStatus, ScrubReview, CommitteeReview, ConversationGroup
} from '../../models/interfaces';

@Component({
  selector: 'app-request-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule, InputTextModule, InputTextareaModule,
    DropdownModule, CalendarModule, ButtonModule, AccordionModule,
    ProgressSpinnerModule, TooltipModule, HeaderComponent, WorkflowStepperComponent
  ],
  templateUrl: './request-detail.component.html',
  styleUrls: ['./request-detail.component.css']
})
export class RequestDetailComponent implements OnInit {
  currentUser: User | null = null;
  isNew = false;
  loading = true;
  activeTab = 0;
  tabs = ['Intake Form', 'Scrub Team', 'Committee Team', 'Approved', 'Development'];

  request: Partial<IntakeRequest> = {
    project_title: '',
    status: 'draft' as RequestStatus,
    priority_level: 'medium'
  };
  requestorInfo: RequestorInfo = {};
  projectSpecs: ProjectSpec = {};

  // Scrub review fields
  scrubDecision: 'approve' | 'reject' | 'need_info' = 'approve';
  scrubRemarks = '';

  // Committee review fields
  committeeDecision: 'approve' | 'reject' | 'need_info' = 'approve';
  committeeRemarks = '';

  // File upload
  selectedFiles: File[] = [];

  // Submitter response field
  submitterRemarks = '';

  // Per-reviewer reply texts
  replyTexts: { [reviewerId: number]: string } = {};

  // Cached grouped conversations (recomputed on data load)
  groupedScrubConversations: ConversationGroup[] = [];
  groupedCommitteeConversations: ConversationGroup[] = [];

  // Per-reviewer reply texts for committee
  committeeReplyTexts: { [reviewerId: number]: string } = {};

  // Inline edit state
  editingReviewId: number | null = null;
  editReviewText = '';

  // Dropdown options
  domainOptions = [
    { label: 'Infrastructure', value: 'Infrastructure' },
    { label: 'Digital', value: 'Digital' },
    { label: 'Analytics', value: 'Analytics' },
    { label: 'Security', value: 'Security' },
    { label: 'Cloud', value: 'Cloud' },
    { label: 'AI/ML', value: 'AI/ML' },
    { label: 'Other', value: 'Other' }
  ];
  requestTypeOptions = [
    { label: 'New Project', value: 'New Project' },
    { label: 'Enhancement', value: 'Enhancement' },
    { label: 'Bug Fix', value: 'Bug Fix' },
    { label: 'Maintenance', value: 'Maintenance' },
    { label: 'Research', value: 'Research' }
  ];
  priorityOptions = [
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
    { label: 'Critical', value: 'critical' }
  ];
  scrubDecisionOptions = [
    { label: 'Approve - Forward to Committee', value: 'approve' },
    { label: 'Reject', value: 'reject' },
    { label: 'Need More Information', value: 'need_info' }
  ];
  committeeDecisionOptions = [
    { label: 'Approve - Forward to Development', value: 'approve' },
    { label: 'Reject', value: 'reject' },
    { label: 'Need More Information', value: 'need_info' }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    private requestService: RequestService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    if (!this.auth.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }
    this.currentUser = this.auth.currentUser;

    const id = this.route.snapshot.paramMap.get('id');
    if (id === 'new' || !id) {
      this.isNew = true;
      this.loading = false;
    } else {
      this.loadRequest(parseInt(id));
    }
  }

  loadRequest(id: number): void {
    this.requestService.getRequest(id).subscribe({
      next: (data) => {
        this.request = data;
        this.requestorInfo = data.requestor_info || {};
        this.projectSpecs = data.project_specs || {};
        this.loading = false;

        // Recompute cached conversations
        this.groupedScrubConversations = this.buildGroupedConversations(
          this.request.scrub_reviews || [], 'scrub'
        );
        this.groupedCommitteeConversations = this.buildGroupedConversations(
          this.request.committee_reviews || [], 'committee'
        );

        // Sync decision dropdowns from current user's existing group
        const myScrubGroup = this.groupedScrubConversations.find(g => g.reviewerId === this.currentUser?.id);
        if (myScrubGroup && myScrubGroup.latestDecision) {
          this.scrubDecision = myScrubGroup.latestDecision as any;
        }
        const myCommitteeGroup = this.groupedCommitteeConversations.find(g => g.reviewerId === this.currentUser?.id);
        if (myCommitteeGroup && myCommitteeGroup.latestDecision) {
          this.committeeDecision = myCommitteeGroup.latestDecision as any;
        }

        // Auto-select appropriate tab based on status and role
        this.autoSelectTab();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load request' });
        this.router.navigate(['/dashboard']);
      }
    });
  }

  autoSelectTab(): void {
    const status = this.request.status;
    const role = this.currentUser?.role;

    if ((status === 'scrub_review' || status === 'scrub_questions') && role === 'scrub_team') {
      this.activeTab = 1;
    } else if (status === 'scrub_questions' && (this.request.requestor_id === this.currentUser?.id || role === 'admin')) {
      this.activeTab = 1;
    } else if ((status === 'committee_review' || status === 'committee_questions') && role === 'committee') {
      this.activeTab = 2;
    } else if (status === 'committee_questions' && (this.request.requestor_id === this.currentUser?.id || role === 'admin')) {
      this.activeTab = 2;
    } else if (status === 'approved' || status === 'rejected') {
      this.activeTab = 3;
    } else if (status === 'development') {
      this.activeTab = 4;
    }
  }

  get isEditable(): boolean {
    if (this.isNew) return true;
    const editableStatuses: RequestStatus[] = ['draft', 'scrub_questions', 'committee_questions'];
    return editableStatuses.includes(this.request.status as RequestStatus) &&
      (this.request.requestor_id === this.currentUser?.id || this.currentUser?.role === 'admin');
  }

  get canSubmit(): boolean {
    if (this.isNew) return false;
    const submittableStatuses: RequestStatus[] = ['draft', 'scrub_questions', 'committee_questions'];
    return submittableStatuses.includes(this.request.status as RequestStatus) &&
      (this.request.requestor_id === this.currentUser?.id || this.currentUser?.role === 'admin');
  }

  get canScrubReview(): boolean {
    const reviewStatuses: RequestStatus[] = ['submitted', 'scrub_review', 'scrub_questions'];
    if (!reviewStatuses.includes(this.request.status as RequestStatus)) return false;
    if (this.currentUser?.role !== 'scrub_team' && this.currentUser?.role !== 'admin') return false;
    // If this user has a pending unanswered need_info question, they can only edit, not submit new
    if (this.hasPendingQuestion) return false;
    return true;
  }

  /** True when the current scrub user's last review is need_info with no submitter reply after it */
  get hasPendingQuestion(): boolean {
    if (this.currentUser?.role !== 'scrub_team' && this.currentUser?.role !== 'admin') return false;
    const reviews = this.request.scrub_reviews || [];
    const myReviews = reviews
      .filter(r => r.reviewer_id === this.currentUser?.id)
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    if (myReviews.length === 0) return false;
    const lastReview = myReviews[myReviews.length - 1];
    if (lastReview.decision !== 'need_info') return false;
    // Check if submitter replied after this review
    const lastReviewTime = new Date(lastReview.created_at || 0).getTime();
    const comments = (this.request.comments || []).filter(
      c => c.user_id === this.request.requestor_id
    );
    return !comments.some(c => new Date(c.created_at || 0).getTime() > lastReviewTime);
  }

  get canReplyToScrub(): boolean {
    return this.request.status === 'scrub_questions' &&
      (this.request.requestor_id === this.currentUser?.id || this.currentUser?.role === 'admin');
  }

  get canCommitteeReview(): boolean {
    const reviewStatuses: RequestStatus[] = ['committee_review', 'committee_questions'];
    if (!reviewStatuses.includes(this.request.status as RequestStatus)) return false;
    if (this.currentUser?.role !== 'committee' && this.currentUser?.role !== 'admin') return false;
    if (this.hasPendingCommitteeQuestion) return false;
    return true;
  }

  get hasPendingCommitteeQuestion(): boolean {
    if (this.currentUser?.role !== 'committee' && this.currentUser?.role !== 'admin') return false;
    const reviews = this.request.committee_reviews || [];
    const myReviews = reviews
      .filter(r => r.reviewer_id === this.currentUser?.id)
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    if (myReviews.length === 0) return false;
    const lastReview = myReviews[myReviews.length - 1];
    if (lastReview.decision !== 'need_info') return false;
    const lastReviewTime = new Date(lastReview.created_at || 0).getTime();
    const comments = (this.request.comments || []).filter(c => c.user_id === this.request.requestor_id);
    return !comments.some(c => new Date(c.created_at || 0).getTime() > lastReviewTime);
  }

  get canReplyToCommittee(): boolean {
    return this.request.status === 'committee_questions' &&
      (this.request.requestor_id === this.currentUser?.id || this.currentUser?.role === 'admin');
  }

  get hasExistingScrubGroup(): boolean {
    return this.groupedScrubConversations.some(g => g.reviewerId === this.currentUser?.id);
  }

  get hasExistingCommitteeGroup(): boolean {
    return this.groupedCommitteeConversations.some(g => g.reviewerId === this.currentUser?.id);
  }

  get allCommitteeQuestionsAnswered(): boolean {
    if (this.request.status !== 'committee_questions') return false;
    return this.groupedCommitteeConversations.filter(c => c.needsReply).length === 0;
  }

  get isScrubOrAdmin(): boolean {
    return this.currentUser?.role === 'scrub_team' || this.currentUser?.role === 'admin';
  }

  get isCommitteeOrAdmin(): boolean {
    return this.currentUser?.role === 'committee' || this.currentUser?.role === 'admin';
  }

  saveRequest(): void {
    const payload = {
      ...this.request,
      requestor_info: this.requestorInfo,
      project_specs: this.projectSpecs
    };

    if (this.isNew) {
      this.requestService.createRequest(payload).subscribe({
        next: (created) => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Request created successfully!' });
          this.router.navigate(['/request', created.id]);
        },
        error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.error || 'Failed to create' })
      });
    } else {
      this.requestService.updateRequest(this.request.id!, payload).subscribe({
        next: (updated) => {
          this.request = updated;
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Request saved successfully!' });
        },
        error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.error || 'Failed to save' })
      });
    }
  }

  submitRequest(): void {
    const submit = () => {
      this.requestService.submitRequest(this.request.id!).subscribe({
        next: (res) => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Request submitted!' });
          this.loadRequest(this.request.id!);
          this.submitterRemarks = '';
        },
        error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.error || 'Failed to submit' })
      });
    };

    if (this.submitterRemarks && this.submitterRemarks.trim()) {
      this.requestService.addComment(this.request.id!, this.submitterRemarks).subscribe({
        next: () => submit(),
        error: () => {
          this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Failed to save comment, submitting request anyway...' });
          submit();
        }
      });
    } else {
      submit();
    }
  }

  submitScrubReview(): void {
    if (!this.scrubDecision) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please select a decision' });
      return;
    }

    const doReview = () => {
      this.requestService.scrubReview(this.request.id!, {
        decision: this.scrubDecision,
        remarks: this.scrubRemarks
      }).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Scrub review submitted!' });
          this.loadRequest(this.request.id!);
        },
        error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.error || 'Failed' })
      });
    };

    if (this.selectedFiles.length > 0) {
      this.requestService.uploadFiles(this.request.id!, this.selectedFiles).subscribe({
        next: () => { this.selectedFiles = []; doReview(); },
        error: () => { this.messageService.add({ severity: 'error', summary: 'Error', detail: 'File upload failed' }); doReview(); }
      });
    } else {
      doReview();
    }
  }

  submitCommitteeReview(): void {
    if (!this.committeeDecision) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please select a decision' });
      return;
    }
    this.requestService.committeeReview(this.request.id!, {
      decision: this.committeeDecision,
      remarks: this.committeeRemarks
    }).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Committee review submitted!' });
        this.loadRequest(this.request.id!);
      },
      error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.error || 'Failed' })
    });
  }

  /** Send a reply to a single scrub reviewer's question without resubmitting */
  sendSingleReply(convo: any): void {
    const text = (this.replyTexts[convo.reviewerId] || '').trim();
    if (!text) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please enter a reply' });
      return;
    }
    const message = `[Reply to ${convo.reviewerName}] ${text}`;
    this.requestService.addComment(this.request.id!, message).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: `Reply sent to ${convo.reviewerName}` });
        this.replyTexts[convo.reviewerId] = '';
        this.loadRequest(this.request.id!);
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to send reply' })
    });
  }

  /** True when all need_info questions have been answered (no more needsReply groups) */
  get allQuestionsAnswered(): boolean {
    if (this.request.status !== 'scrub_questions') return false;
    const pendingGroups = this.groupedScrubConversations.filter(c => c.needsReply);
    return pendingGroups.length === 0;
  }

  replyToScrubFeedback(): void {
    this.requestService.submitRequest(this.request.id!).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Request resubmitted for review!' });
        this.replyTexts = {};
        this.submitterRemarks = '';
        this.loadRequest(this.request.id!);
      },
      error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.error || 'Failed to resubmit' })
    });
  }

  replyToCommitteeFeedback(): void {
    this.requestService.submitRequest(this.request.id!).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Request resubmitted for committee review!' });
        this.committeeReplyTexts = {};
        this.loadRequest(this.request.id!);
      },
      error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.error || 'Failed to resubmit' })
    });
  }

  sendCommitteeSingleReply(convo: any): void {
    const text = (this.committeeReplyTexts[convo.reviewerId] || '').trim();
    if (!text) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please enter a reply' });
      return;
    }
    const message = `[Reply to ${convo.reviewerName}] ${text}`;
    this.requestService.addComment(this.request.id!, message).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: `Reply sent to ${convo.reviewerName}` });
        this.committeeReplyTexts[convo.reviewerId] = '';
        this.loadRequest(this.request.id!);
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to send reply' })
    });
  }

  startDevelopment(): void {
    this.requestService.startDevelopment(this.request.id!).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Development started!' });
        this.loadRequest(this.request.id!);
      },
      error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.error || 'Failed' })
    });
  }

  getLatestSubmitterRemarks(): string {
    if (!this.request.comments || this.request.comments.length === 0) return '';
    const submitterComments = this.request.comments.filter(
      c => c.user_id === this.request.requestor_id
    );
    return submitterComments.length > 0
      ? submitterComments[submitterComments.length - 1].message
      : '';
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.selectedFiles.push(...Array.from(input.files));
    }
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files) {
      this.selectedFiles.push(...Array.from(event.dataTransfer.files));
    }
  }

  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
  }

  cancel(): void {
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  get latestScrubRemark(): string {
    if (!this.request.scrub_reviews || this.request.scrub_reviews.length === 0) return '';
    return this.request.scrub_reviews[this.request.scrub_reviews.length - 1].remarks || '';
  }

  get submitterComments(): any[] {
    if (!this.request.comments || this.request.comments.length === 0) return [];
    return this.request.comments.filter(
      c => c.user_id === this.request.requestor_id
    );
  }

  /**
   * Generic method: groups reviews and submitter replies into per-reviewer conversations.
   * Used for both scrub and committee tabs.
   */
  buildGroupedConversations(
    reviews: (ScrubReview | CommitteeReview)[],
    phase: 'scrub' | 'committee'
  ): ConversationGroup[] {
    const comments = (this.request.comments || []).filter(
      c => c.user_id === this.request.requestor_id
    );
    if (reviews.length === 0 && comments.length === 0) return [];

    interface TimelineEntry {
      type: 'review' | 'reply';
      author: string;
      message: string;
      decision?: string;
      created_at?: string;
      reviewerId: number;
      reviewerName: string;
      timestamp: number;
      reviewRecordId?: number;
    }

    const timeline: TimelineEntry[] = [];
    const defaultLabel = phase === 'scrub' ? 'Scrub Reviewer' : 'Committee Reviewer';

    for (const r of reviews) {
      timeline.push({
        type: 'review',
        author: r.reviewer?.full_name || defaultLabel,
        message: r.remarks || '',
        decision: r.decision,
        created_at: r.created_at,
        reviewerId: r.reviewer_id,
        reviewerName: r.reviewer?.full_name || defaultLabel,
        timestamp: r.created_at ? new Date(r.created_at).getTime() : 0,
        reviewRecordId: r.id
      });
    }

    // Only include submitter comments that are tagged for reviewers in this phase,
    // or fall back to nearest reviewer.
    const reviewerNameToId = new Map<string, number>();
    for (const r of reviews) {
      const name = r.reviewer?.full_name || defaultLabel;
      reviewerNameToId.set(name.toLowerCase(), r.reviewer_id);
    }

    // Determine earliest review timestamp for this phase to filter relevant comments
    const earliestReviewTime = reviews.length > 0
      ? Math.min(...reviews.map(r => r.created_at ? new Date(r.created_at).getTime() : Infinity))
      : Infinity;

    for (const c of comments) {
      const commentTime = c.created_at ? new Date(c.created_at).getTime() : 0;
      // Only include comments after the first review in this phase
      if (commentTime < earliestReviewTime) continue;
      // Check if tagged for a reviewer in this phase
      const tagMatch = c.message.match(/^\[Reply to (.+?)\]\s*/);
      if (tagMatch) {
        const taggedName = tagMatch[1].toLowerCase();
        if (!reviewerNameToId.has(taggedName)) continue; // Tagged for different phase
      }
      timeline.push({
        type: 'reply',
        author: c.user?.full_name || 'Submitter',
        message: c.message,
        created_at: c.created_at,
        reviewerId: 0,
        reviewerName: '',
        timestamp: commentTime
      });
    }

    timeline.sort((a, b) => a.timestamp - b.timestamp);

    let currentReviewerId = reviews.length > 0 ? reviews[0].reviewer_id : 0;
    let currentReviewerName = reviews.length > 0 ? (reviews[0].reviewer?.full_name || defaultLabel) : 'Unknown';

    for (const entry of timeline) {
      if (entry.type === 'review') {
        currentReviewerId = entry.reviewerId;
        currentReviewerName = entry.reviewerName;
      } else {
        const tagMatch = entry.message.match(/^\[Reply to (.+?)\]\s*/);
        if (tagMatch) {
          const taggedName = tagMatch[1].toLowerCase();
          const taggedId = reviewerNameToId.get(taggedName);
          if (taggedId !== undefined) {
            entry.reviewerId = taggedId;
            entry.reviewerName = tagMatch[1];
            entry.message = entry.message.replace(/^\[Reply to .+?\]\s*/, '');
            continue;
          }
        }
        entry.reviewerId = currentReviewerId;
        entry.reviewerName = currentReviewerName;
      }
    }

    const groupMap = new Map<number, { reviewerName: string; reviewerId: number; entries: any[]; firstTimestamp: number }>();

    for (const entry of timeline) {
      if (!groupMap.has(entry.reviewerId)) {
        groupMap.set(entry.reviewerId, {
          reviewerName: entry.reviewerName,
          reviewerId: entry.reviewerId,
          entries: [],
          firstTimestamp: entry.timestamp
        });
      }
      groupMap.get(entry.reviewerId)!.entries.push({
        type: entry.type,
        author: entry.author,
        message: entry.message,
        decision: entry.decision,
        created_at: entry.created_at,
        reviewId: entry.reviewRecordId
      });
    }

    const currentUserId = this.currentUser?.id;
    const currentUserRole = this.currentUser?.role;
    const canEdit = phase === 'scrub'
      ? (currentUserRole === 'scrub_team' || currentUserRole === 'admin')
      : (currentUserRole === 'committee' || currentUserRole === 'admin');

    return Array.from(groupMap.values())
      .sort((a, b) => a.firstTimestamp - b.firstTimestamp)
      .map(g => {
        const reviewEntries = g.entries.filter((e: any) => e.type === 'review');
        const latestDecision = reviewEntries.length > 0 ? reviewEntries[reviewEntries.length - 1].decision : null;
        const latestReviewDate = reviewEntries.length > 0 ? reviewEntries[reviewEntries.length - 1].created_at : null;

        const lastNeedInfoIdx = g.entries
          .map((e: any, i: number) => e.type === 'review' && e.decision === 'need_info' ? i : -1)
          .filter((i: number) => i >= 0).pop();

        const needsReply = lastNeedInfoIdx !== undefined && lastNeedInfoIdx >= 0 &&
          !g.entries.slice(lastNeedInfoIdx + 1).some((e: any) => e.type === 'reply');

        const hasSubmitterReply = lastNeedInfoIdx !== undefined && lastNeedInfoIdx >= 0 &&
          g.entries.slice(lastNeedInfoIdx + 1).some((e: any) => e.type === 'reply');

        // canDecide: submitter replied to the latest need_info and no new decision made yet
        const canDecide = hasSubmitterReply && latestDecision === 'need_info';

        // Mark editable entries
        if (canEdit && g.reviewerId === currentUserId) {
          for (let i = g.entries.length - 1; i >= 0; i--) {
            const e = g.entries[i];
            if (e.type === 'review' && e.decision === 'need_info') {
              const hasReplyAfter = g.entries.slice(i + 1).some((x: any) => x.type === 'reply');
              e.canEdit = !hasReplyAfter;
            }
          }
        }

        return {
          reviewerName: g.reviewerName,
          reviewerId: g.reviewerId,
          entries: g.entries,
          firstTimestamp: g.firstTimestamp,
          needsReply,
          latestDecision,
          hasSubmitterReply,
          canDecide,
          latestReviewDate
        };
      });
  }

  startEditReview(entry: any): void {
    this.editingReviewId = entry.reviewId;
    this.editReviewText = entry.message;
  }

  cancelEditReview(): void {
    this.editingReviewId = null;
    this.editReviewText = '';
  }

  saveEditReview(entry: any): void {
    if (!this.editReviewText.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Question cannot be empty' });
      return;
    }
    this.requestService.updateScrubReview(this.request.id!, entry.reviewId, this.editReviewText.trim()).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Question updated successfully' });
        this.editingReviewId = null;
        this.editReviewText = '';
        this.loadRequest(this.request.id!);
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.error || 'Failed to update question' });
      }
    });
  }
}
