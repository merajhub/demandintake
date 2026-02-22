export interface User {
    id: number;
    email: string;
    full_name: string;
    role: 'requestor' | 'scrub_team' | 'committee' | 'admin';
    department?: string;
    phone?: string;
}

export interface AuthResponse {
    token: string;
    user: User;
}

export interface IntakeRequest {
    id: number;
    project_title: string;
    domain?: string;
    estimated_budget?: number;
    type_of_request?: string;
    priority_level?: 'low' | 'medium' | 'high' | 'critical';
    date_of_submission?: string;
    estimated_completion_date?: string;
    status: RequestStatus;
    requestor_id: number;
    requestor?: User;
    requestor_info?: RequestorInfo;
    project_specs?: ProjectSpec;
    scrub_reviews?: ScrubReview[];
    committee_reviews?: CommitteeReview[];
    comments?: Comment[];
    attachments?: Attachment[];
    created_at?: string;
    updated_at?: string;
}

export type RequestStatus =
    'draft' | 'submitted' | 'scrub_review' | 'scrub_questions' |
    'committee_review' | 'committee_questions' | 'approved' | 'rejected' | 'development';

export interface RequestorInfo {
    id?: number;
    request_id?: number;
    department?: string;
    phone?: string;
    manager_name?: string;
    business_unit?: string;
    cost_center?: string;
}

export interface ProjectSpec {
    id?: number;
    request_id?: number;
    description?: string;
    business_justification?: string;
    expected_outcomes?: string;
    technical_requirements?: string;
    dependencies?: string;
    risks?: string;
}

export interface ScrubReview {
    id: number;
    request_id: number;
    reviewer_id: number;
    decision: 'approve' | 'reject' | 'need_info';
    remarks?: string;
    reviewer?: User;
    created_at?: string;
}

export interface CommitteeReview {
    id: number;
    request_id: number;
    reviewer_id: number;
    decision: 'approve' | 'reject' | 'need_info';
    remarks?: string;
    reviewer?: User;
    created_at?: string;
}

export interface Comment {
    id: number;
    request_id: number;
    user_id: number;
    message: string;
    user?: User;
    created_at?: string;
}

export interface Attachment {
    id: number;
    request_id: number;
    uploaded_by: number;
    original_name: string;
    filename: string;
    filepath: string;
    mimetype?: string;
    size?: number;
    created_at?: string;
}

export interface ReviewPayload {
    decision: 'approve' | 'reject' | 'need_info';
    remarks?: string;
}

export interface ConversationEntry {
    type: 'review' | 'reply';
    author: string;
    message: string;
    decision?: string;
    created_at?: string;
    reviewId?: number;
    canEdit?: boolean;
}

export interface ConversationGroup {
    reviewerName: string;
    reviewerId: number;
    entries: ConversationEntry[];
    firstTimestamp?: number;
    needsReply?: boolean;
    latestDecision?: string | null;
    hasSubmitterReply?: boolean;
    canDecide?: boolean;
    latestReviewDate?: string | null;
}
