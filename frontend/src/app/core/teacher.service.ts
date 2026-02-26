import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TeacherService {
  private apiUrl = '/api/teacher';

  constructor(private http: HttpClient) {}

  // Teachers list (for grader selection)
  getAllTeachers(): Observable<any> {
    return this.http.get(`${this.apiUrl}/teachers`);
  }

  // Activities
  getActivities(page: number = 1, limit: number = 10, search: string = ''): Observable<any> {
    const params: any = { page: page.toString(), limit: limit.toString() };
    if (search.trim()) {
      params.search = search.trim();
    }
    return this.http.get(`${this.apiUrl}/activities`, { params });
  }

  getActivityProgress(activityId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/activities/${activityId}/progress`);
  }

  createActivity(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/activities`, payload);
  }

  deleteActivity(activityId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/activities/${activityId}`);
  }

  getActivityDetails(activityId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/activities/${activityId}`);
  }

  // Groups for an activity
  getActivityGroups(activityId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/activities/${activityId}/groups`);
  }

  // Grading
  getGradingData(activityId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/activities/${activityId}/grading`);
  }

  submitGrades(activityId: number, grades: any[], comment?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/activities/${activityId}/grades`, { grades, comment });
  }

  submitForApproval(activityId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/activities/${activityId}/submit`, {});
  }

  // Students (read-only view)
  getStudents(page: number = 1, limit: number = 10): Observable<any> {
    return this.http.get(`${this.apiUrl}/students`, {
      params: { page: page.toString(), limit: limit.toString() }
    });
  }

  searchStudents(query: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/students/search`, { params: { query } });
  }
}
