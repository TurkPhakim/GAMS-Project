import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './pages/login.component';
import { AdminHomeComponent } from './pages/admin-home.component';
import { AdminManageComponent } from './pages/admin-manage.component';
import { TeacherHomeComponent } from './pages/teacher-home.component';
import { StudentHomeComponent } from './pages/student-home.component';
import { AuthGuard } from './guards/auth.guard';
import { RoleGuard } from './guards/role.guard';

import { TeacherActivitiesListComponent } from './pages/teacher-activities-list.component';
import { TeacherCreateActivityComponent } from './pages/teacher-create-activity.component';
import { TeacherGradingComponent } from './pages/teacher-grading.component';
import { TeacherActivityProgressComponent } from './pages/teacher-activity-progress.component';
import { TeacherStudentsComponent } from './pages/teacher-students.component';
import { StudentGroupsComponent } from './pages/student-groups.component';
import { StudentDashboardComponent } from './pages/student-dashboard.component';
import { StudentActivitiesComponent } from './pages/student-activities.component';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: 'admin',
    component: AdminHomeComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { role: 'admin' }
  },
  {
    path: 'admin/manage',
    component: AdminManageComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { role: 'admin' }
  },
  {
    path: 'teacher',
    component: TeacherHomeComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { role: 'teacher' }
  },
  {
    path: 'teacher/activities',
    component: TeacherActivitiesListComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { role: 'teacher' }
  },
  {
    path: 'teacher/activities/create',
    component: TeacherCreateActivityComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { role: 'teacher' }
  },
  {
    path: 'teacher/students',
    component: TeacherStudentsComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { role: 'teacher' }
  },
  {
    path: 'teacher/activities/:activityId/progress',
    component: TeacherActivityProgressComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { role: 'teacher' }
  },
  {
    path: 'teacher/grading/:activityId',
    component: TeacherGradingComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { role: 'teacher' }
  },
  {
    path: 'student',
    component: StudentHomeComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { role: 'student' }
  },
  {
    path: 'student/activities',
    component: StudentActivitiesComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { role: 'student' }
  },
  {
    path: 'student/groups',
    component: StudentGroupsComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { role: 'student' }
  },
  {
    path: 'student/dashboard',
    component: StudentDashboardComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { role: 'student' }
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
