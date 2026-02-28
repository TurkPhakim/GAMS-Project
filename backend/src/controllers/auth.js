// Authentication Controller
const { authenticateWithRADIUS } = require("../services/radius");
const { generateToken } = require("../config/jwt");
const pool = require("../config/database");

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username and password required" });
    }

    // Authenticate credentials (checks DB for students/teachers, hardcoded for admin)
    const isValid = await authenticateWithRADIUS(username, password);

    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Get user from database
    let user = null;
    try {
      const connection = await pool.getConnection();
      try {
        const [users] = await connection.query(
          "SELECT userId, username, role, status FROM users WHERE username = ?",
          [username],
        );
        if (users.length > 0) {
          user = users[0];
        }
      } finally {
        connection.release();
      }
    } catch (dbError) {
      console.error("Database error during login:", dbError.message);
      return res.status(500).json({ message: "Server error" });
    }

    if (!user) {
      return res.status(401).json({ message: "User not found in system" });
    }

    if (user.status !== "active") {
      return res.status(403).json({ message: "บัญชีผู้ใช้นี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" });
    }

    // Fetch nickname from students/teachers table
    let nickname = null;
    try {
      const connection = await pool.getConnection();
      try {
        if (user.role === "student") {
          const [rows] = await connection.query(
            "SELECT nickname FROM students WHERE userId = ?",
            [user.userId],
          );
          if (rows.length > 0) nickname = rows[0].nickname;
        } else if (user.role === "teacher") {
          const [rows] = await connection.query(
            "SELECT nickname FROM teachers WHERE userId = ?",
            [user.userId],
          );
          if (rows.length > 0) nickname = rows[0].nickname;
        }
      } finally {
        connection.release();
      }
    } catch (nickErr) {
      console.error("Error fetching nickname:", nickErr.message);
    }

    // Generate JWT
    const token = generateToken({
      userId: user.userId,
      username: user.username,
      role: user.role,
    });

    res.json({ token, role: user.role, userId: user.userId, nickname });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  login,
};
