const { check } = require('express-validator');

exports.createOfferValidator = [
    check('title')
        .notEmpty()
        .withMessage('Offer title is required')
        .isString()
        .withMessage('Offer title must be a string'),

    check('subtitle')
        .notEmpty()
        .withMessage('Offer subtitle is required')
        .isString()
        .withMessage('Offer subtitle must be a string'),

    check('description')
        .notEmpty()
        .withMessage('Offer description is required')
        .isString()
        .withMessage('Offer description must be a string'),

    check('originalPrice')
        .notEmpty()
        .withMessage('Original price is required')
        .isNumeric()
        .withMessage('Original price must be a number')
        .custom((value) => {
            if (value <= 0) {
                throw new Error('Original price must be greater than 0');
            }
            return true;
        }),

    check('discountPrice')
        .notEmpty()
        .withMessage('Discount price is required')
        .isNumeric()
        .withMessage('Discount price must be a number')
        .custom((value, { req }) => {
            if (value <= 0) {
                throw new Error('Discount price must be greater than 0');
            }
            if (value >= req.body.originalPrice) {
                throw new Error('Discount price must be less than original price');
            }
            return true;
        }),

    check('courses')
        .notEmpty()
        .withMessage('Number of courses is required')
        .isInt({ min: 1 })
        .withMessage('Number of courses must be at least 1'),

    check('students')
        .notEmpty()
        .withMessage('Number of students is required')
        .isInt({ min: 0 })
        .withMessage('Number of students cannot be negative'),

    check('rating')
        .notEmpty()
        .withMessage('Rating is required')
        .isFloat({ min: 0, max: 5 })
        .withMessage('Rating must be between 0 and 5'),

    check('features')
        .notEmpty()
        .withMessage('Features are required')
        .custom((value) => {
            if (Array.isArray(value)) {
                if (value.length === 0) {
                    throw new Error('At least one feature is required');
                }
                return true;
            }
            if (typeof value === 'string') {
                if (value.trim().length === 0) {
                    throw new Error('At least one feature is required');
                }
                return true;
            }
            throw new Error('Features must be an array or comma-separated string');
        }),

    check('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be a valid date'),

    check('isLimited')
        .optional()
        .isBoolean()
        .withMessage('isLimited must be a boolean'),

    check('spotsLeft')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Spots left cannot be negative'),

    check('stage')
        .optional()
        .isIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
        .withMessage('Stage must be either DRAFT, PUBLISHED, or ARCHIVED')
];

exports.updateOfferValidator = [
    check('title')
        .optional()
        .isString()
        .withMessage('Offer title must be a string'),

    check('subtitle')
        .optional()
        .isString()
        .withMessage('Offer subtitle must be a string'),

    check('description')
        .optional()
        .isString()
        .withMessage('Offer description must be a string'),

    check('originalPrice')
        .optional()
        .isNumeric()
        .withMessage('Original price must be a number')
        .custom((value) => {
            if (value <= 0) {
                throw new Error('Original price must be greater than 0');
            }
            return true;
        }),

    check('discountPrice')
        .optional()
        .isNumeric()
        .withMessage('Discount price must be a number')
        .custom((value, { req }) => {
            if (value <= 0) {
                throw new Error('Discount price must be greater than 0');
            }
            if (req.body.originalPrice && value >= req.body.originalPrice) {
                throw new Error('Discount price must be less than original price');
            }
            return true;
        }),

    check('courses')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Number of courses must be at least 1'),

    check('students')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Number of students cannot be negative'),

    check('rating')
        .optional()
        .isFloat({ min: 0, max: 5 })
        .withMessage('Rating must be between 0 and 5'),

    check('features')
        .optional()
        .custom((value) => {
            if (Array.isArray(value)) {
                if (value.length === 0) {
                    throw new Error('At least one feature is required');
                }
                return true;
            }
            if (typeof value === 'string') {
                if (value.trim().length === 0) {
                    throw new Error('At least one feature is required');
                }
                return true;
            }
            throw new Error('Features must be an array or comma-separated string');
        }),

    check('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be a valid date'),

    check('isLimited')
        .optional()
        .isBoolean()
        .withMessage('isLimited must be a boolean'),

    check('spotsLeft')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Spots left cannot be negative')
];

exports.changeStageValidator = [
    check('stage')
        .notEmpty()
        .withMessage('Stage is required')
        .isIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
        .withMessage('Stage must be either DRAFT, PUBLISHED, or ARCHIVED')
];
