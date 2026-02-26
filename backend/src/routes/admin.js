// Admin Routes
const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin");
const authMiddleware = require("../middleware/auth");
const requireRole = require("../middleware/rbac");

// All admin routes require authentication and admin role
router.use(authMiddleware, requireRole("admin"));

// Student management
router.get("/students", adminController.getStudents);
router.get("/students/graduated", adminController.getGraduatedStudents);
router.get("/students/search", adminController.searchStudents);
router.post("/students", adminController.addStudent);
router.post("/students/promote/:yearLevel", adminController.promoteStudentsByYear);
router.post("/students/promote", adminController.promoteStudents);
router.delete("/students/year/:yearLevel", adminController.deleteAllStudentsByYear);
router.delete("/students", adminController.deleteAllStudents);
router.put("/students/:studentId", adminController.updateStudent);
router.delete("/students/:studentId", adminController.deleteStudent);

// Teacher management
router.get("/teachers", adminController.getTeachers);
router.get("/teachers/search", adminController.searchTeachers);
router.post("/teachers", adminController.addTeacher);
router.put("/teachers/:teacherId", adminController.updateTeacher);
router.delete("/teachers/:teacherId", adminController.deleteTeacher);

// Activity management (read-only for admin)
router.get("/activities/search", adminController.searchActivities);
router.get("/activities", adminController.getActivitiesAdmin);

module.exports = router;
