const express = require("express");
const dbconnection = require("./config/database");
const cors = require("cors");
const dotenv = require("dotenv");
const expressRateLimit = require("express-rate-limit");

const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const activitionRoutes = require("./routes/activitionRoutes");
const chapterRoutes = require("./routes/chapterRoutes");
const examRoutes = require("./routes/examRoutes");
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

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

dbconnection();

// ✅ Middleware
app.use(cors({
  origin: ["http://localhost:3000", "https://waltere.vercel.app"],
  credentials: true,
}));

app.use(express.json());

// Rate Limiting Middleware
/* const limiter = expressRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(limiter); */

app.use('/auth', authRoutes);
app.use('/active', activitionRoutes);
app.use('/chapter', chapterRoutes);
app.use('/exam', examRoutes);
app.use('/course', courseRoutes);
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

app.listen(PORT, () => {
  console.log(`The server is running on port ${PORT}`);
});
