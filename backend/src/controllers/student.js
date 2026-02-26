// Student Controller
const pool = require("../config/database");

// Helper: resolve userId (from JWT) to studentId (from students table)
const resolveStudentId = async (connection, userId) => {
  const [rows] = await connection.query(
    "SELECT studentId FROM students WHERE userId = ?",
    [userId],
  );
  return rows.length > 0 ? rows[0].studentId : null;
};

// Convert letter grade to GPA points (Thai education system)
// A=4.00, B+=3.50, B=3.00, C+=2.50, C=2.00, D+=1.50, D=1.00, F=0.00
const letterGradeToScore = (grade) => {
  if (grade === null || grade === undefined) return null;
  const str = String(grade).trim().toUpperCase();
  const map = {
    'A': 4.00, 'B+': 3.50, 'B': 3.00,
    'C+': 2.50, 'C': 2.00, 'D+': 1.50, 'D': 1.00, 'F': 0.00
  };
  const score = map[str];
  return score !== undefined ? score : null;
};

// Convert GPA to letter grade (Thai education system)
const getGrade = (gpa) => {
  const val = parseFloat(gpa);
  if (isNaN(val)) return "F";
  if (val >= 3.75) return "A";
  if (val >= 3.25) return "B+";
  if (val >= 2.75) return "B";
  if (val >= 2.25) return "C+";
  if (val >= 1.75) return "C";
  if (val >= 1.25) return "D+";
  if (val >= 0.50) return "D";
  return "F";
};

// Create group
const createGroup = async (req, res) => {
  try {
    const { activityId, groupName, description, members } = req.body;

    if (
      !activityId ||
      !groupName ||
      !Array.isArray(members) ||
      members.length === 0
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const connection = await pool.getConnection();

    // Resolve userId to studentId
    const studentId = await resolveStudentId(connection, req.user.userId);
    if (!studentId) {
      connection.release();
      return res.status(404).json({ message: "Student profile not found" });
    }

    // Check if student already in a group for this activity
    const [existingGroup] = await connection.query(
      `SELECT g.groupId FROM \`groups\` g
       JOIN group_members gm ON g.groupId = gm.groupId
       WHERE g.activityId = ? AND gm.studentId = ?`,
      [activityId, studentId],
    );

    if (existingGroup.length > 0) {
      connection.release();
      return res
        .status(400)
        .json({ message: "Student already in a group for this activity" });
    }

    // Check if any member is already in another group for this activity
    const allMembers = [...new Set([...members, studentId])];
    if (allMembers.length > 1) {
      const placeholders = allMembers.map(() => "?").join(",");
      const [duplicateMembers] = await connection.query(
        `SELECT gm.studentId, s.fullName FROM group_members gm
         JOIN \`groups\` g ON gm.groupId = g.groupId
         JOIN students s ON gm.studentId = s.studentId
         WHERE g.activityId = ? AND gm.studentId IN (${placeholders})`,
        [activityId, ...allMembers],
      );
      if (duplicateMembers.length > 0) {
        const names = duplicateMembers.map((d) => d.fullName).join(", ");
        connection.release();
        return res.status(400).json({
          message: `สมาชิกเหล่านี้อยู่ในกลุ่มอื่นแล้ว: ${names}`,
        });
      }
    }

    // Create group
    const [groupResult] = await connection.query(
      "INSERT INTO `groups` (activityId, groupName, description, createdByStudentId) VALUES (?, ?, ?, ?)",
      [activityId, groupName, description || "", studentId],
    );

    const groupId = groupResult.insertId;

    // Add members
    for (const memberId of allMembers) {
      await connection.query(
        "INSERT INTO group_members (groupId, studentId) VALUES (?, ?)",
        [groupId, memberId],
      );
    }

    connection.release();
    res.status(201).json({ message: "Group created", groupId });
  } catch (error) {
    console.error("Error creating group:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update group (only creator can update)
const updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { groupName, description, members } = req.body;

    if (!groupName || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const connection = await pool.getConnection();

    const studentId = await resolveStudentId(connection, req.user.userId);
    if (!studentId) {
      connection.release();
      return res.status(404).json({ message: "Student profile not found" });
    }

    const [group] = await connection.query(
      "SELECT * FROM `groups` WHERE groupId = ? AND createdByStudentId = ?",
      [groupId, studentId],
    );

    if (group.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Group not found or not authorized" });
    }

    await connection.beginTransaction();

    try {
      await connection.query(
        "UPDATE `groups` SET groupName = ?, description = ? WHERE groupId = ?",
        [groupName, description || "", groupId],
      );

      await connection.query(
        "DELETE FROM group_members WHERE groupId = ?",
        [groupId],
      );

      const allMembers = [...new Set([...members, studentId])];

      for (const memberId of allMembers) {
        await connection.query(
          "INSERT INTO group_members (groupId, studentId) VALUES (?, ?)",
          [groupId, memberId],
        );
      }

      await connection.commit();
      connection.release();
      res.json({ message: "Group updated" });
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (error) {
    console.error("Error updating group:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get student's groups (with members and activity info)
const getStudentGroups = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const studentId = await resolveStudentId(connection, req.user.userId);
    if (!studentId) {
      connection.release();
      return res.status(404).json({ message: "Student profile not found" });
    }

    const [groups] = await connection.query(
      `SELECT DISTINCT g.*, a.title AS activityName
       FROM \`groups\` g
       JOIN group_members gm ON g.groupId = gm.groupId
       JOIN activities a ON g.activityId = a.activityId
       WHERE gm.studentId = ?
       ORDER BY g.createdAt DESC`,
      [studentId],
    );

    // Get members + average score for each group + mark creator
    for (const group of groups) {
      const [members] = await connection.query(
        `SELECT s.studentId, s.fullName, s.nickname
         FROM group_members gm
         JOIN students s ON gm.studentId = s.studentId
         WHERE gm.groupId = ?`,
        [group.groupId],
      );
      group.members = members;
      group.isCreator = group.createdByStudentId === studentId;

      // Calculate average score for this group
      const [criteria] = await connection.query(
        "SELECT criteriaId, weight FROM criteria WHERE activityId = ?",
        [group.activityId],
      );

      const [grades] = await connection.query(
        `SELECT g.criteriaId, g.score
         FROM grades g
         JOIN grader_submission_status gss ON g.activityId = gss.activityId AND g.teacherId = gss.teacherId
         WHERE g.activityId = ? AND g.groupId = ? AND gss.status = 'submitted'`,
        [group.activityId, group.groupId],
      );

      if (grades.length > 0 && criteria.length > 0) {
        let totalWeightedScore = 0;
        let totalWeight = 0;

        criteria.forEach((c) => {
          const criteriaGrades = grades.filter((g) => g.criteriaId === c.criteriaId);
          const numericScores = criteriaGrades
            .map((g) => letterGradeToScore(g.score))
            .filter((s) => s !== null);

          if (numericScores.length > 0) {
            const avgScore = numericScores.reduce((sum, s) => sum + s, 0) / numericScores.length;
            const w = parseFloat(c.weight) || 1;
            totalWeightedScore += avgScore * w;
            totalWeight += w;
          }
        });

        if (totalWeight > 0) {
          group.averageScore = parseFloat((totalWeightedScore / totalWeight).toFixed(2));
          group.finalGrade = getGrade(group.averageScore);
        } else {
          group.averageScore = null;
          group.finalGrade = null;
        }
      } else {
        group.averageScore = null;
        group.finalGrade = null;
      }
    }

    connection.release();
    res.json(groups);
  } catch (error) {
    console.error("Error getting groups:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get dashboard scores (single activity detail)
const getDashboardScores = async (req, res) => {
  try {
    const { activityId } = req.params;
    const connection = await pool.getConnection();

    const studentId = await resolveStudentId(connection, req.user.userId);
    if (!studentId) {
      connection.release();
      return res.status(404).json({ message: "Student profile not found" });
    }

    // Get student's group for this activity
    const [groups] = await connection.query(
      `SELECT g.groupId FROM \`groups\` g
       JOIN group_members gm ON g.groupId = gm.groupId
       WHERE g.activityId = ? AND gm.studentId = ?`,
      [activityId, studentId],
    );

    if (groups.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Group not found" });
    }

    const groupId = groups[0].groupId;

    // Get criteria
    const [criteria] = await connection.query(
      "SELECT * FROM criteria WHERE activityId = ? ORDER BY criteriaId",
      [activityId],
    );

    // Get submitted grades from all teachers
    const [grades] = await connection.query(
      `SELECT g.*, gss.status FROM grades g
       JOIN grader_submission_status gss ON g.activityId = gss.activityId AND g.teacherId = gss.teacherId
       WHERE g.activityId = ? AND g.groupId = ? AND gss.status = "submitted"
       ORDER BY g.criteriaId, g.teacherId`,
      [activityId, groupId],
    );

    // Get comments from submitted graders (with teacher name)
    const [comments] = await connection.query(
      `SELECT gc.commentId, gc.activityId, gc.groupId, gc.teacherId, gc.comment,
              t.fullName AS teacherName, gss.status
       FROM grader_comments gc
       JOIN grader_submission_status gss ON gc.activityId = gss.activityId AND gc.teacherId = gss.teacherId
       JOIN teachers t ON gc.teacherId = t.teacherId
       WHERE gc.activityId = ? AND gc.groupId = ? AND gss.status = "submitted"`,
      [activityId, groupId],
    );

    // Aggregate scores per criterion
    const scoresByCriteria = {};
    criteria.forEach((c) => {
      scoresByCriteria[c.criteriaId] = {
        criteriaId: c.criteriaId,
        name: c.name,
        maxScore: c.maxScore,
        weight: c.weight,
        scores: [],
      };
    });

    grades.forEach((g) => {
      if (scoresByCriteria[g.criteriaId]) {
        scoresByCriteria[g.criteriaId].scores.push(g.score);
      }
    });

    // Calculate average per criterion
    const dashboard = {
      activityId,
      groupId,
      criteriaScores: [],
      overallScore: 0,
      finalGrade: "",
    };

    let totalWeightedScore = 0;
    let totalMaxScore = 0;

    Object.values(scoresByCriteria).forEach((crit) => {
      if (crit.scores.length > 0) {
        const numericScores = crit.scores
          .map((s) => letterGradeToScore(s))
          .filter((s) => s !== null);
        if (numericScores.length > 0) {
          const avgScore =
            numericScores.reduce((a, b) => a + b, 0) / numericScores.length;
          const critWeight = parseFloat(crit.weight) || 1;
          dashboard.criteriaScores.push({
            ...crit,
            maxScore: 4.00,
            weight: critWeight,
            averageScore: avgScore.toFixed(2),
            grade: getGrade(avgScore),
          });

          totalWeightedScore += avgScore * critWeight;
          totalMaxScore += critWeight;
        }
      }
    });

    if (totalMaxScore > 0) {
      dashboard.overallScore = (totalWeightedScore / totalMaxScore).toFixed(2);
      dashboard.finalGrade = getGrade(dashboard.overallScore);
    }

    dashboard.comments = comments;

    connection.release();
    res.json(dashboard);
  } catch (error) {
    console.error("Error getting dashboard:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get available activities for students
const getAvailableActivities = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const studentId = await resolveStudentId(connection, req.user.userId);
    if (!studentId) {
      connection.release();
      return res.status(404).json({ message: "Student profile not found" });
    }

    // Get student's yearLevel for filtering
    const [studentRows] = await connection.query(
      "SELECT yearLevel FROM students WHERE studentId = ?",
      [studentId],
    );
    const yearLevel = studentRows.length > 0 ? studentRows[0].yearLevel : null;

    const [activities] = await connection.query(
      `SELECT a.*,
        t.fullName AS teacherName,
        (SELECT COUNT(*) FROM criteria c WHERE c.activityId = a.activityId) AS criteriaCount,
        (SELECT COUNT(*) FROM \`groups\` g WHERE g.activityId = a.activityId) AS groupCount,
        (SELECT g2.groupId FROM \`groups\` g2
         JOIN group_members gm ON g2.groupId = gm.groupId
         WHERE g2.activityId = a.activityId AND gm.studentId = ?
         LIMIT 1) AS myGroupId
       FROM activities a
       JOIN teachers t ON a.createdByTeacherId = t.teacherId
       WHERE (a.targetYearLevels IS NULL OR JSON_CONTAINS(a.targetYearLevels, CAST(? AS JSON)))
       ORDER BY
         CASE WHEN (SELECT g3.groupId FROM \`groups\` g3
                     JOIN group_members gm3 ON g3.groupId = gm3.groupId
                     WHERE g3.activityId = a.activityId AND gm3.studentId = ?
                     LIMIT 1) IS NULL THEN 0 ELSE 1 END ASC,
         a.createdAt DESC`,
      [studentId, yearLevel, studentId],
    );

    connection.release();
    res.json(activities);
  } catch (error) {
    console.error("Error getting activities:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get available students for group creation
// Query params: activityId (optional) - filters out students already in a group for this activity
//               and filters by targetYearLevels if the activity specifies them
const getAvailableStudents = async (req, res) => {
  try {
    const { activityId } = req.query;
    const connection = await pool.getConnection();

    const currentStudentId = await resolveStudentId(connection, req.user.userId);

    if (activityId) {
      // Get activity's targetYearLevels
      const [activityRows] = await connection.query(
        "SELECT targetYearLevels FROM activities WHERE activityId = ?",
        [activityId],
      );

      let yearLevelFilter = "";
      let params = [activityId, currentStudentId || -1];

      if (
        activityRows.length > 0 &&
        activityRows[0].targetYearLevels &&
        activityRows[0].targetYearLevels.length > 0
      ) {
        const yearLevels = activityRows[0].targetYearLevels;
        const placeholders = yearLevels.map(() => "?").join(",");
        yearLevelFilter = `AND s.yearLevel IN (${placeholders})`;
        params = [activityId, currentStudentId || -1, ...yearLevels];
      }

      // Get students excluding those already in a group for this activity
      const [students] = await connection.query(
        `SELECT s.studentId, s.fullName, s.nickname, s.yearLevel
         FROM students s
         WHERE s.status = 'active'
           AND s.studentId != ?
           AND s.studentId NOT IN (
             SELECT gm.studentId FROM group_members gm
             JOIN \`groups\` g ON gm.groupId = g.groupId
             WHERE g.activityId = ?
           )
           ${yearLevelFilter}
         ORDER BY s.studentId`,
        [currentStudentId || -1, activityId, ...(params.slice(2))],
      );

      connection.release();
      res.json(students);
    } else {
      // No activity specified - return all active students
      const [students] = await connection.query(
        `SELECT s.studentId, s.fullName, s.nickname, s.yearLevel
         FROM students s
         WHERE s.status = 'active' AND s.studentId != ?
         ORDER BY s.studentId`,
        [currentStudentId || -1],
      );
      connection.release();
      res.json(students);
    }
  } catch (error) {
    console.error("Error getting students:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete group (only creator can delete)
const deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const connection = await pool.getConnection();

    const studentId = await resolveStudentId(connection, req.user.userId);
    if (!studentId) {
      connection.release();
      return res.status(404).json({ message: "Student profile not found" });
    }

    const [group] = await connection.query(
      "SELECT * FROM `groups` WHERE groupId = ? AND createdByStudentId = ?",
      [groupId, studentId],
    );

    if (group.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Group not found or not authorized" });
    }

    await connection.query("DELETE FROM `groups` WHERE groupId = ?", [groupId]);
    connection.release();
    res.json({ message: "Group deleted" });
  } catch (error) {
    console.error("Error deleting group:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get dashboard overview (all activities)
const getDashboardAll = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const studentId = await resolveStudentId(connection, req.user.userId);
    if (!studentId) {
      connection.release();
      return res.status(404).json({ message: "Student profile not found" });
    }

    // Get all groups this student is in
    const [myGroups] = await connection.query(
      `SELECT g.groupId, g.groupName, g.activityId, a.title AS activityName
       FROM \`groups\` g
       JOIN group_members gm ON g.groupId = gm.groupId
       JOIN activities a ON g.activityId = a.activityId
       WHERE gm.studentId = ?
       ORDER BY a.startDate DESC`,
      [studentId],
    );

    const results = [];

    for (const group of myGroups) {
      // Get criteria for this activity
      const [criteria] = await connection.query(
        "SELECT * FROM criteria WHERE activityId = ? ORDER BY criteriaId",
        [group.activityId],
      );

      // Get submitted grades for this group
      const [grades] = await connection.query(
        `SELECT g.criteriaId, g.score, g.teacherId
         FROM grades g
         JOIN grader_submission_status gss ON g.activityId = gss.activityId AND g.teacherId = gss.teacherId
         WHERE g.activityId = ? AND g.groupId = ? AND gss.status = 'submitted'`,
        [group.activityId, group.groupId],
      );

      // Get comments
      const [comments] = await connection.query(
        `SELECT gc.comment, t.fullName AS teacherName
         FROM grader_comments gc
         JOIN teachers t ON gc.teacherId = t.teacherId
         JOIN grader_submission_status gss ON gc.activityId = gss.activityId AND gc.teacherId = gss.teacherId
         WHERE gc.activityId = ? AND gc.groupId = ? AND gss.status = 'submitted'`,
        [group.activityId, group.groupId],
      );

      // Calculate scores per criteria (letter grades -> numeric -> average -> letter grade)
      const criteriaScores = criteria.map((c) => {
        const criteriaGrades = grades.filter((g) => g.criteriaId === c.criteriaId);
        const numericScores = criteriaGrades
          .map((g) => letterGradeToScore(g.score))
          .filter((s) => s !== null);
        const avgScore = numericScores.length > 0
          ? numericScores.reduce((sum, s) => sum + s, 0) / numericScores.length
          : null;
        return {
          criteriaId: c.criteriaId,
          name: c.name,
          maxScore: 4.00,
          weight: parseFloat(c.weight) || 1,
          averageScore: avgScore !== null ? parseFloat(avgScore.toFixed(2)) : null,
          grade: avgScore !== null ? getGrade(avgScore) : null,
        };
      });

      // Calculate overall
      let totalWeightedScore = 0;
      let totalWeight = 0;
      let hasGrades = false;

      criteriaScores.forEach((cs) => {
        if (cs.averageScore !== null) {
          hasGrades = true;
          totalWeightedScore += cs.averageScore * cs.weight;
          totalWeight += cs.weight;
        }
      });

      const overallScore = hasGrades && totalWeight > 0
        ? parseFloat((totalWeightedScore / totalWeight).toFixed(2))
        : null;

      results.push({
        activityId: group.activityId,
        activityName: group.activityName,
        groupId: group.groupId,
        groupName: group.groupName,
        status: hasGrades ? "Graded" : "Pending",
        score: overallScore,
        finalGrade: overallScore !== null ? getGrade(overallScore) : null,
        criteriaScores,
        comments,
      });
    }

    connection.release();
    res.json(results);
  } catch (error) {
    console.error("Error getting dashboard:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createGroup,
  updateGroup,
  getStudentGroups,
  getDashboardScores,
  getAvailableActivities,
  getAvailableStudents,
  deleteGroup,
  getDashboardAll,
};
