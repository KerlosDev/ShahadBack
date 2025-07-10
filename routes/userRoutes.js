const express = require('express');
const { validationResult } = require('express-validator');
const { protect, isAdmin } = require('../services/authService');
const {
    getUserByIdService,
    updateUserbyId,
    getAllStudents,
    toggleBanStatus,
    updateLastActive,
    getUserAllDataById
} = require('../services/userServise');
const WatchHistory = require('../modules/WatchHistory');
const Enrollment = require('../modules/enrollmentModel');
const User = require('../modules/userModule');

const router = express.Router();

// Protected routes (require authentication)
router.use(protect);

// Admin route to get all students' status
router.get('/all-students-status', isAdmin, async (req, res) => {
    try {
        // Get all users that are students (not admins)
        const students = await User.find()
            .select('name phoneNumber parentPhoneNumber email')
            .lean();

        if (!students || students.length === 0) {
            return res.json({
                success: true,
                count: 0,
                data: []
            });
        }

        const studentsStatus = await Promise.all(students.map(async (student) => {
            // Check enrollments for paid courses
            const enrollments = await Enrollment.find({
                studentId: student._id,
            }).populate('courseId', 'name') || [];

            // Check watch history
            const watchHistory = await WatchHistory.find({ studentId: student._id }) || [];

            // Get enrolled course names
            const enrolledCourses = enrollments.map(enrollment => ({
                courseName: enrollment.courseId ? enrollment.courseId.name : 'Unknown Course',
                enrollmentDate: enrollment.createdAt,
                paymentStatus: enrollment.paymentStatus
            }));

            // Determine status based on both enrollment and watch history
            let status = 'not enrolled';
            if (enrollments && enrollments.length > 0) {
                const hasPaidEnrollments = enrollments.some(e => e.paymentStatus === 'paid');
                if (hasPaidEnrollments) {
                    status = watchHistory && watchHistory.length > 0 ? 'active' : 'inactive';
                }
            }

            return {
                studentInfo: {
                    id: student._id,
                    name: student.name,
                    email: student.email,
                    phoneNumber: student.phoneNumber || 'Not provided',
                    parentPhoneNumber: student.parentPhoneNumber || 'Not provided'
                },
                enrollmentStatus: {
                    isEnrolled: enrollments.length > 0,
                    enrolledCourses: enrolledCourses,
                    totalEnrollments: enrollments.length
                },
                activityStatus: {
                    status: status,
                    lastActivity: watchHistory.length > 0 ?
                        watchHistory.sort((a, b) => b.lastWatchedAt - a.lastWatchedAt)[0].lastWatchedAt :
                        null,
                    totalWatchedLessons: watchHistory.length
                }
            };
        }));

        return res.json({
            success: true,
            count: studentsStatus.length,
            data: studentsStatus
        });

    } catch (error) {
        console.error('Error in all-students-status:', error);
        res.status(500).json({
            success: false,
            message: "Error fetching students status",
            error: error.message
        });
    }
});
 

// Regular user routes
router.get('/', getUserByIdService);
router.put('/update', updateUserbyId);
router.put('/last-active', updateLastActive);

// Admin only routes
router.use('/students', isAdmin);
router.get('/students', getAllStudents);
router.put('/students/:studentId/ban', toggleBanStatus);

// Get all data for user by ID (admin only)
router.get('/:id/all-data', isAdmin, getUserAllDataById);

module.exports = router;
