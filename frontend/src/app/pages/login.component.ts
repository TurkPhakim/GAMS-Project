import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { ModalService } from '../core/modal.service';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: []
})
export class LoginComponent implements OnDestroy {
    form = new FormGroup({
        username: new FormControl('', Validators.required),
        password: new FormControl('', Validators.required)
    });
    loading = false;
    showPassword = false;

    humanVerified = false;

    failedAttempts = 0;
    lockoutRemaining = 0;
    showLockoutModal = false;

    private lockoutInterval: any = null;

    constructor(
        private authService: AuthService,
        private router: Router,
        private modalService: ModalService
    ) { }

    ngOnDestroy(): void {
        if (this.lockoutInterval) clearInterval(this.lockoutInterval);
    }

    get isLockedOut(): boolean {
        return this.lockoutRemaining > 0;
    }

    get formattedCountdown(): string {
        const mins = Math.floor(this.lockoutRemaining / 60);
        const secs = this.lockoutRemaining % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    get showCaptcha(): boolean {
        const { username, password } = this.form.value;
        return !!(username && password);
    }

    private getLockoutDuration(): number {
        if (this.failedAttempts <= 3) return 30;
        if (this.failedAttempts === 4) return 60;
        return 180;
    }

    private startLockout(): void {
        const duration = this.getLockoutDuration();
        this.lockoutRemaining = duration;
        this.showLockoutModal = true;

        if (this.lockoutInterval) clearInterval(this.lockoutInterval);
        this.lockoutInterval = setInterval(() => {
            this.lockoutRemaining--;
            if (this.lockoutRemaining <= 0) {
                clearInterval(this.lockoutInterval);
                this.lockoutInterval = null;
                this.showLockoutModal = false;
            }
        }, 1000);
    }

    login(): void {
        if (this.form.invalid || this.isLockedOut || !this.humanVerified) return;

        this.loading = true;

        const { username, password } = this.form.value;
        this.authService.login(username as string, password as string).subscribe({
            next: () => {
                this.failedAttempts = 0;
                const user = this.authService.getCurrentUser();
                const displayName = user?.nickname || user?.username || '';
                const roleLabel = user?.role === 'teacher' ? 'อาจารย์' : user?.role === 'admin' ? 'ผู้ดูแลระบบ' : '';
                this.modalService.showSuccess('เข้าสู่ระบบสำเร็จ', `ยินดีต้อนรับ ${roleLabel}${displayName}`);

                setTimeout(() => {
                    if (user?.role === 'admin') {
                        this.router.navigate(['/admin']);
                    } else if (user?.role === 'teacher') {
                        this.router.navigate(['/teacher']);
                    } else if (user?.role === 'student') {
                        this.router.navigate(['/student']);
                    }
                }, 1500);
            },
            error: (error: any) => {
                this.loading = false;
                this.humanVerified = false;

                if (error.status === 403) {
                    this.modalService.showError('ไม่สามารถเข้าสู่ระบบได้', error.error?.message || 'บัญชีผู้ใช้นี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
                    return;
                }

                this.failedAttempts++;
                if (this.failedAttempts >= 3) {
                    this.startLockout();
                } else {
                    this.modalService.showError('เข้าสู่ระบบไม่สำเร็จ', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
                }
            }
        });
    }
}
