const expressAsyncHandler = require("express-async-handler");
const Course = require("../modules/courseModule");
const Enrollment = require("../modules/enrollmentModel");
const StudentExamResult = require("../modules/examResultSchema");
const User = require("../modules/userModule");

// Get comprehensive course analytics
const getCourseAnalytics = async (req, res) => {
    try {
        // Get all courses with enrollment counts
        const courses = await Course.aggregate([
            {
                $lookup: {
                    from: "enrollments",
                    localField: "_id",
                    foreignField: "courseId",
                    as: "enrollments"
                }
            },
            {
                $addFields: {
                    totalEnrollments: { $size: "$enrollments" },
                    paidEnrollments: {
                        $size: {
                            $filter: {
                                input: "$enrollments",
                                cond: { $eq: ["$$this.paymentStatus", "paid"] }
                            }
                        }
                    },
                    pendingEnrollments: {
                        $size: {
                            $filter: {
                                input: "$enrollments",
                                cond: { $eq: ["$$this.paymentStatus", "pending"] }
                            }
                        }
                    },
                    revenue: {
                        $sum: {
                            $map: {
                                input: {
                                    $filter: {
                                        input: "$enrollments",
                                        cond: { $eq: ["$$this.paymentStatus", "paid"] }
                                    }
                                },
                                in: "$$this.price"
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    name: 1,
                    description: 1,
                    price: 1,
                    isFree: 1,
                    level: 1,
                    imageUrl: 1,
                    createdAt: 1,
                    totalEnrollments: 1,
                    paidEnrollments: 1,
                    pendingEnrollments: 1,
                    revenue: 1
                }
            },
            { $sort: { totalEnrollments: -1 } }
        ]);

        // Get enrollment trends over time
        const enrollmentTrends = await Enrollment.aggregate([
            {
                $group: {
                    _id: {
                        year: { $year: "$enrolledAt" },
                        month: { $month: "$enrolledAt" },
                        day: { $dayOfMonth: "$enrolledAt" }
                    },
                    count: { $sum: 1 },
                    revenue: {
                        $sum: {
                            $cond: [
                                { $eq: ["$paymentStatus", "paid"] },
                                "$price",
                                0
                            ]
                        }
                    }
                }
            },
            {
                $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 }
            },
            {
                $limit: 30 // Last 30 days
            }
        ]);

        // Get top performing courses by completion rate
        // Since we don't have direct course-exam relationships, we'll calculate completion based on enrollments
        const courseCompletion = await Course.aggregate([
            {
                $lookup: {
                    from: "enrollments",
                    localField: "_id",
                    foreignField: "courseId",
                    as: "enrollments"
                }
            },
            {
                $addFields: {
                    enrollmentCount: { $size: "$enrollments" },
                    paidEnrollments: {
                        $size: {
                            $filter: {
                                input: "$enrollments",
                                cond: { $eq: ["$$this.paymentStatus", "paid"] }
                            }
                        }
                    },
                    // Calculate completion rate as percentage of paid enrollments
                    completionRate: {
                        $cond: [
                            { $gt: [{ $size: "$enrollments" }, 0] },
                            {
                                $multiply: [
                                    {
                                        $divide: [
                                            {
                                                $size: {
                                                    $filter: {
                                                        input: "$enrollments",
                                                        cond: { $eq: ["$$this.paymentStatus", "paid"] }
                                                    }
                                                }
                                            },
                                            { $size: "$enrollments" }
                                        ]
                                    },
                                    100
                                ]
                            },
                            0
                        ]
                    }
                }
            },
            {
                $project: {
                    name: 1,
                    enrollmentCount: 1,
                    paidEnrollments: 1,
                    completionRate: 1
                }
            },
            { $sort: { completionRate: -1 } }
        ]);

        // Get student performance analytics
        const studentPerformance = await StudentExamResult.aggregate([
            {
                $unwind: "$results"
            },
            {
                $group: {
                    _id: "$results.examTitle",
                    averageScore: {
                        $avg: {
                            $multiply: [
                                { $divide: ["$results.correctAnswers", "$results.totalQuestions"] },
                                100
                            ]
                        }
                    },
                    totalAttempts: { $sum: 1 },
                    uniqueStudents: { $addToSet: "$studentId" }
                }
            },
            {
                $addFields: {
                    uniqueStudentCount: { $size: "$uniqueStudents" }
                }
            },
            {
                $project: {
                    examTitle: "$_id",
                    averageScore: { $round: ["$averageScore", 2] },
                    totalAttempts: 1,
                    uniqueStudentCount: 1
                }
            },
            { $sort: { averageScore: -1 } }
        ]);

        // Get general statistics
        const totalCourses = await Course.countDocuments();
        const totalEnrollments = await Enrollment.countDocuments();
        const totalRevenue = await Enrollment.aggregate([
            {
                $match: { paymentStatus: "paid" }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$price" }
                }
            }
        ]);

        const totalStudents = await User.countDocuments({ role: "student" });

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    totalCourses,
                    totalEnrollments,
                    totalRevenue: totalRevenue[0]?.total || 0,
                    totalStudents
                },
                courses,
                enrollmentTrends,
                courseCompletion,
                studentPerformance
            }
        });

    } catch (error) {
        console.error("Course Analytics Error:", error);
        res.status(500).json({
            success: false,
            message: "خطأ في جلب تحليل الكورسات",
            error: error.message
        });
    }
};

// Get specific course detailed analytics
const getCourseDetailedAnalytics = async (req, res) => {
    try {
        const { courseId } = req.params;

        // Get course details with enrollments
        const course = await Course.findById(courseId).populate({
            path: 'enrollments',
            populate: {
                path: 'studentId',
                select: 'name email'
            }
        });

        if (!course) {
            return res.status(404).json({
                success: false,
                message: "الكورس غير موجود"
            });
        }

        // Get enrollments for this course
        const enrollments = await Enrollment.find({ courseId })
            .populate('studentId', 'name email createdAt')
            .sort({ enrolledAt: -1 });

        // Get exam results for this course's exams
        const examResults = await StudentExamResult.aggregate([
            {
                $unwind: "$results"
            },
            {
                $lookup: {
                    from: "users",
                    localField: "studentId",
                    foreignField: "_id",
                    as: "student"
                }
            },
            {
                $unwind: "$student"
            },
            {
                $project: {
                    studentName: "$student.name",
                    studentEmail: "$student.email",
                    examTitle: "$results.examTitle",
                    score: {
                        $multiply: [
                            { $divide: ["$results.correctAnswers", "$results.totalQuestions"] },
                            100
                        ]
                    },
                    correctAnswers: "$results.correctAnswers",
                    totalQuestions: "$results.totalQuestions",
                    examDate: "$results.examDate",
                    attemptNumber: "$results.attemptNumber"
                }
            },
            { $sort: { examDate: -1 } }
        ]);

        // Calculate enrollment trends for this course
        const enrollmentTrends = await Enrollment.aggregate([
            { $match: { courseId: course._id } },
            {
                $group: {
                    _id: {
                        year: { $year: "$enrolledAt" },
                        month: { $month: "$enrolledAt" }
                    },
                    count: { $sum: 1 },
                    revenue: {
                        $sum: {
                            $cond: [
                                { $eq: ["$paymentStatus", "paid"] },
                                "$price",
                                0
                            ]
                        }
                    }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                course,
                enrollments,
                examResults,
                enrollmentTrends,
                statistics: {
                    totalEnrollments: enrollments.length,
                    paidEnrollments: enrollments.filter(e => e.paymentStatus === 'paid').length,
                    pendingEnrollments: enrollments.filter(e => e.paymentStatus === 'pending').length,
                    totalRevenue: enrollments
                        .filter(e => e.paymentStatus === 'paid')
                        .reduce((sum, e) => sum + e.price, 0)
                }
            }
        });

    } catch (error) {
        console.error("Course Detailed Analytics Error:", error);
        res.status(500).json({
            success: false,
            message: "خطأ في جلب تفاصيل تحليل الكورس",
            error: error.message
        });
    }
};

// Get enrollment statistics by date range
const getEnrollmentStatsByDateRange = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        let matchStage = {};
        if (startDate && endDate) {
            matchStage.enrolledAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const enrollmentStats = await Enrollment.aggregate([
            { $match: matchStage },
            {
                $lookup: {
                    from: "courses",
                    localField: "courseId",
                    foreignField: "_id",
                    as: "course"
                }
            },
            { $unwind: "$course" },
            {
                $group: {
                    _id: "$course.name",
                    totalEnrollments: { $sum: 1 },
                    paidEnrollments: {
                        $sum: {
                            $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0]
                        }
                    },
                    totalRevenue: {
                        $sum: {
                            $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$price", 0]
                        }
                    }
                }
            },
            { $sort: { totalEnrollments: -1 } }
        ]);

        res.status(200).json({
            success: true,
            data: enrollmentStats
        });

    } catch (error) {
        console.error("Enrollment Stats Error:", error);
        res.status(500).json({
            success: false,
            message: "خطأ في جلب احصائيات التسجيل",
            error: error.message
        });
    }
};

module.exports = {
    getCourseAnalytics: expressAsyncHandler(getCourseAnalytics),
    getCourseDetailedAnalytics: expressAsyncHandler(getCourseDetailedAnalytics),
    getEnrollmentStatsByDateRange: expressAsyncHandler(getEnrollmentStatsByDateRange)
};
