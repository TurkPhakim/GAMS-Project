import { Component, OnInit, OnDestroy } from '@angular/core';
import { AdminService, Student, Teacher, PaginationInfo, ActivityAdmin, PaginatedActivitiesResponse } from '../core/admin.service';
import { ModalService } from '../core/modal.service';
import { BreadcrumbService } from '../core/breadcrumb.service';
import { take } from 'rxjs/operators';

@Component({
    selector: 'app-admin-manage',
    templateUrl: './admin-manage.component.html',
    styleUrls: []
})
export class AdminManageComponent implements OnInit, OnDestroy {
    activeSection: 'students' | 'teachers' | 'activities' = 'students';

    // Student data per year level
    yearLevels = [1, 2, 3, 4];
    studentsByYear: { [key: number]: Student[] } = {};
    studentPagination: { [key: number]: PaginationInfo } = {};
    studentCurrentPages: { [key: number]: number } = { 1: 1, 2: 1, 3: 1, 4: 1 };
    graduatedStudents: Student[] = [];
    graduatedPagination: PaginationInfo = { total: 0, page: 1, limit: 10, totalPages: 0 };
    graduatedCurrentPage = 1;
    searchStudentQuery = '';
    isSearching = false;
    itemsPerPage = 5;

    // Teacher data
    teachers: Teacher[] = [];
    searchTeacherQuery = '';

    // Activities data
    activities: ActivityAdmin[] = [];
    activityPagination: PaginationInfo = { total: 0, page: 1, limit: 10, totalPages: 0 };
    activityCurrentPage = 1;
    activityItemsPerPage = 10;
    expandedActivities: { [key: number]: boolean } = {};
    searchActivityQuery = '';
    filterTeacherId: number | null = null;

    // Dialog state
    showDialog = false;
    dialogMode: 'create' | 'edit' = 'create';
    dialogType: 'student' | 'teacher' = 'student';
    editingStudent: Student | null = null;
    editingTeacher: Teacher | null = null;

    constructor(
        private adminService: AdminService,
        private modalService: ModalService,
        private breadcrumbService: BreadcrumbService
    ) { }

    ngOnInit(): void {
        this.loadAllStudentYears();
        this.loadGraduatedStudents();
        this.loadTeachers();
        this.loadActivities();
        this.updateBreadcrumb();
    }

    ngOnDestroy(): void {
        this.breadcrumbService.setBreadcrumbs([]);
        this.breadcrumbService.setButtons([]);
    }

    // ===== BREADCRUMB =====
    updateBreadcrumb(): void {
        const sectionLabels: Record<string, string> = {
            students: 'จัดการนักศึกษา',
            teachers: 'จัดการอาจารย์',
            activities: 'ภาพรวมกิจกรรม'
        };
        this.breadcrumbService.setBreadcrumbs([
            { label: 'ผู้ดูแลระบบ', route: '/admin' },
            { label: sectionLabels[this.activeSection] }
        ]);
        this.breadcrumbService.setButtons([]);
    }

    switchSection(section: 'students' | 'teachers' | 'activities'): void {
        this.activeSection = section;
        this.updateBreadcrumb();
    }

    // ===== STUDENT LOADING =====
    loadAllStudentYears(): void {
        for (const year of this.yearLevels) {
            this.loadStudentYear(year);
        }
    }

    loadStudentYear(yearLevel: number, page: number = 1): void {
        this.studentCurrentPages[yearLevel] = page;
        this.adminService.getStudents(page, this.itemsPerPage, yearLevel).subscribe(
            (response: any) => {
                this.studentsByYear[yearLevel] = response.data[yearLevel] || [];
                if (response.pagination[yearLevel]) {
                    this.studentPagination[yearLevel] = response.pagination[yearLevel];
                } else {
                    this.studentPagination[yearLevel] = { total: 0, page: 1, limit: this.itemsPerPage, totalPages: 0 };
                }
            },
            (error: any) => {
                console.error(`Error loading year ${yearLevel} students:`, error);
            }
        );
    }

    loadGraduatedStudents(page: number = 1): void {
        this.graduatedCurrentPage = page;
        this.adminService.getGraduatedStudents(page, this.itemsPerPage).subscribe(
            (response: any) => {
                this.graduatedStudents = response.data || [];
                this.graduatedPagination = response.pagination || { total: 0, page: 1, limit: this.itemsPerPage, totalPages: 0 };
            },
            (error: any) => {
                console.error('Error loading graduated students:', error);
            }
        );
    }

    // ===== STUDENT SEARCH =====
    onStudentSearchChange(query: string): void {
        this.searchStudentQuery = query;

        if (query.trim() === '') {
            this.isSearching = false;
            this.loadAllStudentYears();
            this.loadGraduatedStudents();
            return;
        }

        this.isSearching = true;
        this.adminService.searchStudents(query).subscribe(
            (data: Student[]) => {
                this.studentsByYear = {};
                this.studentPagination = {};
                this.graduatedStudents = [];
                data.forEach((student: Student) => {
                    if (student.status === 'graduated') {
                        this.graduatedStudents.push(student);
                    } else {
                        const year = student.yearLevel;
                        if (!this.studentsByYear[year]) {
                            this.studentsByYear[year] = [];
                        }
                        this.studentsByYear[year].push(student);
                    }
                });
            },
            (error: any) => {
                this.modalService.showError('ข้อผิดพลาด', 'ค้นหานักศึกษาไม่สำเร็จ');
                console.error('Error searching students:', error);
            }
        );
    }

    // ===== STUDENT PAGINATION =====
    onStudentPageChange(yearLevel: number, page: number): void {
        this.loadStudentYear(yearLevel, page);
    }

    onGraduatedPageChange(page: number): void {
        this.loadGraduatedStudents(page);
    }

    getPageNumbers(pagination: PaginationInfo, currentPage: number): number[] {
        if (!pagination) return [];
        const totalPages = pagination.totalPages;
        const pages: number[] = [];
        const maxVisible = 5;
        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);
        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return pages;
    }

    // ===== STUDENT ACTIONS =====
    promoteYear(yearLevel: number): void {
        const targetLabel = yearLevel === 4 ? 'สำเร็จการศึกษา' : `ชั้นปี ${yearLevel + 1}`;
        this.modalService.showConfirm(
            'เลื่อนชั้นนักศึกษา',
            `คุณต้องการเลื่อนชั้นนักศึกษาชั้นปี ${yearLevel} ไปเป็น ${targetLabel} ทั้งหมดหรือไม่?`,
            'เลื่อนชั้น',
            'ยกเลิก'
        );
        this.modalService.result$.pipe(take(1)).subscribe((result) => {
            if (result.confirmed) {
                this.adminService.promoteStudentsByYear(yearLevel).subscribe(
                    () => {
                        this.modalService.showSuccess('สำเร็จ', `เลื่อนชั้นนักศึกษาชั้นปี ${yearLevel} เรียบร้อยแล้ว`);
                        this.loadAllStudentYears();
                        this.loadGraduatedStudents();
                    },
                    (error: any) => {
                        this.modalService.showError('ข้อผิดพลาด', 'เลื่อนชั้นนักศึกษาไม่สำเร็จ');
                        console.error('Error:', error);
                    }
                );
            }
        });
    }

    deleteAllYear(yearLevel: number | string): void {
        const label = yearLevel === 'graduated' ? 'สำเร็จการศึกษา' : `ชั้นปี ${yearLevel}`;
        this.modalService.showConfirm(
            'ลบนักศึกษาทั้งหมด',
            `คุณต้องการลบนักศึกษา ${label} ทั้งหมดหรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้`,
            'ลบทั้งหมด',
            'ยกเลิก'
        );
        this.modalService.result$.pipe(take(1)).subscribe((result) => {
            if (result.confirmed) {
                this.adminService.deleteAllStudentsByYear(yearLevel).subscribe(
                    () => {
                        this.modalService.showSuccess('สำเร็จ', `ลบนักศึกษา ${label} ทั้งหมดแล้ว`);
                        if (yearLevel === 'graduated') {
                            this.loadGraduatedStudents();
                        } else {
                            this.loadStudentYear(yearLevel as number);
                        }
                    },
                    (error: any) => {
                        this.modalService.showError('ข้อผิดพลาด', 'ลบนักศึกษาไม่สำเร็จ');
                        console.error('Error:', error);
                    }
                );
            }
        });
    }

    deleteStudent(studentId: number): void {
        this.modalService.showConfirm(
            'ลบนักศึกษา',
            'คุณต้องการลบนักศึกษาคนนี้หรือไม่?',
            'ลบ',
            'ยกเลิก'
        );
        this.modalService.result$.pipe(take(1)).subscribe((result) => {
            if (result.confirmed) {
                this.adminService.deleteStudent(studentId).subscribe(
                    () => {
                        this.modalService.showSuccess('สำเร็จ', 'ลบนักศึกษาเรียบร้อยแล้ว');
                        this.loadAllStudentYears();
                        this.loadGraduatedStudents();
                    },
                    (error: any) => {
                        this.modalService.showError('ข้อผิดพลาด', 'ลบนักศึกษาไม่สำเร็จ');
                        console.error('Error:', error);
                    }
                );
            }
        });
    }

    // ===== TEACHER MANAGEMENT =====
    loadTeachers(): void {
        this.adminService.getTeachers().subscribe(
            (data: Teacher[]) => {
                this.teachers = data;
            },
            (error: any) => {
                this.modalService.showError('ข้อผิดพลาด', 'โหลดข้อมูลอาจารย์ไม่สำเร็จ');
                console.error('Error loading teachers:', error);
            }
        );
    }

    onTeacherSearchChange(query: string): void {
        this.searchTeacherQuery = query;

        if (query.trim() === '') {
            this.loadTeachers();
            return;
        }

        this.adminService.searchTeachers(query).subscribe(
            (data: Teacher[]) => {
                this.teachers = data;
            },
            (error: any) => {
                this.modalService.showError('ข้อผิดพลาด', 'ค้นหาอาจารย์ไม่สำเร็จ');
                console.error('Error searching teachers:', error);
            }
        );
    }

    deleteTeacher(teacherId: number): void {
        this.modalService.showConfirm(
            'ลบอาจารย์',
            'คุณต้องการลบอาจารย์คนนี้หรือไม่?',
            'ลบ',
            'ยกเลิก'
        );
        this.modalService.result$.pipe(take(1)).subscribe((result) => {
            if (result.confirmed) {
                this.adminService.deleteTeacher(teacherId).subscribe(
                    () => {
                        this.modalService.showSuccess('สำเร็จ', 'ลบอาจารย์เรียบร้อยแล้ว');
                        this.loadTeachers();
                    },
                    (error: any) => {
                        this.modalService.showError('ข้อผิดพลาด', 'ลบอาจารย์ไม่สำเร็จ');
                        console.error('Error:', error);
                    }
                );
            }
        });
    }

    // ===== ACTIVITIES =====
    loadActivities(page: number = 1): void {
        this.activityCurrentPage = page;
        const teacherId = this.filterTeacherId || undefined;

        if (this.searchActivityQuery.trim()) {
            this.adminService.searchActivities(this.searchActivityQuery, page, this.activityItemsPerPage, teacherId).subscribe(
                (response: PaginatedActivitiesResponse) => {
                    this.activities = response.data;
                    this.activityPagination = response.pagination;
                },
                (error: any) => {
                    this.modalService.showError('ข้อผิดพลาด', 'ค้นหากิจกรรมไม่สำเร็จ');
                    console.error('Error searching activities:', error);
                }
            );
        } else {
            this.adminService.getActivitiesAdmin(page, this.activityItemsPerPage, teacherId).subscribe(
                (response: PaginatedActivitiesResponse) => {
                    this.activities = response.data;
                    this.activityPagination = response.pagination;
                },
                (error: any) => {
                    console.error('Error loading activities:', error);
                }
            );
        }
    }

    onActivitySearchChange(query: string): void {
        this.searchActivityQuery = query;
        this.activityCurrentPage = 1;
        this.loadActivities(1);
    }

    onActivityTeacherFilter(teacherId: number | null): void {
        this.filterTeacherId = teacherId;
        this.activityCurrentPage = 1;
        this.loadActivities(1);
    }

    onActivityPageChange(page: number): void {
        this.loadActivities(page);
    }

    toggleActivity(activityId: number): void {
        this.expandedActivities[activityId] = !this.expandedActivities[activityId];
    }

    // ===== DIALOG MANAGEMENT =====
    openCreateStudentDialog(): void {
        this.dialogMode = 'create';
        this.dialogType = 'student';
        this.editingStudent = null;
        this.showDialog = true;
    }

    openEditStudentDialog(student: Student): void {
        this.dialogMode = 'edit';
        this.dialogType = 'student';
        this.editingStudent = { ...student };
        this.showDialog = true;
    }

    openCreateTeacherDialog(): void {
        this.dialogMode = 'create';
        this.dialogType = 'teacher';
        this.editingTeacher = null;
        this.showDialog = true;
    }

    openEditTeacherDialog(teacher: Teacher): void {
        this.dialogMode = 'edit';
        this.dialogType = 'teacher';
        this.editingTeacher = { ...teacher };
        this.showDialog = true;
    }

    closeDialog(): void {
        this.showDialog = false;
        this.editingStudent = null;
        this.editingTeacher = null;
    }

    onStudentSaved(): void {
        this.closeDialog();
        this.loadAllStudentYears();
        this.loadGraduatedStudents();
    }

    onTeacherSaved(): void {
        this.closeDialog();
        this.loadTeachers();
    }

    // ===== HELPERS =====
    getStudentYearLevels(): number[] {
        if (this.isSearching) {
            return Object.keys(this.studentsByYear)
                .map(k => parseInt(k))
                .sort((a, b) => a - b);
        }
        return this.yearLevels;
    }

    getYearLabel(yearLevel: number): string {
        return `ชั้นปี ${yearLevel}`;
    }

    getPromoteLabel(yearLevel: number): string {
        return yearLevel === 4 ? 'ให้นักศึกษาชั้นปี 4 สำเร็จการศึกษาทั้งหมด' : `เลื่อนชั้นทั้งหมดไปชั้นปี ${yearLevel + 1}`;
    }

    formatDate(dateStr: string): string {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
    }
}
