import { Component, OnInit } from '@angular/core';
import { AuthService, User } from '../core/auth.service';
import { Router } from '@angular/router';
import { BreadcrumbService, BreadcrumbItem, BreadcrumbButton } from '../core/breadcrumb.service';

@Component({
    selector: 'app-header',
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {
    currentUser: User | null = null;
    breadcrumbs: BreadcrumbItem[] = [];
    buttons: BreadcrumbButton[] = [];

    constructor(
        private authService: AuthService,
        private router: Router,
        private breadcrumbService: BreadcrumbService
    ) { }

    ngOnInit(): void {
        this.authService.currentUser$.subscribe((user: any) => {
            this.currentUser = user;
        });

        this.breadcrumbService.breadcrumbs$.subscribe((items) => {
            this.breadcrumbs = items;
        });

        this.breadcrumbService.buttons$.subscribe((btns) => {
            this.buttons = btns;
        });
    }

    getUserDisplayName(): string {
        if (!this.currentUser) return '';
        const nickname = this.currentUser.nickname;

        switch (this.currentUser.role) {
            case 'student':
                return nickname || this.currentUser.username;
            case 'teacher':
                return nickname ? `อาจารย์${nickname}` : this.currentUser.username;
            case 'admin':
                return 'ผู้ดูแลระบบ';
            default:
                return this.currentUser.username;
        }
    }

    getHomeRoute(): string {
        if (!this.currentUser) return '/login';
        switch (this.currentUser.role) {
            case 'admin': return '/admin';
            case 'teacher': return '/teacher';
            case 'student': return '/student';
            default: return '/login';
        }
    }

    goHome(): void {
        this.router.navigate([this.getHomeRoute()]);
    }

    navigateTo(route?: string): void {
        if (route) {
            this.router.navigate([route]);
        }
    }

    executeButtonAction(action: () => void): void {
        action();
    }

    getButtonClasses(btn: BreadcrumbButton): string {
        const base =
            'select-none border text-sm lg:text-base font-semibold ' +
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/60 focus-visible:ring-offset-2 ' +
            'active:scale-[0.99]';

        if (btn.style === 'outline') {
            return (
                base +
                ' bg-white/70 backdrop-blur-md border-gray-200 text-gray-700 ' +
                'hover:bg-white hover:border-gray-300'
            );
        }

        switch (btn.color) {
            case 'red':
                return (
                    base +
                    ' text-white border-white/40 ' +
                    'bg-gradient-to-r from-red-600 via-red-500 to-rose-600 ' +
                    'hover:brightness-110'
                );

            case 'gray':
                return (
                    base +
                    ' bg-white/70 backdrop-blur-md border-gray-200 text-gray-700 ' +
                    'hover:bg-white hover:border-gray-300'
                );

            case 'green':
            default:
                return (
                    base +
                    ' text-white border-white/40 ' +
                    'bg-gradient-to-r from-orange-600 via-orange-500 to-orange-700 ' +
                    'hover:brightness-110'
                );
        }
    }


    isOutline(btn: BreadcrumbButton): boolean {
        return btn.style === 'outline' || btn.color === 'gray';
    }

    getButtonIcon(btn: BreadcrumbButton): 'back' | 'save' | 'danger' | 'arrow' {
        const label = (btn.label ?? '').trim().toLowerCase();

        if (label.includes('กลับ') || label.includes('back')) return 'back';
        if (label.includes('บันทึก') || label.includes('save')) return 'save';

        if (btn.color === 'red') return 'danger';

        return 'arrow';
    }

    logout(): void {
        this.authService.logout();
        this.router.navigate(['/login']);
    }
}
