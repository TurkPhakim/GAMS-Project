// Teacher Routes
const express = require("express");
const router = express.Router();
const teacherController = require("../controllers/teacher");
const authMiddleware = require("../middleware/auth");
const requireRole = require("../middleware/rbac");

// All teacher routes require authentication and teacher role
router.use(authMiddleware, requireRole("teacher"));

// Teachers list (for grader selection)
router.get("/teachers", teacherController.getAllTeachers);

// Students list (read-only view)
router.get("/students", teacherController.getStudents);
router.get("/students/search", teacherController.searchStudents);

// Activity management
router.post("/activities", teacherController.createActivity);
router.get("/activities", teacherController.getActivities);
router.get("/activities/:activityId", teacherController.getActivityDetails);
router.delete("/activities/:activityId", teacherController.deleteActivity);
router.get(
  "/activities/:activityId/groups",
  teacherController.getActivityGroups,
);

// Activity progress dashboard
router.get("/activities/:activityId/progress", teacherController.getActivityProgress);

// Grading
router.get("/activities/:activityId/grading", teacherController.getGradingData);
router.post("/activities/:activityId/grades", teacherController.submitGrades);
router.post(
  "/activities/:activityId/submit",
  teacherController.submitGradesForApproval,
);

module.exports = router;
