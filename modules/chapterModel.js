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
  },
  fileName: {
    type: String,
    required: false,
    default: ''
  },
  fileUrl: {
    type: String,
  },
  isFree: {
    type: Boolean,
    default: false,
  },
  // Bunny Stream specific fields
  bunnyStreamVideoId: {
    type: String,
    required: false,
  },
  thumbnailUrl: {
    type: String,
    required: false,
  },
  hlsUrl: {
    type: String,
    required: false,
  },
  videoStatus: {
    type: String,
    enum: ['uploading', 'processing', 'ready', 'error'],
    default: 'ready'
  },
  videoDuration: {
    type: Number, // in seconds
    required: false,
  },
  videoSize: {
    type: Number, // in bytes
    required: false,
  }
});

const chapterSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  lessons: [lessonSchema], // دروس داخل الفصل
}, {
  timestamps: true,
});

module.exports = mongoose.model("Chapter", chapterSchema);
