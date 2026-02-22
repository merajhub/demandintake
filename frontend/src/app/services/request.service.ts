import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { IntakeRequest, ReviewPayload } from '../models/interfaces';

@Injectable({ providedIn: 'root' })
export class RequestService {
    private apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) { }

    // Request CRUD
    getRequests(status?: string): Observable<IntakeRequest[]> {
        const params = status ? `?status=${status}` : '';
        return this.http.get<IntakeRequest[]>(`${this.apiUrl}/requests${params}`);
    }

    getRequest(id: number): Observable<IntakeRequest> {
        return this.http.get<IntakeRequest>(`${this.apiUrl}/requests/${id}`);
    }

    createRequest(data: Partial<IntakeRequest>): Observable<IntakeRequest> {
        return this.http.post<IntakeRequest>(`${this.apiUrl}/requests`, data);
    }

    updateRequest(id: number, data: Partial<IntakeRequest>): Observable<IntakeRequest> {
        return this.http.put<IntakeRequest>(`${this.apiUrl}/requests/${id}`, data);
    }

    // Workflow actions
    submitRequest(id: number): Observable<any> {
        return this.http.put(`${this.apiUrl}/workflow/${id}/submit`, {});
    }

    scrubReview(id: number, payload: ReviewPayload): Observable<any> {
        return this.http.put(`${this.apiUrl}/workflow/${id}/scrub-review`, payload);
    }

    updateScrubReview(requestId: number, reviewId: number, remarks: string): Observable<any> {
        return this.http.put(`${this.apiUrl}/workflow/${requestId}/scrub-review/${reviewId}`, { remarks });
    }

    committeeReview(id: number, payload: ReviewPayload): Observable<any> {
        return this.http.put(`${this.apiUrl}/workflow/${id}/committee-review`, payload);
    }

    startDevelopment(id: number): Observable<any> {
        return this.http.put(`${this.apiUrl}/workflow/${id}/start-development`, {});
    }

    // Comments
    getComments(requestId: number): Observable<Comment[]> {
        return this.http.get<Comment[]>(`${this.apiUrl}/comments/${requestId}`);
    }

    addComment(requestId: number, message: string): Observable<Comment> {
        return this.http.post<Comment>(`${this.apiUrl}/comments/${requestId}`, { message });
    }

    // Attachments
    uploadFiles(requestId: number, files: File[]): Observable<any> {
        const formData = new FormData();
        files.forEach(f => formData.append('files', f));
        return this.http.post(`${this.apiUrl}/attachments/${requestId}`, formData);
    }

    getAttachments(requestId: number): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/attachments/${requestId}`);
    }
}
