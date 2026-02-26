import { Component, OnInit, OnDestroy } from '@angular/core';
import { StudentService } from '../core/student.service';
import { BreadcrumbService } from '../core/breadcrumb.service';

@Component({
  selector: 'app-student-activities',
  templateUrl: './student-activities.component.html',
  styleUrls: []
})
export class StudentActivitiesComponent implements OnInit, OnDestroy {
  activities: any[] = [];
  loading = false;

  // Score dialog
  scoreDialogVisible = false;
  scoreDialogLoading = false;
  scoreDialogData: any = null;
  scoreDialogActivity: any = null;

  constructor(
    private studentService: StudentService,
    private breadcrumbService: BreadcrumbService
  ) {}

  ngOnInit(): void {
    this.breadcrumbService.setBreadcrumbs([
      { label: 'หน้าหลัก', route: '/student' },
      { label: 'กิจกรรม' }
    ]);
    this.loadActivities();
  }

  ngOnDestroy(): void {
    this.breadcrumbService.clear();
  }

  loadActivities(): void {
    this.loading = true;
    this.studentService.getActivities().subscribe(
      (data: any) => {
        this.activities = data || [];
        this.loading = false;
      },
      (error: any) => {
        console.error('Error loading activities:', error);
        this.loading = false;
      }
    );
  }

  formatYearLevels(levels: number[] | null): string {
    if (!levels || levels.length === 0 || levels.length === 4) return 'ทุกชั้นปี';
    return levels.sort((a, b) => a - b).map(y => `ปี ${y}`).join(', ');
  }

  openScoreDialog(activity: any): void {
    this.scoreDialogActivity = activity;
    this.scoreDialogData = null;
    this.scoreDialogVisible = true;
    this.scoreDialogLoading = true;
    this.studentService.getDashboardByActivity(activity.activityId).subscribe({
      next: (data) => {
        this.scoreDialogData = data;
        this.scoreDialogLoading = false;
      },
      error: (err) => {
        console.error('Error loading score:', err);
        this.scoreDialogLoading = false;
      }
    });
  }

  closeScoreDialog(): void {
    this.scoreDialogVisible = false;
    this.scoreDialogData = null;
    this.scoreDialogActivity = null;
  }

  hasGrades(): boolean {
    return this.scoreDialogData &&
      this.scoreDialogData.criteriaScores &&
      this.scoreDialogData.criteriaScores.length > 0 &&
      this.scoreDialogData.finalGrade !== '';
  }

  getGradeBg(grade: string): string {
    switch (grade) {
      case 'A':  return 'from-emerald-600 to-emerald-500';
      case 'B+': return 'from-teal-600 to-teal-500';
      case 'B':  return 'from-blue-600 to-blue-500';
      case 'C+': return 'from-amber-500 to-amber-400';
      case 'C':  return 'from-orange-600 to-orange-500';
      case 'D+': return 'from-red-500 to-red-400';
      case 'D':  return 'from-red-600 to-red-500';
      case 'F':  return 'from-red-700 to-red-600';
      default:   return 'from-gray-500 to-gray-400';
    }
  }

  getGradeTextColor(grade: string): string {
    switch (grade) {
      case 'A':  return 'text-emerald-700';
      case 'B+': return 'text-teal-700';
      case 'B':  return 'text-blue-700';
      case 'C+': return 'text-amber-600';
      case 'C':  return 'text-orange-700';
      case 'D+': return 'text-red-500';
      case 'D':  return 'text-red-600';
      case 'F':  return 'text-red-700';
      default:   return 'text-gray-600';
    }
  }
}
