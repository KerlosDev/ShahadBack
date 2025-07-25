const express = require('express');
const router = express.Router();
const { protect, isAdmin } = require('../services/authService');
const FawaterakService = require('../services/fawaterakService');
const Payment = require('../modules/paymentModel');
const Package = require('../modules/packageModel');
const User = require('../modules/userModule');
const Enrollment = require('../modules/enrollmentModel');
const { v4: uuidv4 } = require('uuid');

// Initialize Fawaterak service
const fawaterakService = new FawaterakService();

// Create package payment invoice
router.post('/package', protect, async (req, res) => {
    try {
        const { packageId, enrollmentId, paymentMethods = ['CREDIT', 'VODAFONE_CASH'] } = req.body;
        const userId = req.user._id;

        // Validate package
        const packageData = await Package.findById(packageId);
        if (!packageData) {
            return res.status(404).json({
                status: 'error',
                message: 'Package not found'
            });
        }

        // Check if enrollment exists
        const enrollment = await Enrollment.findById(enrollmentId);
        if (!enrollment || enrollment.studentId.toString() !== userId.toString() || enrollment.packageId.toString() !== packageId) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid enrollment'
            });
        }

        // Check if user already enrolled
        const existingEnrollment = await Enrollment.findOne({
            studentId: userId,
            packageId,
            isPackage: true,
            paymentStatus: 'paid'
        });

        if (existingEnrollment) {
            return res.status(400).json({
                status: 'error',
                message: 'You are already enrolled in this package'
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
        const merchantRefNum = `WW_PKG_${packageId}_${userId}_${Date.now()}`;

        // Prepare invoice data
        const invoiceData = {
            cartTotal: packageData.price,
            currency: 'EGP',
            customer: {
                name: user.name,
                mobile: user.phoneNumber,
                email: user.email
            },
            redirectionUrls: {
                successUrl: `${process.env.FRONTEND_SUCCESS_URL}?ref=${merchantRefNum}&type=package`,
                failUrl: `${process.env.FRONTEND_FAILURE_URL}?ref=${merchantRefNum}&type=package`,
                pendingUrl: `${process.env.FRONTEND_PENDING_URL}?ref=${merchantRefNum}&type=package`
            },
            cartItems: [
                {
                    itemId: packageData._id.toString(),
                    description: `Package: ${packageData.name}`,
                    price: packageData.price,
                    quantity: 1
                }
            ],
            paymentMethods
        };

        // Create Fawaterak invoice
        const invoiceResponse = await fawaterakService.createInvoice(invoiceData);

        if (!invoiceResponse || !invoiceResponse.data || !invoiceResponse.data.status === 'success') {
            return res.status(500).json({
                status: 'error',
                message: 'Failed to create payment invoice'
            });
        }

        // Save payment record
        const payment = new Payment({
            userId,
            packageId,
            enrollmentId,
            isPackage: true,
            amount: packageData.price,
            currency: 'EGP',
            merchantRefNum,
            invoiceId: invoiceResponse.data.invoiceId,
            paymentMethod: 'FAWATERAK', // Will be updated after payment
            status: 'pending',
            fawaterakPaymentStatus: 'pending',
            fawaterakInvoiceStatus: 'pending',
            paymentUrl: invoiceResponse.data.paymentData.paymentURL,
            customerInfo: {
                name: user.name,
                email: user.email,
                mobile: user.phoneNumber
            },
            metadata: {
                invoiceResponse: invoiceResponse.data
            }
        });

        await payment.save();

        return res.status(201).json({
            status: 'success',
            message: 'Payment invoice created successfully',
            paymentUrl: invoiceResponse.data.paymentData.paymentURL,
            merchantRefNum
        });
    } catch (error) {
        console.error('Create package payment invoice error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to create payment invoice',
            error: error.message
        });
    }
});

module.exports = router;
