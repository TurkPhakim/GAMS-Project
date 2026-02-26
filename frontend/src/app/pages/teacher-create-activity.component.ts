import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TeacherService } from '../core/teacher.service';
import { BreadcrumbService } from '../core/breadcrumb.service';
import { ModalService } from '../core/modal.service';

@Component({
  selector: 'app-teacher-create-activity',
  templateUrl: './teacher-create-activity.component.html',
  styleUrls: []
})
export class TeacherCreateActivityComponent implements OnInit, OnDestroy {
  activityForm: FormGroup;
  criteriaList: string[] = [];
  newCriteriaName = '';

  // Teacher/grader selection
  allTeachers: any[] = [];
  selectedGraders: number[] = [];

  // Year level selection
  yearLevelOptions = [1, 2, 3, 4];
  selectedYearLevels: number[] = [1, 2, 3, 4];

  submitting = false;

  constructor(
    private fb: FormBuilder,
    private teacherService: TeacherService,
    private router: Router,
    private breadcrumbService: BreadcrumbService,
    private modalService: ModalService
  ) {
    this.activityForm = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.breadcrumbService.setBreadcrumbs([
      { label: 'กิจกรรม', route: '/teacher/activities' },
      { label: 'สร้างกิจกรรม' }
    ]);
    this.breadcrumbService.setButtons([
      { label: 'กลับ', action: () => this.router.navigate(['/teacher/activities']), style: 'outline' },
      { label: 'บันทึก', action: () => this.submitActivity(), color: 'blue' }
    ]);

    this.loadTeachers();
  }

  ngOnDestroy(): void {
    this.breadcrumbService.clear();
  }

  loadTeachers(): void {
    this.teacherService.getAllTeachers().subscribe(
      (data: any) => { this.allTeachers = data || []; },
      (error: any) => { console.error('Error loading teachers:', error); }
    );
  }

  toggleGrader(teacherId: number): void {
    const idx = this.selectedGraders.indexOf(teacherId);
    if (idx > -1) {
      this.selectedGraders.splice(idx, 1);
    } else {
      this.selectedGraders.push(teacherId);
    }
  }

  isGraderSelected(teacherId: number): boolean {
    return this.selectedGraders.includes(teacherId);
  }

  toggleYearLevel(year: number): void {
    const idx = this.selectedYearLevels.indexOf(year);
    if (idx > -1) {
      this.selectedYearLevels.splice(idx, 1);
    } else {
      this.selectedYearLevels.push(year);
      this.selectedYearLevels.sort();
    }
  }

  isYearLevelSelected(year: number): boolean {
    return this.selectedYearLevels.includes(year);
  }

  addCriteria(): void {
    if (!this.newCriteriaName.trim()) {
      this.modalService.showError('ข้อผิดพลาด', 'กรุณากรอกชื่อเกณฑ์');
      return;
    }

    this.criteriaList.push(this.newCriteriaName.trim());
    this.newCriteriaName = '';
  }

  removeCriteria(index: number): void {
    this.criteriaList.splice(index, 1);
  }

  submitActivity(): void {
    if (this.activityForm.invalid) {
      this.modalService.showError('ข้อผิดพลาด', 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }
    if (this.criteriaList.length === 0) {
      this.modalService.showError('ข้อผิดพลาด', 'กรุณาเพิ่มเกณฑ์อย่างน้อย 1 ข้อ');
      return;
    }
    if (this.selectedYearLevels.length === 0) {
      this.modalService.showError('ข้อผิดพลาด', 'กรุณาเลือกชั้นปีอย่างน้อย 1 ชั้นปี');
      return;
    }

    this.submitting = true;

    const payload = {
      ...this.activityForm.value,
      criteria: this.criteriaList.map(name => ({ name })),
      graders: this.selectedGraders,
      targetYearLevels: this.selectedYearLevels
    };

    this.teacherService.createActivity(payload).subscribe(
      () => {
        this.modalService.showSuccess('สำเร็จ', 'สร้างกิจกรรมเรียบร้อยแล้ว!');
        setTimeout(() => {
          this.router.navigate(['/teacher/activities']);
        }, 1500);
      },
      (error: any) => {
        this.modalService.showError('ข้อผิดพลาด', error.error?.message || 'ไม่สามารถสร้างกิจกรรมได้');
        this.submitting = false;
      }
    );
  }
}
