const express = require('express');
const router = express.Router();
const { protect, isAdmin } = require('../services/authService');
const FawaterakService = require('../services/fawaterakService');
const Payment = require('../modules/paymentModel');
const Course = require('../modules/courseModule');
const User = require('../modules/userModule');
const Enrollment = require('../modules/enrollmentModel');
const { v4: uuidv4 } = require('uuid');

// Initialize Fawaterak service
const fawaterakService = new FawaterakService();

// Create payment invoice
router.post('/create-invoice', protect, async (req, res) => {
    try {
        const { courseId, paymentMethods = ['CREDIT', 'VODAFONE_CASH'] } = req.body;
        const userId = req.user._id;

        // Validate course
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({
                status: 'error',
                message: 'Course not found'
            });
        }

        // Check if user already enrolled
        const existingEnrollment = await Enrollment.findOne({
            userId,
            courseId,
            paymentStatus: 'paid'
        });

        if (existingEnrollment) {
            return res.status(400).json({
                status: 'error',
                message: 'You are already enrolled in this course'
            });
        }

        // Get user details
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        // Create unique merchant reference number
        const merchantRefNum = `WW_${courseId}_${userId}_${Date.now()}`;

        // Prepare invoice data
        const invoiceData = {
            cartTotal: course.price,
            currency: 'EGP',
            customer: {
                name: user.name,
                mobile: user.phoneNumber,
                email: user.email
            },
            redirectionUrls: {
                successUrl: `${process.env.FRONTEND_SUCCESS_URL}?ref=${merchantRefNum}`,
                failUrl: `${process.env.FRONTEND_FAILURE_URL}?ref=${merchantRefNum}`,
                pendingUrl: `${process.env.FRONTEND_PENDING_URL}?ref=${merchantRefNum}`
            },
            paymentMethods: paymentMethods,
            cartItems: [{
                name: course.name,
                price: course.price,
                quantity: 1
            }],
            merchantRefNum
        };

        // Create invoice with Fawaterak
        const fawaterakResponse = await fawaterakService.createInvoice(invoiceData);

        if (!fawaterakResponse.success) {
            throw new Error('Failed to create payment invoice');
        }

        // Save payment record
        const payment = new Payment({
            userId,
            courseId,
            amount: course.price,
            merchantRefNum,
            invoiceId: fawaterakResponse.invoiceId,
            paymentUrl: fawaterakResponse.paymentUrl,
            status: 'pending',
            customerInfo: {
                name: user.name,
                email: user.email,
                mobile: user.phoneNumber
            },
            metadata: {
                courseName: course.name,
                paymentMethods
            }
        });

        await payment.save();

        res.status(201).json({
            status: 'success',
            data: {
                paymentId: payment._id,
                paymentUrl: fawaterakResponse.paymentUrl,
                invoiceId: fawaterakResponse.invoiceId,
                merchantRefNum,
                amount: course.price,
                courseName: course.name
            }
        });

    } catch (error) {
        console.error('Create invoice error:', error);
        res.status(500).json({
            status: 'error',
            message: error.message || 'Failed to create payment invoice'
        });
    }
});

// Check payment status
router.get('/status/:merchantRefNum', protect, async (req, res) => {
    try {
        const { merchantRefNum } = req.params;

        // Find payment record
        const payment = await Payment.findByMerchantRefNum(merchantRefNum)
            .populate('courseId', 'name price')
            .populate('userId', 'name email');

        if (!payment) {
            return res.status(404).json({
                status: 'error',
                message: 'Payment not found'
            });
        }

        // Check if user owns this payment
        if (payment.userId._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied'
            });
        }

        // Get status from Fawaterak
        const fawaterakStatus = await fawaterakService.checkPaymentStatus(merchantRefNum);

        if (fawaterakStatus.success) {
            // Update payment status if changed
            const newStatus = fawaterakStatus.paymentStatus === 'paid' ? 'paid' :
                fawaterakStatus.paymentStatus === 'failed' ? 'failed' : 'pending';

            if (payment.status !== newStatus) {
                await payment.updateStatus(newStatus, fawaterakStatus.data);

                // If payment is successful, create or update enrollment
                if (newStatus === 'paid') {
                    await createOrUpdateEnrollment(payment);
                }
            }
        }

        res.json({
            status: 'success',
            data: {
                paymentId: payment._id,
                merchantRefNum: payment.merchantRefNum,
                status: payment.status,
                amount: payment.amount,
                courseName: payment.courseId.name,
                paidAt: payment.paidAt,
                fawaterakStatus: fawaterakStatus.data
            }
        });

    } catch (error) {
        console.error('Check payment status error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to check payment status'
        });
    }
});

// Webhook endpoint for Fawaterak notifications
router.post('/webhook/fawaterak', async (req, res) => {
    try {
        const webhookData = req.body;
        const signature = req.headers['x-fawaterak-signature'];

        // Verify webhook signature
        if (!fawaterakService.verifyWebhookSignature(webhookData, signature)) {
            console.error('Invalid webhook signature');
            return res.status(400).json({
                status: 'error',
                message: 'Invalid signature'
            });
        }

        const { merchantRefNum } = webhookData;

        // Find payment record
        const payment = await Payment.findByMerchantRefNum(merchantRefNum);
        if (!payment) {
            console.error('Payment not found for webhook:', merchantRefNum);
            return res.status(404).json({
                status: 'error',
                message: 'Payment not found'
            });
        }

        // Add webhook data
        await payment.addWebhookData(webhookData);

        // Update payment status based on webhook data
        const newStatus = webhookData.payment_status === 'paid' ? 'paid' :
            webhookData.payment_status === 'failed' ? 'failed' : 'pending';

        if (payment.status !== newStatus) {
            await payment.updateStatus(newStatus, webhookData);

            // If payment is successful, create or update enrollment
            if (newStatus === 'paid') {
                await createOrUpdateEnrollment(payment);
            }
        }

        res.json({
            status: 'success',
            message: 'Webhook processed successfully'
        });

    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Webhook processing failed'
        });
    }
});

// Get user payments
router.get('/my-payments', protect, async (req, res) => {
    try {
        const userId = req.user._id;
        const {
            status,
            courseId,
            page = 1,
            limit = 10
        } = req.query;

        const skip = (page - 1) * limit;

        const payments = await Payment.findUserPayments(userId, {
            status,
            courseId,
            limit: parseInt(limit),
            skip: parseInt(skip)
        });

        const total = await Payment.countDocuments({
            userId,
            ...(status && { status }),
            ...(courseId && { courseId })
        });

        res.json({
            status: 'success',
            data: {
                payments,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    itemsPerPage: parseInt(limit)
                }
            }
        });

    } catch (error) {
        console.error('Get user payments error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch payments'
        });
    }
});

// Admin: Get all payments
router.get('/admin/payments', protect, isAdmin, async (req, res) => {
    try {
        const {
            status,
            courseId,
            userId,
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            search
        } = req.query;

        const skip = (page - 1) * limit;

        // Build query
        const query = {};
        if (status) query.status = status;
        if (courseId) query.courseId = courseId;
        if (userId) query.userId = userId;

        // Search functionality
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { 'customerInfo.name': searchRegex },
                { 'customerInfo.email': searchRegex },
                { merchantRefNum: searchRegex }
            ];
        }

        // Sort options
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const payments = await Payment.find(query)
            .populate('courseId', 'name price')
            .populate('userId', 'name email phoneNumber')
            .sort(sortOptions)
            .limit(parseInt(limit))
            .skip(skip);

        const total = await Payment.countDocuments(query);

        res.json({
            status: 'success',
            data: {
                payments,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    itemsPerPage: parseInt(limit)
                }
            }
        });

    } catch (error) {
        console.error('Get admin payments error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch payments'
        });
    }
});

// Admin: Refund payment
router.post('/admin/refund/:paymentId', protect, isAdmin, async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { refundAmount, refundReason } = req.body;

        const payment = await Payment.findById(paymentId);
        if (!payment) {
            return res.status(404).json({
                status: 'error',
                message: 'Payment not found'
            });
        }

        if (payment.status !== 'paid') {
            return res.status(400).json({
                status: 'error',
                message: 'Only paid payments can be refunded'
            });
        }

        // Process refund with Fawaterak
        const refundResponse = await fawaterakService.refundPayment({
            merchantRefNum: payment.merchantRefNum,
            refundAmount: refundAmount || payment.amount,
            refundReason
        });

        if (refundResponse.success) {
            // Add refund to payment record
            await payment.addRefund({
                refundId: refundResponse.refundId,
                amount: refundAmount || payment.amount,
                reason: refundReason,
                status: 'completed'
            });

            // Update enrollment status if fully refunded
            if (refundAmount >= payment.amount) {
                await Enrollment.findOneAndUpdate(
                    { userId: payment.userId, courseId: payment.courseId },
                    { paymentStatus: 'refunded', isActive: false }
                );
            }

            res.json({
                status: 'success',
                message: 'Refund processed successfully',
                data: {
                    refundId: refundResponse.refundId,
                    refundAmount: refundAmount || payment.amount
                }
            });
        } else {
            throw new Error('Refund processing failed');
        }

    } catch (error) {
        console.error('Refund payment error:', error);
        res.status(500).json({
            status: 'error',
            message: error.message || 'Failed to process refund'
        });
    }
});

// Admin: Get payment statistics
router.get('/admin/stats', protect, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const stats = await Payment.getPaymentStats({ startDate, endDate });

        res.json({
            status: 'success',
            data: stats[0] || {
                stats: [],
                totalTransactions: 0,
                totalRevenue: 0
            }
        });

    } catch (error) {
        console.error('Get payment stats error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch payment statistics'
        });
    }
});

// Helper function to create or update enrollment
async function createOrUpdateEnrollment(payment) {
    try {
        const existingEnrollment = await Enrollment.findOne({
            userId: payment.userId,
            courseId: payment.courseId
        });

        if (existingEnrollment) {
            // Update existing enrollment
            existingEnrollment.paymentStatus = 'paid';
            existingEnrollment.isActive = true;
            existingEnrollment.enrollmentDate = new Date();
            await existingEnrollment.save();
        } else {
            // Create new enrollment
            const enrollment = new Enrollment({
                userId: payment.userId,
                courseId: payment.courseId,
                paymentStatus: 'paid',
                isActive: true,
                enrollmentDate: new Date(),
                phoneNumber: payment.customerInfo.mobile
            });
            await enrollment.save();
        }

        console.log('Enrollment updated successfully for payment:', payment.merchantRefNum);

    } catch (error) {
        console.error('Error creating/updating enrollment:', error);
        await payment.addError(`Enrollment creation failed: ${error.message}`);
    }
}

module.exports = router;
