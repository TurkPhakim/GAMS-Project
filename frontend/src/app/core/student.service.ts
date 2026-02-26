import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StudentService {
  private apiUrl = '/api/student';

  constructor(private http: HttpClient) {}

  // Activities
  getActivities(): Observable<any> {
    return this.http.get(`${this.apiUrl}/activities`);
  }

  // Students (for group member selection)
  getAllStudents(activityId?: number): Observable<any> {
    if (activityId) {
      return this.http.get(`${this.apiUrl}/students`, { params: { activityId: activityId.toString() } });
    }
    return this.http.get(`${this.apiUrl}/students`);
  }

  // Groups
  getGroups(): Observable<any> {
    return this.http.get(`${this.apiUrl}/groups`);
  }

  createGroup(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/groups`, payload);
  }

  updateGroup(groupId: number, payload: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/groups/${groupId}`, payload);
  }

  deleteGroup(groupId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/groups/${groupId}`);
  }

  // Dashboard
  getDashboard(): Observable<any> {
    return this.http.get(`${this.apiUrl}/dashboard`);
  }

  getDashboardByActivity(activityId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/dashboard/${activityId}`);
  }
}
