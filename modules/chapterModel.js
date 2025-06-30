const mongoose = require("mongoose");

const lessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  videoUrl: {
    type: String,
    required: true,
  }
});

const chapterSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  lessons: [lessonSchema], //  داخل الفصل
}, {
  timestamps: true,
});

module.exports = mongoose.model("Chapter", chapterSchema);
