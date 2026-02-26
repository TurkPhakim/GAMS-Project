// User Profile Utility
const pool = require("../config/database");

const getUserProfile = async (userId, role) => {
  try {
    const connection = await pool.getConnection();
    let profile = {};

    if (role === "student") {
      const [students] = await connection.query(
        "SELECT s.*, u.status FROM students s JOIN users u ON s.userId = u.userId WHERE s.userId = ?",
        [userId],
      );
      if (students.length > 0) {
        profile = students[0];
      }
    } else if (role === "teacher") {
      const [teachers] = await connection.query(
        "SELECT t.*, u.status FROM teachers t JOIN users u ON t.userId = u.userId WHERE t.userId = ?",
        [userId],
      );
      if (teachers.length > 0) {
        profile = teachers[0];
      }
    }

    connection.release();
    return profile;
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
};

module.exports = {
  getUserProfile,
};
