const express = require("express");
const router = express.Router();
const {
    getCourseAnalytics,
    getCourseDetailedAnalytics,
    getEnrollmentStatsByDateRange
} = require("../services/courseAnalyticsService");
const { isAdmin, protect } = require("../services/authService");

// Get comprehensive course analytics (Admin only)
router.get("/analytics", protect, isAdmin, getCourseAnalytics);

// Get detailed analytics for a specific course (Admin only)
router.get("/analytics/:courseId", protect, isAdmin, getCourseDetailedAnalytics);

// Get enrollment statistics by date range (Admin only)
router.get("/enrollment-stats", protect, isAdmin, getEnrollmentStatsByDateRange);

module.exports = router;
