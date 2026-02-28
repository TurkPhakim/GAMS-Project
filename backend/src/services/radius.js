const pool = require("../config/database");

const ADMIN_USERNAME = "Admin";
const ADMIN_PASSWORD = "p@ssw0rd";

const authenticateWithRADIUS = async (username, password) => {
  if (!username || !password) {
    return false;
  }

  if (username === ADMIN_USERNAME) {
    return password === ADMIN_PASSWORD;
  }

  try {
    const connection = await pool.getConnection();
    try {
      // Student: username = studentId, password = citizenId
      const [students] = await connection.query(
        'SELECT studentId FROM students WHERE studentId = ? AND citizenId = ? AND status != "graduated"',
        [username, password],
      );
      if (students.length > 0) return true;

      // Teacher: username = email, password = citizenId
      const [teachers] = await connection.query(
        "SELECT teacherId FROM teachers WHERE email = ? AND citizenId = ?",
        [username, password],
      );
      if (teachers.length > 0) return true;

      return false;
    } finally {
      connection.release();
    }
  } catch (dbError) {
    console.error("Database error during authentication:", dbError.message);
    return false;
  }
};

module.exports = {
  authenticateWithRADIUS,
};
