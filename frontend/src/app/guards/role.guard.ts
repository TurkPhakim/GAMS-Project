import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Injectable({
    providedIn: 'root'
})
export class RoleGuard implements CanActivate {
    constructor(
        private authService: AuthService,
        private router: Router
    ) { }

    canActivate(
        route: ActivatedRouteSnapshot,
        state: RouterStateSnapshot
    ): boolean {
        const requiredRole = route.data['role'];
        const user = this.authService.getCurrentUser();

        if (!user || (requiredRole && user.role !== requiredRole)) {
            this.router.navigate(['/login']);
            return false;
        }

        return true;
    }
}
