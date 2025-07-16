const express = require('express');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const User = require('../modules/userModule');
const { validateSignUp, validateSignIn } = require('../validator/userValid');
const { signUp, signIn, logout, protect, isAdmin, isAdminOrInstructor } = require('../services/authService');
const { getUserByIdService, resetUserPassword } = require('../services/userServise');


const router = express.Router();

router.post('/signup', validateSignUp, signUp);
router.post('/signin', validateSignIn, signIn);
router.post('/logout', protect, logout);
router.get('/validate', protect, (req, res) => {
    // If protect middleware passes, session is valid
    res.status(200).json({
        message: 'Session is valid',
        user: {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role
        }
    });
});
router.get('/user', protect, isAdminOrInstructor, getUserByIdService);
router.post('/reset-password/:userId', protect, isAdmin, resetUserPassword);
module.exports = router;
