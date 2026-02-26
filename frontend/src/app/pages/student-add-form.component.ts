import { Component, OnInit, OnChanges, SimpleChanges, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminService, Student } from '../core/admin.service';
import { ModalService } from '../core/modal.service';

@Component({
    selector: 'app-student-add-form',
    templateUrl: './student-add-form.component.html',
    styleUrls: []
})
export class StudentAddFormComponent implements OnInit, OnChanges {
    @Input() mode: 'create' | 'edit' = 'create';
    @Input() student: Student | null = null;
    @Output() saved = new EventEmitter<void>();
    @Output() cancelled = new EventEmitter<void>();
    @Output() added = new EventEmitter<void>();

    addForm: FormGroup;
    submitting = false;

    constructor(
        private adminService: AdminService,
        private fb: FormBuilder,
        private modalService: ModalService
    ) {
        this.addForm = this.fb.group({
            studentId: ['', Validators.required],
            fullName: ['', Validators.required],
            nickname: [''],
            citizenId: ['', Validators.required],
            yearLevel: ['', Validators.required],
            entryYear: ['', Validators.required],
            status: ['active']
        });
    }

    ngOnInit(): void {
        this.initForm();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['student'] || changes['mode']) {
            this.initForm();
        }
    }

    private initForm(): void {
        if (this.mode === 'edit' && this.student) {
            this.addForm.patchValue({
                studentId: this.student.studentId,
                fullName: this.student.fullName,
                nickname: this.student.nickname,
                citizenId: this.student.citizenId,
                yearLevel: this.student.yearLevel,
                entryYear: this.student.entryYear,
                status: this.student.status || 'active'
            });
            this.addForm.get('studentId')?.disable();
        } else {
            this.addForm.reset({ status: 'active', yearLevel: '', entryYear: '' });
            this.addForm.get('studentId')?.enable();
        }
    }

    toggleStatus(): void {
        const current = this.addForm.get('status')?.value;
        this.addForm.get('status')?.setValue(current === 'active' ? 'inactive' : 'active');
    }

    get isActive(): boolean {
        return this.addForm.get('status')?.value === 'active';
    }

    submitForm(): void {
        if (this.addForm.invalid) return;
        this.submitting = true;

        if (this.mode === 'create') {
            this.adminService.addStudent(this.addForm.getRawValue()).subscribe(
                () => {
                    this.modalService.showSuccess('สำเร็จ', 'เพิ่มนักศึกษาเรียบร้อยแล้ว!');
                    this.addForm.reset({ status: 'active' });
                    this.saved.emit();
                    this.added.emit();
                    this.submitting = false;
                },
                (error: any) => {
                    const errorMessage = error.error?.message || 'เพิ่มนักศึกษาไม่สำเร็จ';
                    this.modalService.showError('ข้อผิดพลาด', errorMessage);
                    this.submitting = false;
                }
            );
        } else {
            this.adminService.updateStudent(this.student!.studentId, this.addForm.getRawValue()).subscribe(
                () => {
                    this.modalService.showSuccess('สำเร็จ', 'อัปเดตนักศึกษาเรียบร้อยแล้ว!');
                    this.saved.emit();
                    this.submitting = false;
                },
                (error: any) => {
                    const errorMessage = error.error?.message || 'อัปเดตนักศึกษาไม่สำเร็จ';
                    this.modalService.showError('ข้อผิดพลาด', errorMessage);
                    this.submitting = false;
                }
            );
        }
    }
}
