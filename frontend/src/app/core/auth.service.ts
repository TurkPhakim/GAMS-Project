import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface LoginResponse {
    token: string;
    role: string;
    userId: number;
    nickname: string | null;
}

export interface User {
    userId: number;
    username: string;
    role: 'admin' | 'teacher' | 'student';
    nickname?: string | null;
    token?: string;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private apiUrl = '/api';
    private currentUserSubject = new BehaviorSubject<User | null>(this.getUserFromStorage());
    public currentUser$ = this.currentUserSubject.asObservable();

    constructor(private http: HttpClient) { }

    login(username: string, password: string): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, {
            username,
            password
        }).pipe(
            tap((response: LoginResponse) => {
                const user: User = {
                    userId: response.userId,
                    username: username,
                    role: response.role as any,
                    nickname: response.nickname,
                    token: response.token
                };
                localStorage.setItem('currentUser', JSON.stringify(user));
                this.currentUserSubject.next(user);
            })
        );
    }

    logout(): void {
        localStorage.removeItem('currentUser');
        this.currentUserSubject.next(null);
    }

    getCurrentUser(): User | null {
        return this.currentUserSubject.value;
    }

    getToken(): string | null {
        const user = this.getCurrentUser();
        return user ? user.token || '' : null;
    }

    isLoggedIn(): boolean {
        return this.getCurrentUser() !== null;
    }

    hasRole(role: string): boolean {
        return this.getCurrentUser()?.role === role;
    }

    private getUserFromStorage(): User | null {
        const stored = localStorage.getItem('currentUser');
        return stored ? JSON.parse(stored) : null;
    }
}
