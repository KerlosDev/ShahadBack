const express = require("express");
const router = express.Router();
const {
    createPackageEnrollment,
    getUserPackageEnrollments,
    checkStudentPackageEnrollment,
    checkStudentCourseAccess,
    getAllPackageEnrollments,
    updatePackageEnrollmentStatus,
    createAdminPackageEnrollment
} = require("../services/packageEnrollmentService");
const { protect, isAdmin } = require("../services/authService");

// User routes
router.post("/", protect, createPackageEnrollment);
router.get("/user", protect, getUserPackageEnrollments);
router.get("/check/:packageId", protect, checkStudentPackageEnrollment);
router.get("/course-access/:courseId", protect, checkStudentCourseAccess);

// Admin routes
router.get("/admin", protect, isAdmin, getAllPackageEnrollments);
router.put("/admin/:id", protect, isAdmin, updatePackageEnrollmentStatus);
router.post("/admin", protect, isAdmin, createAdminPackageEnrollment);

module.exports = router;
