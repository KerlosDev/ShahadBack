const express = require('express');
const { body } = require('express-validator');
const { protect, isAdmin } = require('../services/authService');
const notificationService = require('../services/notificationService');
const validatorMiddleware = require('../middleware/validMiddleware');

const router = express.Router();

// Protected routes (require authentication)
router.use(protect);

// Validation rules for creating notifications
const createNotificationValidation = [
    body('message')
        .isLength({ min: 1, max: 500 })
        .withMessage('رسالة الإشعار يجب أن تكون بين 1 و 500 حرف')
        .trim()
];

// Create a new notification (admin only)
router.post('/', isAdmin, createNotificationValidation, validatorMiddleware, async (req, res) => {
    try {
        const { message } = req.body;
        const createdBy = req.user._id;

        const notification = await notificationService.createNotification(message, createdBy);

        res.status(201).json({
            success: true,
            message: 'تم إنشاء الإشعار بنجاح',
            data: notification
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'حدث خطأ في الخادم'
        });
    }
});

// Get all notifications for admin management
router.get('/admin', isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const result = await notificationService.getAllNotifications(page, limit);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'حدث خطأ في الخادم'
        });
    }
});

// Get notifications for regular users (excluding their own)
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const userId = req.user._id;

        const result = await notificationService.getNotificationsForUser(userId, page, limit);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'حدث خطأ في الخادم'
        });
    }
});

// Get recent notifications for user (for notification button)
router.get('/recent', async (req, res) => {
    try {
        const userId = req.user._id;
        const notifications = await notificationService.getRecentNotificationsForUser(userId);

        res.json({
            success: true,
            data: notifications
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'حدث خطأ في الخادم'
        });
    }
});

// Delete a specific notification (admin or creator only)
router.delete('/:id',isAdmin, async (req, res) => {
    try {
        const notificationId = req.params.id;
        const userId = req.user._id;

        await notificationService.deleteNotification(notificationId, userId);

        res.json({
            success: true,
            message: 'تم حذف الإشعار بنجاح'
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'حدث خطأ في الخادم'
        });
    }
});

// Delete all notifications created by the current user (admin only)
router.delete('/', isAdmin, async (req, res) => {
    try {
        const userId = req.user._id;
        await notificationService.deleteAllNotifications(userId);

        res.json({
            success: true,
            message: 'تم حذف جميع الإشعارات بنجاح'
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'حدث خطأ في الخادم'
        });
    }
});

module.exports = router;
