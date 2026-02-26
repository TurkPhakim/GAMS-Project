// Teacher Controller
const pool = require("../config/database");

// Helper: resolve teacherId from userId
const getTeacherIdFromUserId = async (connection, userId) => {
  const [rows] = await connection.query(
    "SELECT teacherId FROM teachers WHERE userId = ?",
    [userId],
  );
  return rows.length > 0 ? rows[0].teacherId : null;
};

// Get all teachers (for grader selection)
const getAllTeachers = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [teachers] = await connection.query(
      'SELECT teacherId, fullName, nickname, email FROM teachers WHERE status = "active" ORDER BY fullName',
    );
    connection.release();
    res.json(teachers);
  } catch (error) {
    console.error("Error getting teachers:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Create activity
const createActivity = async (req, res) => {
  try {
    const { title, description, startDate, endDate, criteria, graders, targetYearLevels } =
      req.body;

    if (!title || !startDate || !endDate || !Array.isArray(criteria)) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const connection = await pool.getConnection();

    // Resolve teacherId from userId
    const teacherId = await getTeacherIdFromUserId(
      connection,
      req.user.userId,
    );
    if (!teacherId) {
      connection.release();
      return res.status(403).json({ message: "Teacher profile not found" });
    }

    // Create activity
    const yearLevels = Array.isArray(targetYearLevels) && targetYearLevels.length > 0
      ? JSON.stringify(targetYearLevels)
      : '[1,2,3,4]';

    const [activityResult] = await connection.query(
      "INSERT INTO activities (createdByTeacherId, title, description, startDate, endDate, targetYearLevels) VALUES (?, ?, ?, ?, ?, ?)",
      [teacherId, title, description || "", startDate, endDate, yearLevels],
    );

    const activityId = activityResult.insertId;

    // Add criteria (name only, maxScore/weight use defaults)
    for (const criterion of criteria) {
      await connection.query(
        "INSERT INTO criteria (activityId, name, maxScore, weight) VALUES (?, ?, ?, ?)",
        [activityId, criterion.name, criterion.maxScore || 0, criterion.weight || 1.0],
      );
    }

    // Add graders (these are teacherIds)
    if (Array.isArray(graders) && graders.length > 0) {
      for (const graderId of graders) {
        await connection.query(
          "INSERT INTO activity_graders (activityId, teacherId) VALUES (?, ?)",
          [activityId, graderId],
        );
      }
    }

    // Add grading status for creator + all graders
    const graderSet = new Set([teacherId, ...(graders || [])]);
    for (const gId of graderSet) {
      await connection.query(
        'INSERT INTO grader_submission_status (activityId, teacherId, status) VALUES (?, ?, "draft")',
        [activityId, gId],
      );
    }

    connection.release();
    res.status(201).json({ message: "Activity created", activityId });
  } catch (error) {
    console.error("Error creating activity:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get teacher's activities (with criteria count and group count) - paginated
const getActivities = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const teacherId = await getTeacherIdFromUserId(
      connection,
      req.user.userId,
    );
    if (!teacherId) {
      connection.release();
      return res.json({ data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 0 } });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    let whereClause = "(a.createdByTeacherId = ? OR ag.teacherId = ?)";
    const whereParams = [teacherId, teacherId];

    if (search.trim()) {
      whereClause += " AND a.title LIKE ?";
      whereParams.push(`%${search.trim()}%`);
    }

    // Count total
    const [countResult] = await connection.query(
      `SELECT COUNT(DISTINCT a.activityId) as total
       FROM activities a
       LEFT JOIN activity_graders ag ON a.activityId = ag.activityId
       WHERE ${whereClause}`,
      whereParams,
    );
    const total = countResult[0].total;

    // Fetch page
    const [activities] = await connection.query(
      `SELECT DISTINCT a.*,
        (SELECT COUNT(*) FROM criteria c WHERE c.activityId = a.activityId) AS criteriaCount,
        (SELECT COUNT(*) FROM \`groups\` g WHERE g.activityId = a.activityId) AS groupCount,
        (a.createdByTeacherId = ?) AS isCreator
       FROM activities a
       LEFT JOIN activity_graders ag ON a.activityId = ag.activityId
       WHERE ${whereClause}
       ORDER BY a.createdAt DESC
       LIMIT ? OFFSET ?`,
      [teacherId, ...whereParams, limit, offset],
    );
    connection.release();

    res.json({
      data: activities,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (error) {
    console.error("Error getting activities:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get activity details with criteria
const getActivityDetails = async (req, res) => {
  try {
    const { activityId } = req.params;
    const connection = await pool.getConnection();

    const [activity] = await connection.query(
      "SELECT * FROM activities WHERE activityId = ?",
      [activityId],
    );

    if (activity.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Activity not found" });
    }

    const [criteria] = await connection.query(
      "SELECT * FROM criteria WHERE activityId = ?",
      [activityId],
    );

    const [graders] = await connection.query(
      "SELECT t.*, ag.activityGraderId FROM activity_graders ag JOIN teachers t ON ag.teacherId = t.teacherId WHERE ag.activityId = ?",
      [activityId],
    );

    connection.release();

    res.json({
      ...activity[0],
      criteria,
      graders,
    });
  } catch (error) {
    console.error("Error getting activity details:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Submit grades (letter grades)
const submitGrades = async (req, res) => {
  try {
    const { activityId } = req.params;
    const { grades, comment } = req.body;

    if (!activityId || !Array.isArray(grades)) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const connection = await pool.getConnection();

    const teacherId = await getTeacherIdFromUserId(
      connection,
      req.user.userId,
    );
    if (!teacherId) {
      connection.release();
      return res.status(403).json({ message: "Teacher profile not found" });
    }

    // Insert/Update grades (score is now a letter grade string)
    for (const grade of grades) {
      const { groupId, criteriaId, score } = grade;
      await connection.query(
        `INSERT INTO grades (activityId, groupId, teacherId, criteriaId, score)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE score = VALUES(score)`,
        [activityId, groupId, teacherId, criteriaId, score],
      );
    }

    // Insert/Update comment
    if (comment !== undefined && grades.length > 0) {
      await connection.query(
        `INSERT INTO grader_comments (activityId, groupId, teacherId, comment)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE comment = VALUES(comment)`,
        [activityId, grades[0].groupId, teacherId, comment || ""],
      );
    }

    connection.release();
    res.json({ message: "Grades saved" });
  } catch (error) {
    console.error("Error submitting grades:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Submit grades for approval
const submitGradesForApproval = async (req, res) => {
  try {
    const { activityId } = req.params;

    const connection = await pool.getConnection();

    const teacherId = await getTeacherIdFromUserId(
      connection,
      req.user.userId,
    );
    if (!teacherId) {
      connection.release();
      return res.status(403).json({ message: "Teacher profile not found" });
    }

    await connection.query(
      'UPDATE grader_submission_status SET status = "submitted", submittedAt = NOW() WHERE activityId = ? AND teacherId = ?',
      [activityId, teacherId],
    );
    connection.release();

    res.json({ message: "Grades submitted for approval" });
  } catch (error) {
    console.error("Error submitting for approval:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get groups for an activity (with member details)
const getActivityGroups = async (req, res) => {
  try {
    const { activityId } = req.params;
    const connection = await pool.getConnection();

    const [groups] = await connection.query(
      `SELECT g.*, COUNT(gm.groupMemberId) as memberCount
       FROM \`groups\` g
       LEFT JOIN group_members gm ON g.groupId = gm.groupId
       WHERE g.activityId = ?
       GROUP BY g.groupId`,
      [activityId],
    );

    // Get members for each group
    for (const group of groups) {
      const [members] = await connection.query(
        `SELECT gm.groupMemberId, s.studentId, s.fullName, s.nickname
         FROM group_members gm
         JOIN students s ON gm.studentId = s.studentId
         WHERE gm.groupId = ?`,
        [group.groupId],
      );
      group.members = members;
    }

    connection.release();
    res.json(groups);
  } catch (error) {
    console.error("Error getting groups:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete activity
const deleteActivity = async (req, res) => {
  try {
    const { activityId } = req.params;
    const connection = await pool.getConnection();

    const teacherId = await getTeacherIdFromUserId(
      connection,
      req.user.userId,
    );
    if (!teacherId) {
      connection.release();
      return res.status(403).json({ message: "Teacher profile not found" });
    }

    const [activity] = await connection.query(
      "SELECT * FROM activities WHERE activityId = ? AND createdByTeacherId = ?",
      [activityId, teacherId],
    );

    if (activity.length === 0) {
      connection.release();
      return res
        .status(404)
        .json({ message: "Activity not found or not authorized" });
    }

    await connection.query("DELETE FROM activities WHERE activityId = ?", [
      activityId,
    ]);
    connection.release();
    res.json({ message: "Activity deleted" });
  } catch (error) {
    console.error("Error deleting activity:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get grading data (activity details + criteria + groups with members + existing grades)
const getGradingData = async (req, res) => {
  try {
    const { activityId } = req.params;
    const connection = await pool.getConnection();

    const teacherId = await getTeacherIdFromUserId(
      connection,
      req.user.userId,
    );
    if (!teacherId) {
      connection.release();
      return res.status(403).json({ message: "Teacher profile not found" });
    }

    // Get activity
    const [activity] = await connection.query(
      "SELECT * FROM activities WHERE activityId = ?",
      [activityId],
    );
    if (activity.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Activity not found" });
    }

    // Get criteria
    const [criteria] = await connection.query(
      "SELECT * FROM criteria WHERE activityId = ? ORDER BY criteriaId",
      [activityId],
    );

    // Get groups with members
    const [groups] = await connection.query(
      `SELECT g.* FROM \`groups\` g WHERE g.activityId = ?`,
      [activityId],
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

    // Get existing grades for this teacher
    const [grades] = await connection.query(
      `SELECT * FROM grades WHERE activityId = ? AND teacherId = ?`,
      [activityId, teacherId],
    );

    // Get existing comments for this teacher
    const [comments] = await connection.query(
      `SELECT * FROM grader_comments WHERE activityId = ? AND teacherId = ?`,
      [activityId, teacherId],
    );

    // Get submission status
    const [statusRows] = await connection.query(
      `SELECT * FROM grader_submission_status WHERE activityId = ? AND teacherId = ?`,
      [activityId, teacherId],
    );

    connection.release();

    res.json({
      activity: activity[0],
      criteria,
      groups,
      existingGrades: grades,
      existingComments: comments,
      submissionStatus:
        statusRows.length > 0 ? statusRows[0].status : "draft",
    });
  } catch (error) {
    console.error("Error getting grading data:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all students grouped by year level with pagination (read-only for teachers)
const getStudents = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const yearLevel = parseInt(req.query.yearLevel) || null;

    const connection = await pool.getConnection();

    let whereClause = 'WHERE status != "graduated"';
    const params = [];
    if (yearLevel) {
      whereClause += " AND yearLevel = ?";
      params.push(yearLevel);
    }

    // Count per year level
    const [countRows] = await connection.query(
      `SELECT yearLevel, COUNT(*) as count FROM students ${whereClause} GROUP BY yearLevel ORDER BY yearLevel`,
      params,
    );

    const offset = (page - 1) * limit;
    const [students] = await connection.query(
      `SELECT * FROM (
        SELECT studentId, fullName, nickname, yearLevel, status,
               ROW_NUMBER() OVER (PARTITION BY yearLevel ORDER BY studentId) as row_num
        FROM students ${whereClause}
      ) ranked
      WHERE row_num > ? AND row_num <= ?
      ORDER BY yearLevel, studentId`,
      [...params, offset, offset + limit],
    );
    connection.release();

    const grouped = {};
    students.forEach((student) => {
      const { row_num, ...studentData } = student;
      if (!grouped[student.yearLevel]) grouped[student.yearLevel] = [];
      grouped[student.yearLevel].push(studentData);
    });

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
    console.error("Error getting students for teacher:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Search students (read-only for teachers)
const searchStudents = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ message: "Search query required" });
    }

    const connection = await pool.getConnection();
    const [students] = await connection.query(
      'SELECT studentId, fullName, nickname, yearLevel, status FROM students WHERE (studentId LIKE ? OR fullName LIKE ? OR nickname LIKE ?) AND status != "graduated" ORDER BY yearLevel, studentId',
      [`%${query}%`, `%${query}%`, `%${query}%`],
    );
    connection.release();

    // Group by year level
    const grouped = {};
    students.forEach((student) => {
      if (!grouped[student.yearLevel]) {
        grouped[student.yearLevel] = [];
      }
      grouped[student.yearLevel].push(student);
    });

    res.json(grouped);
  } catch (error) {
    console.error("Error searching students for teacher:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get activity progress (comprehensive dashboard data)
const getActivityProgress = async (req, res) => {
  try {
    const { activityId } = req.params;
    const connection = await pool.getConnection();

    const teacherId = await getTeacherIdFromUserId(connection, req.user.userId);
    if (!teacherId) {
      connection.release();
      return res.status(403).json({ message: "Teacher profile not found" });
    }

    // Check authorization (must be creator or grader)
    const [authCheck] = await connection.query(
      `SELECT DISTINCT a.activityId FROM activities a
       LEFT JOIN activity_graders ag ON a.activityId = ag.activityId
       WHERE a.activityId = ? AND (a.createdByTeacherId = ? OR ag.teacherId = ?)`,
      [activityId, teacherId, teacherId],
    );
    if (authCheck.length === 0) {
      connection.release();
      return res.status(403).json({ message: "Not authorized" });
    }

    // 1. Activity info
    const [activityRows] = await connection.query(
      "SELECT * FROM activities WHERE activityId = ?",
      [activityId],
    );
    if (activityRows.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Activity not found" });
    }
    const activity = activityRows[0];

    // 2. Criteria
    const [criteria] = await connection.query(
      "SELECT criteriaId, name, maxScore, weight FROM criteria WHERE activityId = ? ORDER BY criteriaId",
      [activityId],
    );

    // 3. Groups with members
    const [groups] = await connection.query(
      `SELECT g.groupId, g.groupName, g.description, COUNT(gm.groupMemberId) as memberCount
       FROM \`groups\` g
       LEFT JOIN group_members gm ON g.groupId = gm.groupId
       WHERE g.activityId = ?
       GROUP BY g.groupId`,
      [activityId],
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

    // 4. All graders (creator + assigned)
    const [graders] = await connection.query(
      `SELECT DISTINCT t.teacherId, t.fullName, t.nickname, t.email
       FROM teachers t
       WHERE t.teacherId = ?
       UNION
       SELECT DISTINCT t.teacherId, t.fullName, t.nickname, t.email
       FROM activity_graders ag
       JOIN teachers t ON ag.teacherId = t.teacherId
       WHERE ag.activityId = ?`,
      [activity.createdByTeacherId, activityId],
    );

    // 5. Submission statuses
    const [statuses] = await connection.query(
      "SELECT * FROM grader_submission_status WHERE activityId = ?",
      [activityId],
    );
    const statusMap = {};
    statuses.forEach((s) => {
      statusMap[s.teacherId] = { status: s.status, submittedAt: s.submittedAt };
    });

    // 6. All grades for this activity
    const [allGrades] = await connection.query(
      "SELECT * FROM grades WHERE activityId = ?",
      [activityId],
    );

    // 7. All comments
    const [allComments] = await connection.query(
      "SELECT * FROM grader_comments WHERE activityId = ?",
      [activityId],
    );

    // 8. Grading scale
    const [gradingScale] = await connection.query(
      "SELECT grade, gpa FROM grading_scale ORDER BY gpa DESC",
    );
    const gpaMap = {};
    gradingScale.forEach((row) => {
      gpaMap[row.grade] = parseFloat(row.gpa);
    });

    connection.release();

    // Build lookup maps
    // gradesLookup[groupId][teacherId][criteriaId] = score
    const gradesLookup = {};
    allGrades.forEach((g) => {
      if (!gradesLookup[g.groupId]) gradesLookup[g.groupId] = {};
      if (!gradesLookup[g.groupId][g.teacherId]) gradesLookup[g.groupId][g.teacherId] = {};
      gradesLookup[g.groupId][g.teacherId][g.criteriaId] = g.score;
    });

    // commentsLookup[groupId][teacherId] = comment
    const commentsLookup = {};
    allComments.forEach((c) => {
      if (!commentsLookup[c.groupId]) commentsLookup[c.groupId] = {};
      commentsLookup[c.groupId][c.teacherId] = c.comment;
    });

    // Build graders data
    let gradersSubmitted = 0;
    let gradersDraft = 0;
    const gradersData = graders.map((grader) => {
      const st = statusMap[grader.teacherId] || { status: "draft", submittedAt: null };
      if (st.status === "submitted") gradersSubmitted++;
      else gradersDraft++;

      // Count how many groups this grader has graded (at least one criterion)
      let gradedGroupCount = 0;
      groups.forEach((group) => {
        const graderGrades = gradesLookup[group.groupId]?.[grader.teacherId];
        if (graderGrades && Object.values(graderGrades).some((s) => s && s !== "")) {
          gradedGroupCount++;
        }
      });

      return {
        teacherId: grader.teacherId,
        fullName: grader.fullName,
        nickname: grader.nickname,
        email: grader.email,
        status: st.status,
        submittedAt: st.submittedAt,
        gradedGroupCount,
        totalGroupCount: groups.length,
      };
    });

    // Build groups data with per-group grades
    const groupsData = groups.map((group) => {
      const graderGrades = graders.map((grader) => {
        const grades = criteria.map((c) => ({
          criteriaId: c.criteriaId,
          criteriaName: c.name,
          score: gradesLookup[group.groupId]?.[grader.teacherId]?.[c.criteriaId] || null,
        }));
        return {
          teacherId: grader.teacherId,
          graderName: grader.fullName,
          grades,
          comment: commentsLookup[group.groupId]?.[grader.teacherId] || null,
        };
      });

      // Calculate average GPA across all graders and criteria
      const allScores = [];
      graders.forEach((grader) => {
        criteria.forEach((c) => {
          const score = gradesLookup[group.groupId]?.[grader.teacherId]?.[c.criteriaId];
          if (score && gpaMap[score] !== undefined) {
            allScores.push(gpaMap[score]);
          }
        });
      });

      let averageGpa = null;
      let averageGrade = null;
      if (allScores.length > 0) {
        averageGpa = parseFloat((allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2));
        // Find closest letter grade
        let closestGrade = null;
        let closestDiff = Infinity;
        gradingScale.forEach((row) => {
          const diff = Math.abs(parseFloat(row.gpa) - averageGpa);
          if (diff < closestDiff) {
            closestDiff = diff;
            closestGrade = row.grade;
          }
        });
        averageGrade = closestGrade;
      }

      return {
        groupId: group.groupId,
        groupName: group.groupName,
        description: group.description,
        memberCount: group.memberCount,
        members: group.members,
        graderGrades,
        averageGpa,
        averageGrade,
      };
    });

    res.json({
      activity: {
        activityId: activity.activityId,
        title: activity.title,
        description: activity.description,
        startDate: activity.startDate,
        endDate: activity.endDate,
        createdAt: activity.createdAt,
      },
      criteria,
      totalGroups: groups.length,
      totalGraders: graders.length,
      gradersSubmitted,
      gradersDraft,
      graders: gradersData,
      groups: groupsData,
      gradingScale: gpaMap,
    });
  } catch (error) {
    console.error("Error getting activity progress:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getAllTeachers,
  createActivity,
  getActivities,
  getActivityDetails,
  submitGrades,
  submitGradesForApproval,
  getActivityGroups,
  deleteActivity,
  getGradingData,
  getActivityProgress,
  getStudents,
  searchStudents,
};
