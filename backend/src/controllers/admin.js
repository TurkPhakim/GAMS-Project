// Admin Controller
const pool = require("../config/database");

// Get all students grouped by year (with pagination per year level)
const getStudents = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const yearLevel = parseInt(req.query.yearLevel) || null;

    const connection = await pool.getConnection();

    // Build WHERE clause
    let whereClause = 'WHERE status != "graduated"';
    const params = [];
    if (yearLevel) {
      whereClause += " AND yearLevel = ?";
      params.push(yearLevel);
    }

    // Get total count per year level
    const [countRows] = await connection.query(
      `SELECT yearLevel, COUNT(*) as count FROM students ${whereClause} GROUP BY yearLevel ORDER BY yearLevel`,
      params,
    );

    // Get paginated students per year level using window function approach
    const offset = (page - 1) * limit;
    const [students] = await connection.query(
      `SELECT * FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY yearLevel ORDER BY studentId) as row_num
        FROM students ${whereClause}
      ) ranked
      WHERE row_num > ? AND row_num <= ?
      ORDER BY yearLevel, studentId`,
      [...params, offset, offset + limit],
    );
    connection.release();

    // Group by year level
    const grouped = {};
    students.forEach((student) => {
      const { row_num, ...studentData } = student;
      if (!grouped[student.yearLevel]) {
        grouped[student.yearLevel] = [];
      }
      grouped[student.yearLevel].push(studentData);
    });

    // Build pagination info per year level
    const pagination = {};
    countRows.forEach((row) => {
      pagination[row.yearLevel] = {
        total: row.count,
        page,
        limit,
        totalPages: Math.ceil(row.count / limit),
      };
    });

    res.json({ data: grouped, pagination });
  } catch (error) {
    console.error("Error getting students:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get graduated students (with pagination)
const getGraduatedStudents = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    const connection = await pool.getConnection();

    const [countResult] = await connection.query(
      'SELECT COUNT(*) as total FROM students WHERE status = "graduated"',
    );
    const total = countResult[0].total;

    const [students] = await connection.query(
      'SELECT * FROM students WHERE status = "graduated" ORDER BY studentId LIMIT ? OFFSET ?',
      [limit, offset],
    );
    connection.release();

    res.json({
      data: students,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error getting graduated students:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Search students
const searchStudents = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ message: "Search query required" });
    }

    const connection = await pool.getConnection();
    const [students] = await connection.query(
      "SELECT * FROM students WHERE studentId LIKE ? OR fullName LIKE ? ORDER BY studentId",
      [`%${query}%`, `%${query}%`],
    );
    connection.release();
    res.json(students);
  } catch (error) {
    console.error("Error searching students:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Add student
const addStudent = async (req, res) => {
  try {
    const { studentId, fullName, nickname, citizenId, yearLevel, entryYear, status } =
      req.body;

    if (!studentId || !fullName || !citizenId || !yearLevel || !entryYear) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const studentStatus = status || "active";
    const connection = await pool.getConnection();

    // Create user account
    const [userResult] = await connection.query(
      "INSERT INTO users (username, role, status) VALUES (?, 'student', ?)",
      [studentId, studentStatus],
    );

    const userId = userResult.insertId;

    // Create student record
    await connection.query(
      "INSERT INTO students (studentId, userId, fullName, nickname, citizenId, yearLevel, entryYear, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [studentId, userId, fullName, nickname || "", citizenId, yearLevel, entryYear, studentStatus],
    );

    connection.release();
    res.status(201).json({ message: "Student added successfully", userId });
  } catch (error) {
    console.error("Error adding student:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res
        .status(400)
        .json({ message: "Student ID or Citizen ID already exists" });
    }
    res.status(500).json({ message: "Server error" });
  }
};

// Update student
const updateStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { fullName, nickname, citizenId, yearLevel, entryYear, status } = req.body;

    if (!fullName || !citizenId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const connection = await pool.getConnection();

    const [existing] = await connection.query(
      "SELECT userId FROM students WHERE studentId = ?",
      [studentId],
    );

    if (existing.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Student not found" });
    }

    await connection.query(
      "UPDATE students SET fullName = ?, nickname = ?, citizenId = ?, yearLevel = ?, entryYear = ?, status = ? WHERE studentId = ?",
      [fullName, nickname || "", citizenId, yearLevel, entryYear, status || "active", studentId],
    );

    // Sync user status
    if (status) {
      await connection.query("UPDATE users SET status = ? WHERE userId = ?", [
        status,
        existing[0].userId,
      ]);
    }

    connection.release();
    res.json({ message: "Student updated successfully" });
  } catch (error) {
    console.error("Error updating student:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "Citizen ID already exists" });
    }
    res.status(500).json({ message: "Server error" });
  }
};

// Delete student
const deleteStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    const connection = await pool.getConnection();
    const [student] = await connection.query(
      "SELECT userId FROM students WHERE studentId = ?",
      [studentId],
    );

    if (student.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Student not found" });
    }

    await connection.query("DELETE FROM users WHERE userId = ?", [
      student[0].userId,
    ]);
    connection.release();
    res.json({ message: "Student deleted successfully" });
  } catch (error) {
    console.error("Error deleting student:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete all students
const deleteAllStudents = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query('DELETE FROM users WHERE role = "student"');
    connection.release();
    res.json({ message: "All students deleted" });
  } catch (error) {
    console.error("Error deleting all students:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete all students by year level
const deleteAllStudentsByYear = async (req, res) => {
  try {
    const { yearLevel } = req.params;
    const connection = await pool.getConnection();

    let students;
    if (yearLevel === "graduated") {
      [students] = await connection.query(
        'SELECT userId FROM students WHERE status = "graduated"',
      );
    } else {
      const year = parseInt(yearLevel);
      if (year < 1 || year > 4) {
        connection.release();
        return res.status(400).json({ message: "Invalid year level" });
      }
      [students] = await connection.query(
        'SELECT userId FROM students WHERE yearLevel = ? AND status != "graduated"',
        [year],
      );
    }

    if (students.length > 0) {
      const userIds = students.map((s) => s.userId);
      await connection.query("DELETE FROM users WHERE userId IN (?)", [userIds]);
    }

    connection.release();
    res.json({ message: "Students deleted successfully" });
  } catch (error) {
    console.error("Error deleting students by year:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Promote all students
const promoteStudents = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    await connection.query(
      'UPDATE students SET yearLevel = 2 WHERE yearLevel = 1 AND status = "active"',
    );
    await connection.query(
      'UPDATE students SET yearLevel = 3 WHERE yearLevel = 2 AND status = "active"',
    );
    await connection.query(
      'UPDATE students SET yearLevel = 4 WHERE yearLevel = 3 AND status = "active"',
    );
    await connection.query(
      'UPDATE students SET status = "graduated" WHERE yearLevel = 4 AND status = "active"',
    );

    connection.release();
    res.json({ message: "Students promoted successfully" });
  } catch (error) {
    console.error("Error promoting students:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Promote students by specific year level
const promoteStudentsByYear = async (req, res) => {
  try {
    const { yearLevel } = req.params;
    const year = parseInt(yearLevel);

    if (year < 1 || year > 4) {
      return res.status(400).json({ message: "Invalid year level" });
    }

    const connection = await pool.getConnection();

    if (year === 4) {
      await connection.query(
        'UPDATE students SET status = "graduated" WHERE yearLevel = 4 AND status = "active"',
      );
    } else {
      await connection.query(
        'UPDATE students SET yearLevel = ? WHERE yearLevel = ? AND status = "active"',
        [year + 1, year],
      );
    }

    connection.release();
    res.json({ message: `Year ${year} students promoted successfully` });
  } catch (error) {
    console.error("Error promoting students by year:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all teachers
const getTeachers = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [teachers] = await connection.query(
      "SELECT * FROM teachers ORDER BY email",
    );
    connection.release();
    res.json(teachers);
  } catch (error) {
    console.error("Error getting teachers:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Search teachers
const searchTeachers = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ message: "Search query required" });
    }

    const connection = await pool.getConnection();
    const [teachers] = await connection.query(
      "SELECT * FROM teachers WHERE email LIKE ? OR fullName LIKE ? ORDER BY email",
      [`%${query}%`, `%${query}%`],
    );
    connection.release();
    res.json(teachers);
  } catch (error) {
    console.error("Error searching teachers:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Add teacher
const addTeacher = async (req, res) => {
  try {
    const { fullName, nickname, citizenId, email, status } = req.body;

    if (!fullName || !citizenId || !email) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const teacherStatus = status || "active";
    const connection = await pool.getConnection();

    // Create user account
    const [userResult] = await connection.query(
      "INSERT INTO users (username, role, status) VALUES (?, 'teacher', ?)",
      [email, teacherStatus],
    );

    const userId = userResult.insertId;

    // Create teacher record
    await connection.query(
      "INSERT INTO teachers (userId, fullName, nickname, citizenId, email, status) VALUES (?, ?, ?, ?, ?, ?)",
      [userId, fullName, nickname || "", citizenId, email, teacherStatus],
    );

    connection.release();
    res.status(201).json({ message: "Teacher added successfully", userId });
  } catch (error) {
    console.error("Error adding teacher:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res
        .status(400)
        .json({ message: "Email or Citizen ID already exists" });
    }
    res.status(500).json({ message: "Server error" });
  }
};

// Update teacher
const updateTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { fullName, nickname, citizenId, email, status } = req.body;

    if (!fullName || !citizenId || !email) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const connection = await pool.getConnection();

    const [existing] = await connection.query(
      "SELECT userId FROM teachers WHERE teacherId = ?",
      [teacherId],
    );

    if (existing.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Teacher not found" });
    }

    await connection.query(
      "UPDATE teachers SET fullName = ?, nickname = ?, citizenId = ?, email = ?, status = ? WHERE teacherId = ?",
      [fullName, nickname || "", citizenId, email, status || "active", teacherId],
    );

    // Sync user username and status
    await connection.query(
      "UPDATE users SET username = ?, status = ? WHERE userId = ?",
      [email, status || "active", existing[0].userId],
    );

    connection.release();
    res.json({ message: "Teacher updated successfully" });
  } catch (error) {
    console.error("Error updating teacher:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "Email or Citizen ID already exists" });
    }
    res.status(500).json({ message: "Server error" });
  }
};

// Delete teacher
const deleteTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;

    const connection = await pool.getConnection();
    const [teacher] = await connection.query(
      "SELECT userId FROM teachers WHERE teacherId = ?",
      [teacherId],
    );

    if (teacher.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Teacher not found" });
    }

    await connection.query("DELETE FROM users WHERE userId = ?", [
      teacher[0].userId,
    ]);
    connection.release();
    res.json({ message: "Teacher deleted successfully" });
  } catch (error) {
    console.error("Error deleting teacher:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Helper: load activity details (criteria, graders, groups with members)
const loadActivityDetails = async (connection, activities) => {
  for (const activity of activities) {
    const [criteria] = await connection.query(
      "SELECT * FROM criteria WHERE activityId = ?",
      [activity.activityId],
    );
    activity.criteria = criteria;

    const [graders] = await connection.query(
      `SELECT t.teacherId, t.fullName, t.email
       FROM activity_graders ag
       JOIN teachers t ON ag.teacherId = t.teacherId
       WHERE ag.activityId = ?`,
      [activity.activityId],
    );
    activity.graders = graders;

    const [groups] = await connection.query(
      "SELECT * FROM `groups` WHERE activityId = ?",
      [activity.activityId],
    );
    for (const group of groups) {
      const [members] = await connection.query(
        `SELECT s.studentId, s.fullName, s.nickname
         FROM group_members gm
         JOIN students s ON gm.studentId = s.studentId
         WHERE gm.groupId = ?`,
        [group.groupId],
      );
      group.members = members;
    }
    activity.groups = groups;
  }
};

// Search activities by title only
const searchActivities = async (req, res) => {
  try {
    const { query, teacherId } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    const connection = await pool.getConnection();

    let whereClause = "WHERE 1=1";
    const params = [];

    if (query && query.trim()) {
      whereClause += " AND a.title LIKE ?";
      params.push(`%${query}%`);
    }
    if (teacherId) {
      whereClause += " AND a.createdByTeacherId = ?";
      params.push(parseInt(teacherId));
    }

    const [countResult] = await connection.query(
      `SELECT COUNT(*) as total FROM activities a ${whereClause}`,
      params,
    );
    const total = countResult[0].total;

    const [activities] = await connection.query(
      `SELECT a.*, t.fullName as teacherName, t.email as teacherEmail
       FROM activities a
       JOIN teachers t ON a.createdByTeacherId = t.teacherId
       ${whereClause}
       ORDER BY a.updatedAt DESC, a.createdAt DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    await loadActivityDetails(connection, activities);

    connection.release();
    res.json({
      data: activities,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error searching activities:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all activities for admin (with pagination)
const getActivitiesAdmin = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;
    const teacherId = req.query.teacherId ? parseInt(req.query.teacherId) : null;

    const connection = await pool.getConnection();

    let whereClause = "";
    const params = [];
    if (teacherId) {
      whereClause = "WHERE a.createdByTeacherId = ?";
      params.push(teacherId);
    }

    const [countResult] = await connection.query(
      `SELECT COUNT(*) as total FROM activities a ${whereClause}`,
      params,
    );
    const total = countResult[0].total;

    const [activities] = await connection.query(
      `SELECT a.*, t.fullName as teacherName, t.email as teacherEmail
       FROM activities a
       JOIN teachers t ON a.createdByTeacherId = t.teacherId
       ${whereClause}
       ORDER BY a.updatedAt DESC, a.createdAt DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    await loadActivityDetails(connection, activities);

    connection.release();
    res.json({
      data: activities,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error getting activities for admin:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getStudents,
  getGraduatedStudents,
  searchStudents,
  addStudent,
  updateStudent,
  deleteStudent,
  deleteAllStudents,
  deleteAllStudentsByYear,
  promoteStudents,
  promoteStudentsByYear,
  getTeachers,
  searchTeachers,
  addTeacher,
  updateTeacher,
  deleteTeacher,
  getActivitiesAdmin,
  searchActivities,
};
