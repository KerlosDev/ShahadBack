
const express = require('express');
const { protect, isAdmin, isAdminOrInstructor } = require('../services/authService.js')
const { getStudentRankById, getStudentsRankings } = require('../services/examResltsServise.js')
const router = express.Router();

// ✅ ترتيب الطالب الحالي
router.get('/me', protect, async (req, res) => {
  try {
    const studentId = req.user._id;
    const rankData = await getStudentRankById(studentId);

    if (!rankData) {
      return res.status(404).json({ success: false, message: 'لم يتم العثور على ترتيبك' });
    }

    res.json({ success: true, data: rankData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ ترتيب كل الطلاب (مثلاً لإظهار جدول في لوحة التحكم)
router.get('/all', protect, isAdminOrInstructor, async (req, res) => {
  try {
    const rankings = await getStudentsRankings();
    res.json({ success: true, data: rankings });
  } catch (err) {
    console.error('Error fetching rankings:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
