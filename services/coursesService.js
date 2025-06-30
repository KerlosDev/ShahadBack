const axios = require("axios");
const Course = require("../modules/courseModule");
const expressAsyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
// ✅ رفع صورة إلى ImgBB
const uploadToImgBB = async (buffer) => {
  try {
    const apiKey = process.env.IMGBB_API_KEY || '192530c1c337c43e5cc555d3dfd0ec3d';
    const base64Image = buffer.toString('base64');

    const formData = new URLSearchParams();
    formData.append('key', apiKey);
    formData.append('image', base64Image);

    const response = await axios.post("https://api.imgbb.com/1/upload", formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return response.data.data.url;
  } catch (error) {
    console.error("ImgBB Upload Error:", error.response?.data || error.message);
    throw new Error("فشل رفع صورة الكورس إلى ImgBB");
  }
};

// ✅ إنشاء كورس جديد
const createCourseWithImage = async (body, imageFile = null) => {
  let imageUrl = body.imageUrl || null;

  if (imageFile) {
    imageUrl = await uploadToImgBB(imageFile.buffer);
  }

  const chapters = body.chapters ? JSON.parse(body.chapters) : [];
  const exams = body.exams ? JSON.parse(body.exams) : [];

  const course = await Course.create({
    name: body.name,
    description: body.description,
    imageUrl,
    price: body.isFree === "true" ? 0 : Number(body.price),
    isFree: body.isFree === "true",
    level: body.level,
    chapters,
    exams,
    isDraft: body.isDraft === "true" || body.isDraft === true // <-- Add this line
  });

  return course;
};

// ✅ جلب كل الكورسات أو كورس واحد
const getCourses = async (req, res) => {

  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const courses = await Course.find().skip(skip).limit(parseInt(limit));
  res.status(200).json({
    results: courses.length,
    page: +page,
    courses,
  });


};

const getAllCoursesForAdmin = async (req, res) => {
  try {
    const courses = await Course.find()
      .select('name description price isFree level isDraft createdAt')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: courses.length,
      courses
    });
  } catch (error) {
    console.error("Get All Courses Error:", error);
    res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء جلب الكورسات"
    });
  }
};

// ✅ تحديث كورس
const updateCourse = async (courseId, body, imageFile = null) => {
  const course = await Course.findById(courseId);
  if (!course) throw new Error("الكورس غير موجود");

  let imageUrl = course.imageUrl;

  if (imageFile) {
    imageUrl = await uploadToImgBB(imageFile.buffer);
  }

  const chapters = body.chapters ? JSON.parse(body.chapters) : course.chapters;
  const exams = body.exams ? JSON.parse(body.exams) : course.exams;

  course.name = body.name || course.name;
  course.description = body.description || course.description;
  course.imageUrl = imageUrl;
  course.price = body.isFree === "true" ? 0 : Number(body.price);
  course.isFree = body.isFree === "true";
  course.level = body.level || course.level;
  course.chapters = chapters;
  course.exams = exams;
  if (typeof body.isDraft !== "undefined") {
    course.isDraft = body.isDraft === "true" || body.isDraft === true; // <-- Add this line
  }

  await course.save();

  return course;
};

// ✅ حذف كورس
const deleteCourse = async (courseId) => {
  const course = await Course.findByIdAndDelete(courseId);
  if (!course) throw new Error("فشل حذف الكورس، الكورس غير موجود");
  return course;
};


const getCourseById = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "رابط الكورس غير صالح (ID غير صحيح)." });
  }

  const course = await Course.findById(id)
    .populate({
      path: 'chapters',
      select: 'title lessons',
      populate: {
        path: 'lessons',
        select: 'title fileName',
      }

    })
    .populate({
      path: 'exams',
      select: 'title',
    });

  if (!course) {
    return res.status(404).json({ message: "الكورس غير موجود." });
  }

  const formattedCourse = {
    ...course.toObject(),
    chapters: course.chapters.map(chapter => ({
      _id: chapter._id,
      title: chapter.title,
      lessons: chapter.lessons.map(lesson => ({
        _id: lesson._id,
        title: lesson.title,
        fileName: lesson.fileName // <-- include fileName in response
      }))
    }))
  };

  res.status(200).json(formattedCourse);
};


const getCourseByIdAdmin = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "رابط الكورس غير صالح (ID غير صحيح)." });
  }

  const course = await Course.findById(id)
    .populate({ path: 'chapters' })
    .populate({ path: 'exams' });

  if (!course) {
    return res.status(404).json({ message: "الكورس غير موجود." });
  }

  res.status(200).json(course);
};




module.exports = {
  uploadToImgBB,
  createCourseWithImage: expressAsyncHandler(createCourseWithImage),
  getCourses: expressAsyncHandler(getCourses),
  updateCourse: expressAsyncHandler(updateCourse),
  getCourseById: expressAsyncHandler(getCourseById),
  getCourseByIdAdmin: expressAsyncHandler(getCourseByIdAdmin),
  deleteCourse: expressAsyncHandler(deleteCourse),
  getAllCoursesForAdmin: expressAsyncHandler(getAllCoursesForAdmin),
};
