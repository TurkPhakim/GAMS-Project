import { Component, OnInit, OnDestroy } from '@angular/core';
import { StudentService } from '../core/student.service';
import { BreadcrumbService } from '../core/breadcrumb.service';

@Component({
  selector: 'app-student-dashboard',
  templateUrl: './student-dashboard.component.html',
  styleUrls: []
})
export class StudentDashboardComponent implements OnInit, OnDestroy {
  activities: any[] = [];
  loading = false;
  stats = {
    totalActivities: 0,
    gradedActivities: 0,
    averageScore: 0
  };

  constructor(
    private studentService: StudentService,
    private breadcrumbService: BreadcrumbService
  ) {}

  ngOnInit(): void {
    this.breadcrumbService.setBreadcrumbs([
      { label: 'หน้าหลัก', route: '/student' },
      { label: 'แดชบอร์ด' }
    ]);
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    this.breadcrumbService.clear();
  }

  loadDashboardData(): void {
    this.loading = true;
    this.studentService.getDashboard().subscribe(
      (data: any) => {
        this.activities = data || [];
        this.calculateStats();
        this.loading = false;
      },
      (error: any) => {
        console.error('Error loading dashboard:', error);
        this.loading = false;
      }
    );
  }

  calculateStats(): void {
    this.stats.totalActivities = this.activities.length;
    this.stats.gradedActivities = this.activities.filter((a: any) => a.status === 'Graded').length;

    const gradedWithScore = this.activities.filter((a: any) => a.score !== null);
    if (gradedWithScore.length > 0) {
      const totalScore = gradedWithScore.reduce((sum: number, a: any) => sum + a.score, 0);
      this.stats.averageScore = totalScore / gradedWithScore.length;
    }
  }

  getGradeColor(grade: string): string {
    switch (grade) {
      case 'A': return 'text-emerald-600';
      case 'B+': return 'text-teal-600';
      case 'B': return 'text-blue-600';
      case 'C+': return 'text-amber-600';
      case 'C': return 'text-orange-600';
      case 'D+': return 'text-red-500';
      case 'D': return 'text-red-600';
      case 'F': return 'text-red-700';
      default: return 'text-gray-500';
    }
  }

  getGradeBg(grade: string): string {
    switch (grade) {
      case 'A': return 'from-emerald-600 to-emerald-500';
      case 'B+': return 'from-teal-600 to-teal-500';
      case 'B': return 'from-blue-600 to-blue-500';
      case 'C+': return 'from-amber-500 to-amber-400';
      case 'C': return 'from-orange-600 to-orange-500';
      case 'D+': return 'from-red-500 to-red-400';
      case 'D': return 'from-red-600 to-red-500';
      case 'F': return 'from-red-700 to-red-600';
      default: return 'from-gray-500 to-gray-400';
    }
  }
}
