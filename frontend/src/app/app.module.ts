import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { HeaderComponent } from './components/header.component';
import { ModalComponent } from './components/modal.component';
import { LoginComponent } from './pages/login.component';
import { AdminHomeComponent } from './pages/admin-home.component';
import { AdminManageComponent } from './pages/admin-manage.component';
import { StudentAddFormComponent } from './pages/student-add-form.component';
import { TeacherAddFormComponent } from './pages/teacher-add-form.component';
import { TeacherHomeComponent } from './pages/teacher-home.component';
import { TeacherActivitiesListComponent } from './pages/teacher-activities-list.component';
import { TeacherCreateActivityComponent } from './pages/teacher-create-activity.component';
import { TeacherGradingComponent } from './pages/teacher-grading.component';
import { TeacherActivityProgressComponent } from './pages/teacher-activity-progress.component';
import { TeacherStudentsComponent } from './pages/teacher-students.component';
import { StudentHomeComponent } from './pages/student-home.component';
import { StudentGroupsComponent } from './pages/student-groups.component';
import { StudentCreateGroupComponent } from './pages/student-create-group.component';
import { StudentDashboardComponent } from './pages/student-dashboard.component';
import { StudentActivitiesComponent } from './pages/student-activities.component';
import { AuthInterceptor } from './core/auth.interceptor';

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    ModalComponent,
    LoginComponent,
    AdminHomeComponent,
    AdminManageComponent,
    StudentAddFormComponent,
    TeacherAddFormComponent,
    TeacherHomeComponent,
    TeacherActivitiesListComponent,
    TeacherCreateActivityComponent,
    TeacherGradingComponent,
    TeacherActivityProgressComponent,
    TeacherStudentsComponent,
    StudentHomeComponent,
    StudentGroupsComponent,
    StudentCreateGroupComponent,
    StudentDashboardComponent,
    StudentActivitiesComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule,
    CommonModule,
    AppRoutingModule
  ],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
