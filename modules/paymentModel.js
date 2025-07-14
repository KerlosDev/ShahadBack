const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    // User information
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Course information
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },

    // Payment details
    amount: {
        type: Number,
        required: true,
        min: 0
    },

    currency: {
        type: String,
        default: 'EGP',
        enum: ['EGP', 'USD', 'SAR', 'AED']
    },

    // Fawaterak specific fields
    merchantRefNum: {
        type: String,
        required: true,
        unique: true
    },

    invoiceId: {
        type: String,
        required: false
    },

    paymentMethod: {
        type: String,
        enum: [
            'CREDIT',
            'VODAFONE_CASH',
            'ETISALAT_CASH',
            'ORANGE_CASH',
            'BANK_TRANSFER',
            'FAWRY',
            'CIB_WALLET'
        ]
    },

    // Payment status
    status: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded'],
        default: 'pending'
    },

    // Fawaterak payment status
    fawaterakPaymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'cancelled', 'expired'],
        default: 'pending'
    },

    // Fawaterak invoice status
    fawaterakInvoiceStatus: {
        type: String,
        enum: ['pending', 'paid', 'expired', 'cancelled'],
        default: 'pending'
    },

    // Transaction details
    transactionId: {
        type: String,
        required: false
    },

    paymentUrl: {
        type: String,
        required: false
    },

    paidAt: {
        type: Date,
        required: false
    },

    // Customer information for payment
    customerInfo: {
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        },
        mobile: {
            type: String,
            required: true
        }
    },

    // Refund information
    refunds: [{
        refundId: String,
        amount: Number,
        reason: String,
        refundedAt: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'pending'
        }
    }],

    // Error tracking
    errors: [{
        error: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],

    // Webhook data
    webhookData: [{
        data: mongoose.Schema.Types.Mixed,
        receivedAt: {
            type: Date,
            default: Date.now
        }
    }],

    // Metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }

}, {
    timestamps: true
});

// Indexes
paymentSchema.index({ userId: 1, courseId: 1 });
paymentSchema.index({ merchantRefNum: 1 });
paymentSchema.index({ invoiceId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: -1 });

// Virtual for total refunded amount
paymentSchema.virtual('totalRefunded').get(function () {
    return this.refunds
        .filter(refund => refund.status === 'completed')
        .reduce((total, refund) => total + refund.amount, 0);
});

// Virtual for net amount (amount - refunds)
paymentSchema.virtual('netAmount').get(function () {
    return this.amount - this.totalRefunded;
});

// Methods
paymentSchema.methods.addRefund = function (refundData) {
    this.refunds.push(refundData);

    // Update payment status based on refunds
    const totalRefunded = this.totalRefunded;
    if (totalRefunded >= this.amount) {
        this.status = 'refunded';
    } else if (totalRefunded > 0) {
        this.status = 'partially_refunded';
    }

    return this.save();
};

paymentSchema.methods.addWebhookData = function (data) {
    this.webhookData.push({ data });
    return this.save();
};

paymentSchema.methods.addError = function (error) {
    this.errors.push({ error: error.toString() });
    return this.save();
};

paymentSchema.methods.updateStatus = function (status, fawaterakData = {}) {
    this.status = status;

    if (fawaterakData.payment_status) {
        this.fawaterakPaymentStatus = fawaterakData.payment_status;
    }

    if (fawaterakData.invoice_status) {
        this.fawaterakInvoiceStatus = fawaterakData.invoice_status;
    }

    if (fawaterakData.transaction_id) {
        this.transactionId = fawaterakData.transaction_id;
    }

    if (status === 'paid') {
        this.paidAt = new Date();
    }

    return this.save();
};

// Static methods
paymentSchema.statics.findByMerchantRefNum = function (merchantRefNum) {
    return this.findOne({ merchantRefNum });
};

paymentSchema.statics.findByInvoiceId = function (invoiceId) {
    return this.findOne({ invoiceId });
};

paymentSchema.statics.findUserPayments = function (userId, options = {}) {
    const {
        status,
        courseId,
        limit = 10,
        skip = 0,
        sort = { createdAt: -1 }
    } = options;

    const query = { userId };

    if (status) query.status = status;
    if (courseId) query.courseId = courseId;

    return this.find(query)
        .populate('courseId', 'name price description')
        .populate('userId', 'name email phoneNumber')
        .sort(sort)
        .limit(limit)
        .skip(skip);
};

paymentSchema.statics.getPaymentStats = function (dateRange = {}) {
    const { startDate, endDate } = dateRange;
    const matchStage = {};

    if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate) matchStage.createdAt.$gte = new Date(startDate);
        if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    return this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalAmount: { $sum: '$amount' }
            }
        },
        {
            $group: {
                _id: null,
                stats: {
                    $push: {
                        status: '$_id',
                        count: '$count',
                        totalAmount: '$totalAmount'
                    }
                },
                totalTransactions: { $sum: '$count' },
                totalRevenue: {
                    $sum: {
                        $cond: [
                            { $eq: ['$_id', 'paid'] },
                            '$totalAmount',
                            0
                        ]
                    }
                }
            }
        }
    ]);
};

module.exports = mongoose.model('Payment', paymentSchema);
