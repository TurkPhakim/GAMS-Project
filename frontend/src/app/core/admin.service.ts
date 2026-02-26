// Admin Service
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Student {
  studentId: number;
  userId: number;
  fullName: string;
  nickname: string;
  citizenId: string;
  yearLevel: number;
  entryYear: number;
  status: string;
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedStudentsResponse {
  data: { [key: number]: Student[] };
  pagination: { [key: number]: PaginationInfo };
}

export interface GraduatedStudentsResponse {
  data: Student[];
  pagination: PaginationInfo;
}

export interface Teacher {
  teacherId: number;
  userId: number;
  fullName: string;
  nickname: string;
  citizenId: string;
  email: string;
  status: string;
}

export interface ActivityAdmin {
  activityId: number;
  createdByTeacherId: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  teacherName: string;
  teacherEmail: string;
  criteria: { criteriaId: number; name: string; maxScore: number; weight: number }[];
  graders: { teacherId: number; fullName: string; email: string }[];
  groups: {
    groupId: number;
    groupName: string;
    description: string;
    members: { studentId: number; fullName: string; nickname: string }[];
  }[];
}

export interface PaginatedActivitiesResponse {
  data: ActivityAdmin[];
  pagination: PaginationInfo;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = '/api/admin';

  constructor(private http: HttpClient) {}

  // Student operations
  getStudents(page: number = 1, limit: number = 10, yearLevel?: number): Observable<PaginatedStudentsResponse> {
    const params: any = { page: page.toString(), limit: limit.toString() };
    if (yearLevel) {
      params.yearLevel = yearLevel.toString();
    }
    return this.http.get<PaginatedStudentsResponse>(`${this.apiUrl}/students`, { params });
  }

  getGraduatedStudents(page: number = 1, limit: number = 10): Observable<GraduatedStudentsResponse> {
    return this.http.get<GraduatedStudentsResponse>(`${this.apiUrl}/students/graduated`, {
      params: { page: page.toString(), limit: limit.toString() }
    });
  }

  searchStudents(query: string): Observable<Student[]> {
    return this.http.get<Student[]>(`${this.apiUrl}/students/search`, {
      params: { query }
    });
  }

  addStudent(student: Partial<Student>): Observable<any> {
    return this.http.post(`${this.apiUrl}/students`, student);
  }

  updateStudent(studentId: number, student: Partial<Student>): Observable<any> {
    return this.http.put(`${this.apiUrl}/students/${studentId}`, student);
  }

  deleteStudent(studentId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/students/${studentId}`);
  }

  deleteAllStudents(): Observable<any> {
    return this.http.delete(`${this.apiUrl}/students`);
  }

  deleteAllStudentsByYear(yearLevel: number | string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/students/year/${yearLevel}`);
  }

  promoteStudents(): Observable<any> {
    return this.http.post(`${this.apiUrl}/students/promote`, {});
  }

  promoteStudentsByYear(yearLevel: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/students/promote/${yearLevel}`, {});
  }

  // Teacher operations
  getTeachers(): Observable<Teacher[]> {
    return this.http.get<Teacher[]>(`${this.apiUrl}/teachers`);
  }

  searchTeachers(query: string): Observable<Teacher[]> {
    return this.http.get<Teacher[]>(`${this.apiUrl}/teachers/search`, {
      params: { query }
    });
  }

  addTeacher(teacher: Partial<Teacher>): Observable<any> {
    return this.http.post(`${this.apiUrl}/teachers`, teacher);
  }

  updateTeacher(teacherId: number, teacher: Partial<Teacher>): Observable<any> {
    return this.http.put(`${this.apiUrl}/teachers/${teacherId}`, teacher);
  }

  deleteTeacher(teacherId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/teachers/${teacherId}`);
  }

  // Activity operations
  getActivitiesAdmin(page: number = 1, limit: number = 10, teacherId?: number): Observable<PaginatedActivitiesResponse> {
    const params: any = { page: page.toString(), limit: limit.toString() };
    if (teacherId) {
      params.teacherId = teacherId.toString();
    }
    return this.http.get<PaginatedActivitiesResponse>(`${this.apiUrl}/activities`, { params });
  }

  searchActivities(query: string, page: number = 1, limit: number = 10, teacherId?: number): Observable<PaginatedActivitiesResponse> {
    const params: any = { query, page: page.toString(), limit: limit.toString() };
    if (teacherId) {
      params.teacherId = teacherId.toString();
    }
    return this.http.get<PaginatedActivitiesResponse>(`${this.apiUrl}/activities/search`, { params });
  }
}
