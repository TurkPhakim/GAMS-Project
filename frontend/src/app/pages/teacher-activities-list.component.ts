import { Component, OnInit, OnDestroy } from '@angular/core';
import { TeacherService } from '../core/teacher.service';
import { BreadcrumbService } from '../core/breadcrumb.service';
import { ModalService } from '../core/modal.service';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-teacher-activities-list',
  templateUrl: './teacher-activities-list.component.html',
  styleUrls: []
})
export class TeacherActivitiesListComponent implements OnInit, OnDestroy {
  activities: any[] = [];
  loading = false;

  // Search & Pagination
  searchQuery = '';
  currentPage = 1;
  itemsPerPage = 10;
  pagination = { total: 0, page: 1, limit: 10, totalPages: 0 };

  constructor(
    private teacherService: TeacherService,
    private breadcrumbService: BreadcrumbService,
    private modalService: ModalService
  ) {}

  ngOnInit(): void {
    this.breadcrumbService.setBreadcrumbs([
      { label: 'หน้าหลัก', route: '/teacher' },
      { label: 'กิจกรรม' }
    ]);
    this.loadActivities();
  }

  ngOnDestroy(): void {
    this.breadcrumbService.clear();
  }

  loadActivities(page: number = 1): void {
    this.loading = true;
    this.currentPage = page;
    this.teacherService.getActivities(page, this.itemsPerPage, this.searchQuery).subscribe(
      (response: any) => {
        this.activities = response.data || [];
        this.pagination = response.pagination || { total: 0, page: 1, limit: this.itemsPerPage, totalPages: 0 };
        this.loading = false;
      },
      (error: any) => {
        console.error('Error loading activities:', error);
        this.loading = false;
      }
    );
  }

  onSearchChange(query: string): void {
    this.searchQuery = query;
    this.currentPage = 1;
    this.loadActivities(1);
  }

  onPageChange(page: number): void {
    this.loadActivities(page);
  }

  getPageNumbers(): number[] {
    const totalPages = this.pagination.totalPages;
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  getYearLevels(activity: any): number[] {
    try {
      const raw = activity.targetYearLevels;
      if (!raw) return [];
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  deleteActivity(activityId: number): void {
    this.modalService.showConfirm('ยืนยันการลบ', 'ต้องการลบกิจกรรมนี้หรือไม่?', 'ลบ', 'ยกเลิก');

    this.modalService.result$.pipe(take(1)).subscribe((result) => {
      if (!result.confirmed) return;

      this.teacherService.deleteActivity(activityId).subscribe(
        () => {
          this.modalService.showSuccess('สำเร็จ', 'ลบกิจกรรมเรียบร้อยแล้ว');
          this.loadActivities(this.currentPage);
        },
        (error: any) => {
          this.modalService.showError('ข้อผิดพลาด', error.error?.message || 'ลบกิจกรรมไม่สำเร็จ');
        }
      );
    });
  }
}
