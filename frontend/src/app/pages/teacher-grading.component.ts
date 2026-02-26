import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TeacherService } from '../core/teacher.service';
import { BreadcrumbService } from '../core/breadcrumb.service';
import { ModalService } from '../core/modal.service';
import { take } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';

@Component({
  selector: 'app-teacher-grading',
  templateUrl: './teacher-grading.component.html',
  styleUrls: []
})
export class TeacherGradingComponent implements OnInit, OnDestroy {
  activityId: number = 0;
  activity: any = null;
  criteria: any[] = [];
  groups: any[] = [];
  submissionStatus = 'draft';

  // Letter grade options
  letterGrades: string[] = ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F'];

  // grades[groupId][criteriaId] = letter grade string
  gradeMap: { [groupId: number]: { [criteriaId: number]: string } } = {};
  // comments[groupId] = comment
  commentMap: { [groupId: number]: string } = {};
  // groupIds that already had submitted grades (locked after submission)
  gradedGroupIds: Set<number> = new Set();

  loading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private teacherService: TeacherService,
    private breadcrumbService: BreadcrumbService,
    private modalService: ModalService
  ) {}

  ngOnInit(): void {
    this.activityId = parseInt(this.route.snapshot.paramMap.get('activityId') || '0');

    this.breadcrumbService.setBreadcrumbs([
      { label: 'กิจกรรม', route: '/teacher/activities' },
      { label: 'ให้คะแนนกิจกรรม' }
    ]);
    this.loadGradingData();
  }

  ngOnDestroy(): void {
    this.breadcrumbService.clear();
  }

  private updateBreadcrumbButtons(): void {
    const buttons: any[] = [
      { label: 'กลับ', action: () => this.router.navigate(['/teacher/activities']), style: 'outline' }
    ];
    if (this.submissionStatus !== 'submitted' || this.hasUnlockedGroups()) {
      buttons.push({ label: 'ส่งเพื่ออนุมัติ', action: () => this.submitForApproval(), color: 'green' });
    }
    this.breadcrumbService.setButtons(buttons);
  }

  loadGradingData(): void {
    this.loading = true;
    this.teacherService.getGradingData(this.activityId).subscribe(
      (data: any) => {
        this.activity = data.activity;
        this.criteria = data.criteria;
        this.groups = data.groups;
        this.submissionStatus = data.submissionStatus;

        // Initialize grade map with empty strings
        this.groups.forEach((group: any) => {
          this.gradeMap[group.groupId] = {};
          this.commentMap[group.groupId] = '';
          this.criteria.forEach((c: any) => {
            this.gradeMap[group.groupId][c.criteriaId] = '';
          });
        });

        // Populate existing grades (now letter grade strings)
        this.gradedGroupIds = new Set();
        if (data.existingGrades) {
          data.existingGrades.forEach((g: any) => {
            if (this.gradeMap[g.groupId]) {
              this.gradeMap[g.groupId][g.criteriaId] = g.score || '';
              if (g.score && g.score !== '') this.gradedGroupIds.add(g.groupId);
            }
          });
        }

        // Populate existing comments
        if (data.existingComments) {
          data.existingComments.forEach((c: any) => {
            this.commentMap[c.groupId] = c.comment || '';
          });
        }

        this.loading = false;
        this.updateBreadcrumbButtons();
      },
      (err: any) => {
        this.modalService.showError('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลการให้คะแนนได้');
        this.loading = false;
        console.error('Error:', err);
      }
    );
  }

  isGroupLocked(groupId: number): boolean {
    return this.submissionStatus === 'submitted' && this.gradedGroupIds.has(groupId);
  }

  private hasUnlockedGroups(): boolean {
    return this.groups.some((g: any) => !this.isGroupLocked(g.groupId));
  }

  isAllGraded(): boolean {
    if (this.groups.length === 0 || this.criteria.length === 0) return false;
    return this.groups.every((g: any) => this.getGradedCount(g.groupId) === this.criteria.length);
  }

  getGradedCount(groupId: number): number {
    if (!this.gradeMap[groupId]) return 0;
    return Object.values(this.gradeMap[groupId]).filter(g => g && g !== '').length;
  }

  saveGrades(groupId: number): void {
    const grades: any[] = [];
    this.criteria.forEach((c: any) => {
      grades.push({
        groupId,
        criteriaId: c.criteriaId,
        score: this.gradeMap[groupId][c.criteriaId] || ''
      });
    });

    const comment = this.commentMap[groupId] || undefined;

    this.teacherService.submitGrades(this.activityId, grades, comment).subscribe(
      () => {
        this.modalService.showSuccess('สำเร็จ', 'บันทึกคะแนนเรียบร้อยแล้ว!');
      },
      (err: any) => {
        this.modalService.showError('ข้อผิดพลาด', err.error?.message || 'ไม่สามารถบันทึกคะแนนได้');
      }
    );
  }

  private saveAllGrades$() {
    const saveRequests = this.groups.map((group: any) => {
      const grades: any[] = [];
      this.criteria.forEach((c: any) => {
        grades.push({
          groupId: group.groupId,
          criteriaId: c.criteriaId,
          score: this.gradeMap[group.groupId][c.criteriaId] || ''
        });
      });
      const comment = this.commentMap[group.groupId] || undefined;
      return this.teacherService.submitGrades(this.activityId, grades, comment);
    });

    return saveRequests.length > 0 ? forkJoin(saveRequests) : of([]);
  }

  submitForApproval(): void {
    this.modalService.showConfirm(
      'ยืนยันการส่ง',
      'ระบบจะบันทึกคะแนนทั้งหมดและส่งเพื่ออนุมัติ การกระทำนี้ไม่สามารถย้อนกลับได้',
      'ส่งเพื่ออนุมัติ',
      'ยกเลิก'
    );

    this.modalService.result$.pipe(take(1)).subscribe((result) => {
      if (!result.confirmed) return;

      this.saveAllGrades$().subscribe(
        () => {
          this.teacherService.submitForApproval(this.activityId).subscribe(
            () => {
              this.modalService.showSuccess('สำเร็จ', 'บันทึกคะแนนและส่งเพื่ออนุมัติเรียบร้อยแล้ว!');
              this.loadGradingData();
            },
            (err: any) => {
              this.modalService.showError('ข้อผิดพลาด', err.error?.message || 'ไม่สามารถส่งเพื่ออนุมัติได้');
            }
          );
        },
        (err: any) => {
          this.modalService.showError('ข้อผิดพลาด', err.error?.message || 'ไม่สามารถบันทึกคะแนนได้ กรุณาลองใหม่');
        }
      );
    });
  }
}
