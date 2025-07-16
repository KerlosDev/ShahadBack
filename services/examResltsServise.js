const StudentExamResult = require('../modules/examResultSchema.js');

// ✅ Add or update an exam result
const saveExamResult = async (studentId, examData) => {
  const existingRecord = await StudentExamResult.findOne({ studentId });

  if (existingRecord) {
    const prevAttempts = existingRecord.results.filter(r => r.examTitle === examData.examTitle).length;
    examData.attemptNumber = prevAttempts + 1;

    existingRecord.results.push(examData);
    return await existingRecord.save();
  } else {
    examData.attemptNumber = 1;

    const newRecord = new StudentExamResult({
      studentId,
      results: [examData]
    });

    return await newRecord.save();
  }
};

// ✅ Get all results for a specific student
const getResultsByStudent = async (studentId) => {
  const results = await StudentExamResult.findOne({ studentId }).populate('studentId', 'name email');
  if (!results) {
    return {
      studentId: { name: '', email: '' },
      results: []
    };
  }
  return results;
};

// ✅ Get all attempts for a specific exam title (for a student)
const getExamHistory = async (studentId, examTitle) => {
  const record = await StudentExamResult.findOne({ studentId });
  if (!record) return [];

  return record.results.filter(result => result.examTitle === examTitle);
};

// ✅ Get all exam results for all students
const getAllExamResults = async () => {
  const results = await StudentExamResult.find()
    .populate('studentId', 'name email')
    .sort({ createdAt: -1 });

  // Filter out results where studentId is null (deleted users)
  return results.filter(result => result.studentId && result.studentId._id);
};

// ✅ حساب ترتيب الطلاب بناءً على متوسط درجاتهم
const getStudentsRankings = async () => {
  const all = await StudentExamResult.find().populate('studentId', 'name email');

  const studentsWithScores = all
    .filter(student => student.studentId && student.studentId._id) // Filter out null studentId
    .map(student => {
      let totalCorrect = 0;
      let totalQuestions = 0;

      student.results.forEach(result => {
        totalCorrect += result.correctAnswers;
        totalQuestions += result.totalQuestions;
      });

      const score = totalQuestions > 0 ? totalCorrect / totalQuestions : 0;

      return {
        studentId: student.studentId._id,
        name: student.studentId.name,
        email: student.studentId.email,
        score: score,
        percentage: Math.round(score * 100)
      };
    });

  const sorted = studentsWithScores.sort((a, b) => b.score - a.score);

  return sorted;
};

// ✅ البحث عن ترتيب طالب معين
const getStudentRankById = async (targetId) => {
  try {
    const rankings = await getStudentsRankings();

    const index = rankings.findIndex(r => r.studentId && r.studentId.toString() === targetId.toString());

    if (index === -1) return null;

    return {
      rank: index + 1,
      ...rankings[index]
    };
  } catch (error) {
    console.error('Error in getStudentRankById:', error);
    throw error;
  }
};

// ✅ تصدير جميع الدوال
module.exports = {
  saveExamResult,
  getResultsByStudent,
  getExamHistory,
  getAllExamResults,
  getStudentsRankings,
  getStudentRankById
};
