import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { ModalService } from '../core/modal.service';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: []
})
export class LoginComponent {
    form = new FormGroup({
        username: new FormControl('', Validators.required),
        password: new FormControl('', Validators.required)
    });
    loading = false;
    showPassword = false;

    constructor(
        private authService: AuthService,
        private router: Router,
        private modalService: ModalService
    ) { }

    login(): void {
        if (this.form.invalid) return;

        this.loading = true;

        const { username, password } = this.form.value;
    this.authService.login(username as string, password as string).subscribe(
      () => {
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
      (error: any) => {
        this.modalService.showError('เข้าสู่ระบบไม่สำเร็จ', error.error?.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        this.loading = false;
      }
    );
  }
}
