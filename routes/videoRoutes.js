const express = require('express');
const multer = require('multer');
const bunnyStreamService = require('../services/bunnyStreamService');
const authMiddleware = require('../middleware/validMiddleware');

const router = express.Router();

// Configure multer for video uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 2 * 1024 * 1024 * 1024, // 2GB limit
    },
    fileFilter: (req, file, cb) => {
        // Check file type
        const allowedMimes = [
            'video/mp4',
            'video/mpeg',
            'video/quicktime',
            'video/x-msvideo', // AVI
            'video/webm'
        ];

        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only MP4, MPEG, MOV, AVI, and WebM are allowed.'), false);
        }
    }
});

/**
 * @route POST /api/video/upload
 * @desc Upload video to Bunny Stream
 * @access Private (Admin only)
 */
router.post('/upload', authMiddleware, upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No video file provided'
            });
        }

        const { title, courseId, chapterId } = req.body;

        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Video title is required'
            });
        }

        // Upload to Bunny Stream
        const result = await bunnyStreamService.uploadVideoComplete(
            req.file.buffer,
            title,
            (progress, message) => {
                // You could implement real-time progress updates here using WebSockets
                console.log(`Upload progress: ${progress}% - ${message}`);
            }
        );

        res.status(200).json({
            success: true,
            message: 'Video uploaded successfully',
            data: {
                videoId: result.videoId,
                title: result.title,
                streamingUrl: result.streamingUrl, // iframe embed URL
                hlsUrl: result.hlsUrl, // HLS playlist URL
                thumbnailUrl: result.thumbnailUrl,
                status: result.status
            }
        });

    } catch (error) {
        console.error('Video upload error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to upload video'
        });
    }
});

/**
 * @route GET /api/video/status/:videoId
 * @desc Get video encoding status
 * @access Private
 */
router.get('/status/:videoId', authMiddleware, async (req, res) => {
    try {
        const { videoId } = req.params;

        const status = await bunnyStreamService.getEncodingStatus(videoId);

        res.status(200).json({
            success: true,
            data: status
        });

    } catch (error) {
        console.error('Get video status error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get video status'
        });
    }
});

/**
 * @route DELETE /api/video/:videoId
 * @desc Delete video from Bunny Stream
 * @access Private (Admin only)
 */
router.delete('/:videoId', authMiddleware, async (req, res) => {
    try {
        const { videoId } = req.params;

        await bunnyStreamService.deleteVideo(videoId);

        res.status(200).json({
            success: true,
            message: 'Video deleted successfully'
        });

    } catch (error) {
        console.error('Delete video error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete video'
        });
    }
});

/**
 * @route GET /api/video/:videoId
 * @desc Get video details
 * @access Private
 */
router.get('/:videoId', authMiddleware, async (req, res) => {
    try {
        const { videoId } = req.params;

        const video = await bunnyStreamService.getVideo(videoId);
        const streamingUrl = bunnyStreamService.generateStreamingUrl(videoId);
        const hlsUrl = bunnyStreamService.generateHLSUrl(videoId);
        const thumbnailUrl = bunnyStreamService.generateThumbnailUrl(videoId);

        res.status(200).json({
            success: true,
            data: {
                ...video,
                streamingUrl, // iframe embed URL
                hlsUrl, // HLS playlist URL
                thumbnailUrl
            }
        });

    } catch (error) {
        console.error('Get video error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get video details'
        });
    }
});

module.exports = router;
