import { Component, OnInit, OnDestroy } from '@angular/core';
import { TeacherService } from '../core/teacher.service';
import { BreadcrumbService } from '../core/breadcrumb.service';

@Component({
    selector: 'app-teacher-students',
    templateUrl: './teacher-students.component.html',
    styleUrls: []
})
export class TeacherStudentsComponent implements OnInit, OnDestroy {
    studentsByYear: { [key: number]: any[] } = {};
    studentPagination: { [key: number]: { total: number; page: number; limit: number; totalPages: number } } = {};
    studentCurrentPages: { [key: number]: number } = { 1: 1, 2: 1, 3: 1, 4: 1 };
    itemsPerPage = 10;

    searchQuery: string = '';
    isSearching: boolean = false;

    constructor(
        private teacherService: TeacherService,
        private breadcrumbService: BreadcrumbService
    ) { }

    ngOnInit(): void {
        this.breadcrumbService.setBreadcrumbs([
            { label: 'หน้าหลัก', route: '/teacher' },
            { label: 'รายชื่อนักศึกษา' }
        ]);
        this.loadAllYears();
    }

    ngOnDestroy(): void {
        this.breadcrumbService.clear();
    }

    loadAllYears(): void {
        [1, 2, 3, 4].forEach(year => {
            this.loadStudentsForYear(year, this.studentCurrentPages[year] || 1);
        });
    }

    loadStudentsForYear(year: number, page: number): void {
        this.teacherService.getStudents(page, this.itemsPerPage).subscribe({
            next: (res) => {
                if (res.data) {
                    // paginated response — merge only the requested year
                    if (res.data[year]) {
                        this.studentsByYear[year] = res.data[year];
                    } else {
                        this.studentsByYear[year] = [];
                    }
                    if (res.pagination && res.pagination[year]) {
                        this.studentPagination[year] = res.pagination[year];
                    }
                }
            },
            error: (err) => console.error('Error loading students:', err)
        });
    }

    onStudentPageChange(year: number, page: number): void {
        if (page < 1) return;
        if (this.studentPagination[year] && page > this.studentPagination[year].totalPages) return;
        this.studentCurrentPages[year] = page;
        this.loadStudentsForPage(page);
    }

    // Load a new page — fetch all years at the same page offset
    loadStudentsForPage(page: number): void {
        this.teacherService.getStudents(page, this.itemsPerPage).subscribe({
            next: (res) => {
                if (res.data) {
                    this.studentsByYear = res.data;
                    this.studentPagination = res.pagination || {};
                }
            },
            error: (err) => console.error('Error loading students:', err)
        });
    }

    onSearchChange(query: string): void {
        if (!query || query.trim() === '') {
            this.isSearching = false;
            this.loadAllYears();
            return;
        }
        this.isSearching = true;
        this.teacherService.searchStudents(query.trim()).subscribe({
            next: (data) => {
                // search returns simple grouped object (no pagination)
                this.studentsByYear = data;
                this.studentPagination = {};
            },
            error: (err) => console.error('Error searching students:', err)
        });
    }

    getStudentYearLevels(): number[] {
        if (this.isSearching) {
            return Object.keys(this.studentsByYear)
                .map(k => parseInt(k))
                .filter(y => this.studentsByYear[y]?.length > 0)
                .sort();
        }
        return [1, 2, 3, 4].filter(y =>
            (this.studentPagination[y]?.total ?? 0) > 0 || (this.studentsByYear[y]?.length ?? 0) > 0
        );
    }

    getYearLabel(year: number): string {
        return `ชั้นปีที่ ${year}`;
    }

    getTotalStudents(): number {
        if (this.isSearching) {
            return Object.values(this.studentsByYear).reduce((s, arr) => s + (arr?.length || 0), 0);
        }
        return Object.values(this.studentPagination).reduce((s, p) => s + (p?.total || 0), 0);
    }

    getPageNumbers(pagination: any, currentPage: number): number[] {
        if (!pagination || pagination.totalPages <= 1) return [];
        const total = pagination.totalPages;
        const pages: number[] = [];
        const delta = 2;
        const left = Math.max(1, currentPage - delta);
        const right = Math.min(total, currentPage + delta);
        for (let i = left; i <= right; i++) pages.push(i);
        return pages;
    }
}
