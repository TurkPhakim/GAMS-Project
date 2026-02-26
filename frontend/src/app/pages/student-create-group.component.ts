import { Component, OnInit, OnChanges, Input, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { StudentService } from '../core/student.service';
import { ModalService } from '../core/modal.service';

@Component({
  selector: 'app-student-create-group',
  templateUrl: './student-create-group.component.html',
  styleUrls: []
})
export class StudentCreateGroupComponent implements OnInit, OnChanges {
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() group: any = null;
  @Input() preselectedActivityId: number = 0;
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  groupForm: FormGroup;
  availableStudents: any[] = [];
  selectedMemberIds: number[] = [];
  activityId: number = 0;
  activities: any[] = [];

  submitting = false;

  constructor(
    private fb: FormBuilder,
    private studentService: StudentService,
    private modalService: ModalService
  ) {
    this.groupForm = this.fb.group({
      groupName: ['', Validators.required],
      description: ['']
    });
  }

  ngOnInit(): void {
    this.loadActivities();
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['group'] || changes['mode']) {
      this.initForm();
    }
  }

  private initForm(): void {
    if (this.mode === 'edit' && this.group) {
      this.groupForm.patchValue({
        groupName: this.group.groupName,
        description: this.group.description
      });
      this.activityId = this.group.activityId;
      this.selectedMemberIds = (this.group.members || []).map((m: any) => m.studentId);
      this.loadStudents(this.activityId);
    } else {
      this.groupForm.reset();
      this.activityId = this.preselectedActivityId || 0;
      this.selectedMemberIds = [];
      if (this.activityId) {
        this.loadStudents(this.activityId);
      }
    }
    this.submitting = false;
  }

  onActivityChange(): void {
    this.selectedMemberIds = [];
    if (this.activityId) {
      this.loadStudents(this.activityId);
    } else {
      this.availableStudents = [];
    }
  }

  loadStudents(activityId?: number): void {
    this.studentService.getAllStudents(activityId).subscribe(
      (data: any) => {
        this.availableStudents = data || [];
        // In edit mode, keep selected members that are still available
        if (this.mode === 'edit') {
          const availableIds = this.availableStudents.map((s: any) => s.studentId);
          // Include current group members even if they are "taken" (they belong to THIS group)
          this.availableStudents = [
            ...this.availableStudents,
            ...(this.group?.members || [])
              .filter((m: any) => !availableIds.includes(m.studentId))
              .map((m: any) => ({ studentId: m.studentId, fullName: m.fullName, nickname: m.nickname, yearLevel: m.yearLevel }))
          ];
        }
      },
      (error: any) => console.error('Error loading students:', error)
    );
  }

  loadActivities(): void {
    this.studentService.getActivities().subscribe(
      (data: any) => {
        if (this.mode === 'edit') {
          this.activities = data || [];
        } else {
          this.activities = (data || []).filter((a: any) => !a.myGroupId);
        }
      },
      (error: any) => console.error('Error loading activities:', error)
    );
  }

  onMemberChange(event: any): void {
    const studentId = parseInt(event.target.value);
    if (event.target.checked) {
      if (!this.selectedMemberIds.includes(studentId)) {
        this.selectedMemberIds.push(studentId);
      }
    } else {
      this.selectedMemberIds = this.selectedMemberIds.filter(id => id !== studentId);
    }
  }

  getMemberName(studentId: number): string {
    const student = this.availableStudents.find(s => s.studentId === studentId);
    return student ? student.fullName : '';
  }

  submitGroup(): void {
    if (this.groupForm.invalid || (!this.activityId && this.mode === 'create')) {
      this.modalService.showError('ข้อผิดพลาด', 'กรุณากรอกข้อมูลให้ครบและเลือกกิจกรรม');
      return;
    }
    if (this.selectedMemberIds.length === 0) {
      this.modalService.showError('ข้อผิดพลาด', 'กรุณาเลือกสมาชิกอย่างน้อย 1 คน');
      return;
    }

    this.submitting = true;

    if (this.mode === 'create') {
      const payload = {
        activityId: this.activityId,
        groupName: this.groupForm.value.groupName,
        description: this.groupForm.value.description,
        members: this.selectedMemberIds
      };

      this.studentService.createGroup(payload).subscribe(
        () => {
          this.modalService.showSuccess('สำเร็จ', 'สร้างกลุ่มเรียบร้อยแล้ว!');
          this.saved.emit();
          this.submitting = false;
        },
        (error: any) => {
          this.modalService.showError('ข้อผิดพลาด', error.error?.message || 'สร้างกลุ่มไม่สำเร็จ');
          this.submitting = false;
        }
      );
    } else {
      const payload = {
        groupName: this.groupForm.value.groupName,
        description: this.groupForm.value.description,
        members: this.selectedMemberIds
      };

      this.studentService.updateGroup(this.group.groupId, payload).subscribe(
        () => {
          this.modalService.showSuccess('สำเร็จ', 'อัปเดตกลุ่มเรียบร้อยแล้ว!');
          this.saved.emit();
          this.submitting = false;
        },
        (error: any) => {
          this.modalService.showError('ข้อผิดพลาด', error.error?.message || 'อัปเดตกลุ่มไม่สำเร็จ');
          this.submitting = false;
        }
      );
    }
  }
}
