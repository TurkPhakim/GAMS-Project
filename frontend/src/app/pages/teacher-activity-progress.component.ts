import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TeacherService } from '../core/teacher.service';
import { BreadcrumbService } from '../core/breadcrumb.service';

@Component({
  selector: 'app-teacher-activity-progress',
  templateUrl: './teacher-activity-progress.component.html',
  styleUrls: []
})
export class TeacherActivityProgressComponent implements OnInit, OnDestroy {
  activityId: number = 0;
  progressData: any = null;
  loading = true;
  expandedGroups: { [key: number]: boolean } = {};

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private teacherService: TeacherService,
    private breadcrumbService: BreadcrumbService
  ) {}

  ngOnInit(): void {
    this.activityId = parseInt(this.route.snapshot.paramMap.get('activityId') || '0');
    this.breadcrumbService.setBreadcrumbs([
      { label: 'กิจกรรม', route: '/teacher/activities' },
      { label: 'ความคืบหน้า' }
    ]);
    this.breadcrumbService.setButtons([
      { label: 'กลับ', action: () => this.router.navigate(['/teacher/activities']), style: 'outline' }
    ]);
    this.loadProgress();
  }

  ngOnDestroy(): void {
    this.breadcrumbService.clear();
  }

  loadProgress(): void {
    this.loading = true;
    this.teacherService.getActivityProgress(this.activityId).subscribe(
      (data: any) => {
        this.progressData = data;
        this.loading = false;
      },
      (err: any) => {
        console.error('Error loading progress:', err);
        this.loading = false;
      }
    );
  }

  toggleGroup(groupId: number): void {
    this.expandedGroups[groupId] = !this.expandedGroups[groupId];
  }

  getGraderProgressPercent(grader: any): number {
    if (!grader.totalGroupCount) return 0;
    return Math.round((grader.gradedGroupCount / grader.totalGroupCount) * 100);
  }

  getGpaColor(gpa: number | null): string {
    if (gpa === null) return 'text-slate-400';
    if (gpa >= 3.5) return 'text-emerald-600';
    if (gpa >= 2.5) return 'text-blue-600';
    if (gpa >= 1.5) return 'text-amber-600';
    return 'text-red-600';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  formatDateTime(dateStr: string): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
