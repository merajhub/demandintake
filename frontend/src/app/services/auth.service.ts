import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthResponse, User } from '../models/interfaces';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private apiUrl = environment.apiUrl;
    private currentUserSubject = new BehaviorSubject<User | null>(null);
    currentUser$ = this.currentUserSubject.asObservable();

    constructor(private http: HttpClient) {
        this.loadStoredUser();
    }

    private loadStoredUser(): void {
        const stored = localStorage.getItem('user');
        if (stored) {
            this.currentUserSubject.next(JSON.parse(stored));
        }
    }

    get currentUser(): User | null {
        return this.currentUserSubject.value;
    }

    get token(): string | null {
        return localStorage.getItem('token');
    }

    get isLoggedIn(): boolean {
        return !!this.token;
    }

    login(email: string, password: string): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, { email, password })
            .pipe(tap(res => this.storeAuth(res)));
    }

    register(data: { email: string; password: string; full_name: string; role?: string }): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${this.apiUrl}/auth/register`, data)
            .pipe(tap(res => this.storeAuth(res)));
    }

    logout(): void {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.currentUserSubject.next(null);
    }

    private storeAuth(res: AuthResponse): void {
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
        this.currentUserSubject.next(res.user);
    }
}
