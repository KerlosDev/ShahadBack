const Notification = require('../modules/notificationModel');
const ApiError = require('../utils/apiError');

class NotificationService {
    // Create a new notification
    async createNotification(message, createdBy) {
        try {
            const notification = new Notification({
                message,
                createdBy
            });

            await notification.save();

            // Populate the creator's information
            await notification.populate('createdBy', 'name email');

            return notification;
        } catch (error) {
            throw new ApiError('فشل في إنشاء الإشعار', 500);
        }
    }

    // Get all notifications with pagination
    async getAllNotifications(page = 1, limit = 10) {
        try {
            const skip = (page - 1) * limit;

            const notifications = await Notification.find({ isActive: true })
                .populate('createdBy', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            const total = await Notification.countDocuments({ isActive: true });
            const totalPages = Math.ceil(total / limit);

            return {
                notifications,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems: total,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            };
        } catch (error) {
            throw new ApiError('فشل في جلب الإشعارات', 500);
        }
    }

    // Get notifications for display (including sender's own notifications)
    async getNotificationsForUser(userId, page = 1, limit = 10) {
        try {
            const skip = (page - 1) * limit;

            const notifications = await Notification.find({
                isActive: true
                // Show all notifications including sender's own notifications
            })
                .populate('createdBy', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            const total = await Notification.countDocuments({
                isActive: true
            });

            const totalPages = Math.ceil(total / limit);

            return {
                notifications,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems: total,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            };
        } catch (error) {
            throw new ApiError('فشل في جلب الإشعارات', 500);
        }
    }

    // Get recent notifications for user (last 50, including their own)
    async getRecentNotificationsForUser(userId) {
        try {
            const notifications = await Notification.find({
                isActive: true
                // Show all notifications including sender's own notifications
            })
                .populate('createdBy', 'name email')
                .sort({ createdAt: -1 })
                .limit(50);

            return notifications;
        } catch (error) {
            throw new ApiError('فشل في جلب الإشعارات الحديثة', 500);
        }
    }

    // Delete a specific notification
    async deleteNotification(notificationId, userId) {
        try {
            const notification = await Notification.findById(notificationId);

            if (!notification) {
                throw new ApiError('الإشعار غير موجود', 404);
            }

          

            await Notification.findByIdAndDelete(notificationId);
            return true;
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('فشل في حذف الإشعار', 500);
        }
    }

    // Delete all notifications (admin only)
    async deleteAllNotifications(userId) {
        try {
            await Notification.deleteMany({ createdBy: userId });
            return true;
        } catch (error) {
            throw new ApiError('فشل في حذف جميع الإشعارات', 500);
        }
    }

    // Soft delete notification
    async softDeleteNotification(notificationId, userId) {
        try {
            const notification = await Notification.findById(notificationId);

            if (!notification) {
                throw new ApiError('الإشعار غير موجود', 404);
            }
 

            notification.isActive = false;
            await notification.save();

            return notification;
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('فشل في حذف الإشعار', 500);
        }
    }
}

module.exports = new NotificationService();
