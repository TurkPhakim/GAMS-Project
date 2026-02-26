import { Component, OnInit, OnChanges, SimpleChanges, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminService, Teacher } from '../core/admin.service';
import { ModalService } from '../core/modal.service';

@Component({
    selector: 'app-teacher-add-form',
    templateUrl: './teacher-add-form.component.html',
    styleUrls: []
})
export class TeacherAddFormComponent implements OnInit, OnChanges {
    @Input() mode: 'create' | 'edit' = 'create';
    @Input() teacher: Teacher | null = null;
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
            email: ['', [Validators.required, Validators.email]],
            fullName: ['', Validators.required],
            nickname: [''],
            citizenId: ['', Validators.required],
            status: ['active']
        });
    }

    ngOnInit(): void {
        this.initForm();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['teacher'] || changes['mode']) {
            this.initForm();
        }
    }

    private initForm(): void {
        if (this.mode === 'edit' && this.teacher) {
            this.addForm.patchValue({
                email: this.teacher.email,
                fullName: this.teacher.fullName,
                nickname: this.teacher.nickname,
                citizenId: this.teacher.citizenId,
                status: this.teacher.status || 'active'
            });
        } else {
            this.addForm.reset({ status: 'active' });
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
            this.adminService.addTeacher(this.addForm.value).subscribe(
                () => {
                    this.modalService.showSuccess('สำเร็จ', 'เพิ่มอาจารย์เรียบร้อยแล้ว!');
                    this.addForm.reset({ status: 'active' });
                    this.saved.emit();
                    this.added.emit();
                    this.submitting = false;
                },
                (error: any) => {
                    const errorMessage = error.error?.message || 'เพิ่มอาจารย์ไม่สำเร็จ';
                    this.modalService.showError('ข้อผิดพลาด', errorMessage);
                    this.submitting = false;
                }
            );
        } else {
            this.adminService.updateTeacher(this.teacher!.teacherId, this.addForm.value).subscribe(
                () => {
                    this.modalService.showSuccess('สำเร็จ', 'อัปเดตอาจารย์เรียบร้อยแล้ว!');
                    this.saved.emit();
                    this.submitting = false;
                },
                (error: any) => {
                    const errorMessage = error.error?.message || 'อัปเดตอาจารย์ไม่สำเร็จ';
                    this.modalService.showError('ข้อผิดพลาด', errorMessage);
                    this.submitting = false;
                }
            );
        }
    }
}
