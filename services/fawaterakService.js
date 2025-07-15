const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class FawaterakService {
    constructor() {
        this.baseURL = process.env.FAWATERAK_BASE_URL || 'https://staging.fawaterk.com/api/v2';
        this.merchantCode = process.env.FAWATERAK_API_KEY;
        this.secretKey = process.env.FAWATERAK_API_SECRET;
        this.webhookSecret = process.env.FAWATERAK_WEBHOOK_SECRET;

        if (!this.merchantCode || !this.secretKey) {
            console.error('Missing Fawaterak credentials:', {
                hasApiKey: !!this.merchantCode,
                hasApiSecret: !!this.secretKey,
                hasWebhookSecret: !!this.webhookSecret
            });
            throw new Error('Fawaterak credentials are not properly configured. Check FAWATERAK_API_KEY and FAWATERAK_API_SECRET');
        }
    }

    // Generate signature for request authentication
    generateSignature(data) {
        const sortedKeys = Object.keys(data).sort();
        let signatureString = '';

        sortedKeys.forEach(key => {
            if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
                signatureString += `${key}=${data[key]}&`;
            }
        });

        // Remove trailing &
        signatureString = signatureString.slice(0, -1);

        // Add secret key
        signatureString += this.secretKey;

        // Generate SHA256 hash
        return crypto.createHash('sha256').update(signatureString).digest('hex');
    }

    // Create payment invoice
    async createInvoice(invoiceData) {
        try {
            const {
                cartTotal,
                currency = 'EGP',
                customer,
                redirectionUrls,
                paymentMethods,
                cartItems,
                merchantRefNum
            } = invoiceData;

            const requestData = {
                merchantCode: this.merchantCode,
                merchantRefNum: merchantRefNum || uuidv4(),
                customerName: customer.name,
                customerMobile: customer.mobile,
                customerEmail: customer.email,
                cartTotal: parseFloat(cartTotal),
                currency: currency,
                cartDescription: `Payment for ${cartItems[0]?.name || 'Course'}`,
                successUrl: redirectionUrls.successUrl,
                failUrl: redirectionUrls.failUrl,
                pendingUrl: redirectionUrls.pendingUrl,
                paymentMethods: paymentMethods.join(','),
                cartItems: JSON.stringify(cartItems)
            };

            // Generate signature
            requestData.signature = this.generateSignature(requestData);

            console.log('Fawaterak Request Data:', {
                ...requestData,
                signature: requestData.signature.substring(0, 10) + '...' // Only show first 10 chars of signature
            });

            const response = await fetch(`${this.baseURL}/invoiceInitPay`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Fawaterak API Error Response:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log('Fawaterak API Response:', result);

            if (result.status === 'success') {
                return {
                    success: true,
                    invoiceId: result.data.invoice_id,
                    paymentUrl: result.data.payment_url,
                    merchantRefNum: requestData.merchantRefNum,
                    data: result.data
                };
            } else {
                const errorMessage = result.message || result.error || 'Failed to create invoice';
                console.error('Fawaterak Error:', result);
                throw new Error(errorMessage);
            }

        } catch (error) {
            console.error('Fawaterak createInvoice error:', error);
            // Ensure we always throw a proper Error object with a string message
            const errorMessage = error instanceof Error ? error.message :
                typeof error === 'string' ? error :
                    JSON.stringify(error);
            throw new Error(`Payment initialization failed: ${errorMessage}`);
        }
    }

    // Check payment status
    async checkPaymentStatus(merchantRefNum) {
        try {
            const requestData = {
                merchantCode: this.merchantCode,
                merchantRefNum: merchantRefNum
            };

            requestData.signature = this.generateSignature(requestData);

            const response = await fetch(`${this.baseURL}/getInvoiceData`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Fawaterak Status API Error Response:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log('Fawaterak Status API Response:', result);

            if (result.status === 'success') {
                return {
                    success: true,
                    paymentStatus: result.data.payment_status,
                    invoiceStatus: result.data.invoice_status,
                    paidAmount: result.data.paid_amount,
                    invoiceId: result.data.invoice_id,
                    data: result.data
                };
            } else {
                const errorMessage = result.message || result.error || 'Failed to get payment status';
                console.error('Fawaterak Status Error:', result);
                throw new Error(errorMessage);
            }

        } catch (error) {
            console.error('Fawaterak checkPaymentStatus error:', error);
            // Ensure we always throw a proper Error object with a string message
            const errorMessage = error instanceof Error ? error.message :
                typeof error === 'string' ? error :
                    JSON.stringify(error);
            throw new Error(`Payment status check failed: ${errorMessage}`);
        }
    }

    // Verify webhook signature
    verifyWebhookSignature(payload, receivedSignature) {
        try {
            // For webhook verification, we should use the webhook secret
            const webhookSignature = this.generateWebhookSignature(payload);
            return webhookSignature === receivedSignature;
        } catch (error) {
            console.error('Webhook signature verification error:', error);
            return false;
        }
    }

    // Generate webhook signature (different from API signature)
    generateWebhookSignature(data) {
        const sortedKeys = Object.keys(data).sort();
        let signatureString = '';

        sortedKeys.forEach(key => {
            if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
                signatureString += `${key}=${data[key]}&`;
            }
        });

        // Remove trailing &
        signatureString = signatureString.slice(0, -1);

        // Add webhook secret key
        signatureString += this.webhookSecret;

        // Generate SHA256 hash
        return crypto.createHash('sha256').update(signatureString).digest('hex');
    }

    // Get supported payment methods
    getSupportedPaymentMethods() {
        return [
            'CREDIT', // Credit/Debit Cards
            'VODAFONE_CASH', // Vodafone Cash
            'ETISALAT_CASH', // Etisalat Cash
            'ORANGE_CASH', // Orange Cash
            'BANK_TRANSFER', // Bank Transfer
            'FAWRY', // Fawry
            'CIB_WALLET' // CIB Wallet
        ];
    }

    // Refund payment
    async refundPayment(refundData) {
        try {
            const {
                merchantRefNum,
                refundAmount,
                refundReason
            } = refundData;

            const requestData = {
                merchantCode: this.merchantCode,
                merchantRefNum: merchantRefNum,
                refundAmount: parseFloat(refundAmount),
                refundReason: refundReason || 'Customer request'
            };

            requestData.signature = this.generateSignature(requestData);

            const response = await fetch(`${this.baseURL}/refund`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            const result = await response.json();

            if (result.status === 'success') {
                return {
                    success: true,
                    refundId: result.data.refund_id,
                    data: result.data
                };
            } else {
                throw new Error(result.message || 'Refund failed');
            }

        } catch (error) {
            console.error('Fawaterak refund error:', error);
            throw new Error(`Refund failed: ${error.message}`);
        }
    }
}

module.exports = FawaterakService;
