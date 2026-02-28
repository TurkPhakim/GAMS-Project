# GAMS API Documentation

> Grade system reference ดู `README.md`

## Base URL

```
http://localhost:3000/api
```

## Headers

All requests (except login) must include:

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

---

## Authentication

### POST /auth/login

**Request:**

```json
{ "username": "64012345", "password": "1234567890125" }
```

**Response (200):**

```json
{ "token": "eyJ...", "role": "student", "userId": 4, "nickname": "Beam" }
```

- `nickname` is `null` for admin role
- `role`: `admin` | `teacher` | `student`

**Error responses:**

| Status | Condition | Message |
| ------ | --------- | ------- |
| 401 | Wrong credentials | `"Invalid credentials"` |
| 401 | User not in DB | `"User not found in system"` |
| 403 | Account inactive | `"บัญชีผู้ใช้นี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ"` |
| 500 | DB/server error | `"Server error"` |

---

## Admin Endpoints

All require `role: admin` in JWT.

### GET /admin/students

Students grouped by year level.

**Response:**

```json
{
  "1": [
    {
      "studentId": 64012345,
      "fullName": "Beam P.",
      "nickname": "Beam",
      "citizenId": "...",
      "yearLevel": 1,
      "entryYear": 2021,
      "status": "active"
    }
  ],
  "2": [],
  "3": [],
  "4": []
}
```

### GET /admin/students/graduated

Graduated students as flat array (same fields as above, `status: "graduated"`).

### GET /admin/students/search?query=beam

Search by studentId or fullName. Returns flat array with same student fields.

### POST /admin/students

**Request:**

```json
{
  "studentId": 64012348,
  "fullName": "Name",
  "nickname": "Nick",
  "citizenId": "...",
  "yearLevel": 1,
  "entryYear": 2024
}
```

**Response (201):** `{ "message": "Student added successfully", "userId": 10 }`

**Error (400):** `{ "message": "Student ID or Citizen ID already exists" }`

### DELETE /admin/students/:studentId

Delete specific student. **Response:** `{ "message": "Student deleted successfully" }`

### DELETE /admin/students

Delete ALL students. **Response:** `{ "message": "All students deleted" }`

### POST /admin/students/promote

Promote all: Year 1→2→3→4→Graduated. No request body.
**Response:** `{ "message": "Students promoted successfully" }`

### GET /admin/teachers

**Response:**

```json
[
  {
    "teacherId": 1,
    "userId": 2,
    "fullName": "Aj.Somchai",
    "nickname": "Aj.Somchai",
    "citizenId": "...",
    "email": "teacher1@email.com",
    "status": "active"
  }
]
```

### GET /admin/teachers/search?query=somchai

Search by email or fullName. Returns flat array with same teacher fields.

### POST /admin/teachers

**Request:**

```json
{
  "fullName": "New Teacher",
  "nickname": "Nick",
  "citizenId": "...",
  "email": "teacher@email.com"
}
```

**Response (201):** `{ "message": "Teacher added successfully", "userId": 11 }`

### DELETE /admin/teachers/:teacherId

**Response:** `{ "message": "Teacher deleted successfully" }`

---

## Teacher Endpoints

All require `role: teacher` in JWT.

### GET /teacher/activities

All activities (created by this teacher + assigned as grader). Supports pagination + search.

**Query params:** `page` (default: 1), `limit` (default: 10), `search` (activity title)

**Response:**

```json
{
  "data": [
    {
      "activityId": 1,
      "title": "Midterm Project",
      "description": "...",
      "startDate": "2024-03-01T00:00:00Z",
      "endDate": "2024-03-15T23:59:59Z",
      "targetYearLevels": "[1,2]",
      "criteriaCount": 2,
      "groupCount": 3,
      "isCreator": 1
    }
  ],
  "pagination": { "total": 15, "page": 1, "limit": 10, "totalPages": 2 }
}
```

### POST /teacher/activities

**Request:**

```json
{
  "title": "Midterm Project",
  "description": "Group presentation",
  "startDate": "2024-03-01T00:00:00Z",
  "endDate": "2024-03-15T23:59:59Z",
  "targetYearLevels": [1, 2],
  "criteria": [
    { "name": "Creativity", "maxScore": 100, "weight": 1.0 },
    { "name": "Teamwork", "maxScore": 100, "weight": 1.0 }
  ],
  "graders": [1, 2]
}
```

**Response (201):** `{ "message": "Activity created", "activityId": 1 }`

### GET /teacher/activities/:activityId

Activity details with criteria and graders.

### DELETE /teacher/activities/:activityId

Creator only. **Response:** `{ "message": "Activity deleted" }`

### GET /teacher/activities/:activityId/progress

Comprehensive progress data for the activity.

**Response:**

```json
{
  "activity": {
    "activityId": 1,
    "title": "...",
    "startDate": "...",
    "endDate": "..."
  },
  "criteria": [{ "criteriaId": 1, "name": "Creativity", "weight": 1.0 }],
  "totalGroups": 5,
  "totalGraders": 3,
  "gradersSubmitted": 2,
  "gradersDraft": 1,
  "graders": [
    {
      "teacherId": 1,
      "fullName": "Aj.Somchai",
      "status": "submitted",
      "submittedAt": "2024-03-10T14:30:00Z",
      "gradedGroupCount": 5,
      "totalGroupCount": 5
    }
  ],
  "groups": [
    {
      "groupId": 1,
      "groupName": "Team Alpha",
      "members": [
        { "studentId": 64012345, "fullName": "Beam P.", "nickname": "Beam" }
      ],
      "graderGrades": [
        {
          "teacherId": 1,
          "graderName": "Aj.Somchai",
          "grades": [
            { "criteriaId": 1, "criteriaName": "Creativity", "score": "A" }
          ],
          "comment": "Great work!"
        }
      ],
      "averageGpa": 3.75,
      "averageGrade": "A"
    }
  ]
}
```

- `averageGpa` / `averageGrade` = `null` if no grades yet
- 403 if not creator or assigned grader

### GET /teacher/activities/:activityId/grading

Grading data: criteria, groups, existing grades, submission status.

**Response:**

```json
{
  "activity": { "activityId": 1, "title": "..." },
  "criteria": [{ "criteriaId": 1, "name": "Creativity", "weight": 1.0 }],
  "groups": [{ "groupId": 1, "groupName": "Team Alpha", "members": [...] }],
  "existingGrades": [{ "groupId": 1, "criteriaId": 1, "score": "A" }],
  "existingComments": [{ "groupId": 1, "comment": "Good work!" }],
  "submissionStatus": "draft"
}
```

### POST /teacher/activities/:activityId/grades

Save grades as draft. Valid scores: `A`, `B+`, `B`, `C+`, `C`, `D+`, `D`, `F`

**Request:**

```json
{
  "grades": [
    { "groupId": 1, "criteriaId": 1, "score": "A" },
    { "groupId": 1, "criteriaId": 2, "score": "B+" }
  ],
  "comment": "Great teamwork!"
}
```

**Response:** `{ "message": "Grades saved" }`

### POST /teacher/activities/:activityId/submit

Lock grades and make visible to students.
**Response:** `{ "message": "Grades submitted for approval" }`

### GET /teacher/students

All active students grouped by year level (read-only).

**Response:**

```json
{
  "1": [
    {
      "studentId": 64012345,
      "fullName": "Beam P.",
      "nickname": "Beam",
      "yearLevel": 1,
      "status": "active"
    }
  ],
  "2": [],
  "3": [],
  "4": []
}
```

### GET /teacher/students/search?query=beam

Search by studentId, fullName, or nickname. Returns same grouped-by-year format.

---

## Student Endpoints

All require `role: student` in JWT.

### GET /student/activities

Available activities (filtered by student's year level).
Sorted: activities **without a group first**, then by `createdAt DESC`.

**Response:**

```json
[
  {
    "activityId": 1,
    "title": "Midterm Project",
    "description": "...",
    "startDate": "2024-03-01T00:00:00Z",
    "endDate": "2024-03-15T23:59:59Z",
    "teacherName": "Aj.Somchai",
    "criteriaCount": 2,
    "groupCount": 3,
    "myGroupId": null
  }
]
```

- `myGroupId`: group ID if student is already in a group for this activity, else `null`

### GET /student/students

Students list for group member selection (same year level).

**Response:**

```json
[
  {
    "studentId": 64012346,
    "fullName": "Nic N.",
    "nickname": "Nic",
    "yearLevel": 1
  }
]
```

### POST /student/groups

**Request:**

```json
{
  "activityId": 1,
  "groupName": "Team Alpha",
  "description": "Our project",
  "members": [64012345, 64012346]
}
```

**Response (201):** `{ "message": "Group created", "groupId": 1 }`

One student can belong to **only one group per activity**.

### GET /student/groups

All groups the student belongs to, with GPA scores.

**Response:**

```json
[
  {
    "groupId": 1,
    "activityId": 1,
    "groupName": "Team Alpha",
    "activityName": "Midterm Project",
    "description": "Our project",
    "members": [
      { "studentId": 64012345, "fullName": "Beam P.", "nickname": "Beam" }
    ],
    "averageScore": 3.5,
    "finalGrade": "A",
    "isCreator": true
  }
]
```

- `averageScore` / `finalGrade` = `null` if not yet graded (frontend shows "รอให้คะแนน")

### PUT /student/groups/:groupId

Creator only. Update name, description, or members.

**Request:** `{ "groupName": "Updated Name", "description": "...", "members": [64012345, 64012346] }`

**Response:** `{ "message": "Group updated" }`

### DELETE /student/groups/:groupId

Creator only. **Response:** `{ "message": "Group deleted" }`

### GET /student/dashboard

Dashboard overview for all activities.

**Response:**

```json
[
  {
    "activityId": 1,
    "activityName": "Midterm Project",
    "groupId": 1,
    "groupName": "Team Alpha",
    "status": "Graded",
    "score": 3.5,
    "finalGrade": "A",
    "criteriaScores": [
      {
        "criteriaId": 1,
        "name": "Creativity",
        "weight": 1,
        "averageScore": 3.5,
        "grade": "A"
      }
    ],
    "comments": [{ "comment": "Excellent work!", "teacherName": "Aj.Somchai" }]
  }
]
```

### GET /student/dashboard/:activityId

Detailed scores for a specific activity. Same structure as one item in the dashboard array above.

---

## Error Responses

| Status | Meaning                      | Response                                                   |
| ------ | ---------------------------- | ---------------------------------------------------------- |
| 401    | Not authenticated            | `{ "message": "No token provided" }`                       |
| 403    | Wrong role or not authorized | `{ "message": "Access denied: insufficient permissions" }` |
| 404    | Resource not found           | `{ "message": "Activity not found" }`                      |
| 500    | Server error                 | `{ "message": "Server error" }`                            |

---

## cURL Examples

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"p@ssw0rd"}'

# Get students (admin)
curl http://localhost:3000/api/admin/students \
  -H "Authorization: Bearer <token>"

# Save grades (teacher)
curl -X POST http://localhost:3000/api/teacher/activities/1/grades \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"grades":[{"groupId":1,"criteriaId":1,"score":"A"}],"comment":"Good work!"}'
```

---

## Notes

- Datetime fields use ISO 8601 format
- JWT tokens expire after 24 hours
- Only **submitted** grades are visible to students; draft grades are hidden
- `DECIMAL` values from MySQL are returned as strings by `mysql2` — `parseFloat()` applied where needed

Last Updated: February 25, 2026
