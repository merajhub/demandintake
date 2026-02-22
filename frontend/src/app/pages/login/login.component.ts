import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { TabViewModule } from 'primeng/tabview';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [
        CommonModule, FormsModule, TabViewModule, InputTextModule,
        PasswordModule, ButtonModule, DropdownModule
    ],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.css']
})
export class LoginComponent {
    tabIndex = 0;
    loginEmail = '';
    loginPassword = '';
    regName = '';
    regEmail = '';
    regPassword = '';
    regRole = 'requestor';
    hidePassword = true;
    loading = false;

    roles = [
        { label: 'Requestor', value: 'requestor' },
        { label: 'Scrub Team', value: 'scrub_team' },
        { label: 'Committee', value: 'committee' }
    ];

    constructor(
        private auth: AuthService,
        private router: Router,
        private messageService: MessageService
    ) {
        if (this.auth.isLoggedIn) {
            this.router.navigate(['/dashboard']);
        }
    }

    login(): void {
        if (!this.loginEmail || !this.loginPassword) {
            this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please fill in all fields' });
            return;
        }
        this.loading = true;
        this.auth.login(this.loginEmail, this.loginPassword).subscribe({
            next: () => { this.router.navigate(['/dashboard']); },
            error: (err) => {
                this.loading = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.error || 'Login failed' });
            }
        });
    }

    register(): void {
        if (!this.regName || !this.regEmail || !this.regPassword) {
            this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please fill in all fields' });
            return;
        }
        this.loading = true;
        this.auth.register({
            email: this.regEmail,
            password: this.regPassword,
            full_name: this.regName,
            role: this.regRole
        }).subscribe({
            next: () => { this.router.navigate(['/dashboard']); },
            error: (err) => {
                this.loading = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.error || 'Registration failed' });
            }
        });
    }
}
