import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { StudentService } from '../core/student.service';
import { BreadcrumbService } from '../core/breadcrumb.service';
import { ModalService } from '../core/modal.service';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-student-groups',
  templateUrl: './student-groups.component.html',
  styleUrls: []
})
export class StudentGroupsComponent implements OnInit, OnDestroy {
  groups: any[] = [];

  // Dialog state
  showDialog = false;
  dialogMode: 'create' | 'edit' = 'create';
  editingGroup: any = null;
  preselectedActivityId: number = 0;

  constructor(
    private studentService: StudentService,
    private breadcrumbService: BreadcrumbService,
    private modalService: ModalService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.breadcrumbService.setBreadcrumbs([
      { label: 'หน้าหลัก', route: '/student' },
      { label: 'กลุ่ม' }
    ]);
    this.loadGroups();

    // Auto-open create dialog if navigated from activities page
    this.route.queryParams.subscribe(params => {
      if (params['createForActivity']) {
        this.preselectedActivityId = parseInt(params['createForActivity']);
        this.openCreateGroupDialog();
      }
    });
  }

  ngOnDestroy(): void {
    this.breadcrumbService.clear();
  }

  loadGroups(): void {
    this.studentService.getGroups().subscribe(
      (data: any) => {
        this.groups = data || [];
      },
      (error: any) => console.error('Error loading groups:', error)
    );
  }

  deleteGroup(groupId: number): void {
    this.modalService.showConfirm('ยืนยันการลบ', 'ต้องการลบกลุ่มนี้หรือไม่?', 'ลบ', 'ยกเลิก');

    this.modalService.result$.pipe(take(1)).subscribe((result) => {
      if (!result.confirmed) return;

      this.studentService.deleteGroup(groupId).subscribe(
        () => {
          this.modalService.showSuccess('สำเร็จ', 'ลบกลุ่มเรียบร้อยแล้ว');
          this.loadGroups();
        },
        (error: any) => {
          this.modalService.showError('ข้อผิดพลาด', error.error?.message || 'ลบกลุ่มไม่สำเร็จ');
        }
      );
    });
  }

  // Dialog management
  openCreateGroupDialog(): void {
    this.dialogMode = 'create';
    this.editingGroup = null;
    this.showDialog = true;
  }

  openEditGroupDialog(group: any): void {
    this.dialogMode = 'edit';
    this.editingGroup = { ...group, members: [...(group.members || [])] };
    this.showDialog = true;
  }

  closeDialog(): void {
    this.showDialog = false;
    this.editingGroup = null;
    this.preselectedActivityId = 0;
  }

  onGroupSaved(): void {
    this.closeDialog();
    this.loadGroups();
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

  getGradeTextColor(grade: string): string {
    switch (grade) {
      case 'A': return 'text-emerald-700';
      case 'B+': return 'text-teal-700';
      case 'B': return 'text-blue-700';
      case 'C+': return 'text-amber-600';
      case 'C': return 'text-orange-700';
      case 'D+': return 'text-red-500';
      case 'D': return 'text-red-600';
      case 'F': return 'text-red-700';
      default: return 'text-gray-600';
    }
  }
}
