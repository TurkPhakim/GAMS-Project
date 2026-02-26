import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { BreadcrumbService } from '../core/breadcrumb.service';

@Component({
    selector: 'app-admin-home',
    templateUrl: './admin-home.component.html',
    styleUrls: []
})
export class AdminHomeComponent implements OnInit, OnDestroy {
    constructor(
        private router: Router,
        private breadcrumbService: BreadcrumbService
    ) { }

    ngOnInit(): void {
        this.breadcrumbService.setBreadcrumbs([
            { label: 'หน้าหลัก' }
        ]);
    }

    ngOnDestroy(): void {
        this.breadcrumbService.clear();
    }

    navigate(path: string): void {
        this.router.navigate([path]);
    }
}
