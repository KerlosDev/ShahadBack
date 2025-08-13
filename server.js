const express = require("express");
const dbconnection = require("./config/database");
const cors = require("cors");
const dotenv = require("dotenv");

const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const activitionRoutes = require("./routes/activitionRoutes");
const activePackageRoutes = require("./routes/activePackageRoutes");
const chapterRoutes = require("./routes/chapterRoutes");
const examRoutes = require("./routes/examRoutes");
const studentExamRoutes = require("./routes/studentExamRoutes");
const courseRoutes = require("./routes/courseRoutes");
const examResultsRouter = require("./routes/examResultsRoutes");
const watchHistoryRoutes = require("./routes/watchHistoryRoutes");
const rankRouter = require("./routes/rankRouter");
const analyticsRoutes = require("./routes/analyticsRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const offerRoutes = require("./routes/offerRoutes");
const statsRoutes = require("./routes/statsRoutes");
const bookRoutes = require("./routes/bookRoutes");
const bookOrderRoutes = require("./routes/bookOrderRoutes");
const courseAnalyticsRoutes = require("./routes/courseAnalyticsRoutes");
const courseWithEnrollmentRoutes = require("./routes/courseWithEnrollmentRoutes");
const packageRoutes = require("./routes/packageRoutes");
const videoRoutes = require("./routes/videoRoutes");

const dashboardStatsRoutes = require("./routes/dashboardStatsRoutes");
const studentRatingRoutes = require("./routes/studentRatingRoutes");



dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

dbconnection();

// ✅ Middleware
app.use(cors({
  origin: ["http://localhost:3000", "https://www.shahadhany.site", "http://192.168.1.3:3000"],

  credentials: true,
}));

app.use(express.json({ limit: '2gb' }));
app.use(express.urlencoded({ limit: '2gb', extended: true }));

app.use('/auth', authRoutes);
app.use('/active', activitionRoutes);
app.use('/active-package', activePackageRoutes);
app.use('/chapter', chapterRoutes);
app.use('/exam', examRoutes);
app.use('/student-exam', studentExamRoutes);
app.use('/course', courseRoutes);
app.use('/dashboard', dashboardStatsRoutes);
app.use('/user', userRoutes);
app.use('/examResult', examResultsRouter);
app.use('/watchHistory', watchHistoryRoutes);
app.use('/rank', rankRouter);
app.use('/analytics', analyticsRoutes);
app.use('/notifications', notificationRoutes);
app.use('/offers', offerRoutes);
app.use('/stats', statsRoutes);
app.use('/books', bookRoutes);
app.use('/book-orders', bookOrderRoutes);
app.use('/course-analytics', courseAnalyticsRoutes);
app.use('/course-data', courseWithEnrollmentRoutes);
app.use('/packages', packageRoutes);
app.use('/video', videoRoutes);

// Student rating routes
app.use('/student-ratings', studentRatingRoutes);


app.listen(PORT, '0.0.0.0', () => {
  console.log(`The server is running on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Network: http://192.168.1.3:${PORT}`);
});
