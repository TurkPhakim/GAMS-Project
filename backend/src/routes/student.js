// Student Routes
const express = require("express");
const router = express.Router();
const studentController = require("../controllers/student");
const authMiddleware = require("../middleware/auth");
const requireRole = require("../middleware/rbac");

// All student routes require authentication and student role
router.use(authMiddleware, requireRole("student"));

// Activities
router.get("/activities", studentController.getAvailableActivities);

// Students list (for group member selection)
router.get("/students", studentController.getAvailableStudents);

// Groups
router.post("/groups", studentController.createGroup);
router.get("/groups", studentController.getStudentGroups);
router.put("/groups/:groupId", studentController.updateGroup);
router.delete("/groups/:groupId", studentController.deleteGroup);

// Dashboard
router.get("/dashboard", studentController.getDashboardAll);
router.get("/dashboard/:activityId", studentController.getDashboardScores);

module.exports = router;
