const axios = require('axios');
const FormData = require('form-data');

class BunnyStreamService {
    constructor() {
        this.apiKey = process.env.BUNNY_STREAM_API_KEY;
        this.libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
        this.baseUrl = process.env.BUNNY_STREAM_BASE_URL || 'https://video.bunnycdn.com';
        this.pullZone = process.env.BUNNY_STREAM_PULL_ZONE;

        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'AccessKey': this.apiKey,
                'Accept': 'application/json'
            }
        });
    }

    /**
     * Create a new video entry in Bunny Stream
     * @param {string} title - Video title
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Video object with ID and details
     */
    async createVideo(title, options = {}) {
        try {
            const videoData = {
                title: title,
                collectionId: options.collectionId || '',
                thumbnailTime: options.thumbnailTime || 0
            };

            const response = await this.client.post(`/library/${this.libraryId}/videos`, videoData);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to create video: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Upload video file to Bunny Stream
     * @param {string} videoId - Video ID from createVideo
     * @param {Buffer} fileBuffer - Video file buffer
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Object>} Upload result
     */
    async uploadVideo(videoId, fileBuffer, onProgress) {
        try {
            const response = await this.client.put(
                `/library/${this.libraryId}/videos/${videoId}`,
                fileBuffer,
                {
                    headers: {
                        'Content-Type': 'application/octet-stream'
                    },
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity,
                    onUploadProgress: (progressEvent) => {
                        if (onProgress) {
                            const percentCompleted = Math.round(
                                (progressEvent.loaded * 100) / progressEvent.total
                            );
                            onProgress(percentCompleted);
                        }
                    }
                }
            );
            return response.data;
        } catch (error) {
            throw new Error(`Failed to upload video: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Get video details
     * @param {string} videoId - Video ID
     * @returns {Promise<Object>} Video details
     */
    async getVideo(videoId) {
        try {
            const response = await this.client.get(`/library/${this.libraryId}/videos/${videoId}`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get video: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Delete video from Bunny Stream
     * @param {string} videoId - Video ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteVideo(videoId) {
        try {
            await this.client.delete(`/library/${this.libraryId}/videos/${videoId}`);
            return true;
        } catch (error) {
            throw new Error(`Failed to delete video: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Generate streaming URL for video (iframe embed format)
     * @param {string} videoId - Video ID
     * @returns {string} Iframe embed URL
     */
    generateStreamingUrl(videoId) {
        return `https://iframe.mediadelivery.net/embed/${this.libraryId}/${videoId}`;
    }

    /**
     * Generate HLS streaming URL for video
     * @param {string} videoId - Video ID
     * @returns {string} HLS streaming URL
     */
    generateHLSUrl(videoId) {
        return `https://${this.pullZone}/${videoId}/playlist.m3u8`;
    }

    /**
     * Generate thumbnail URL for video
     * @param {string} videoId - Video ID
     * @returns {string} Thumbnail URL
     */
    generateThumbnailUrl(videoId) {
        return `https://${this.pullZone}/${videoId}/thumbnail.jpg`;
    }

    /**
     * Get video encoding status
     * @param {string} videoId - Video ID
     * @returns {Promise<Object>} Encoding status
     */
    async getEncodingStatus(videoId) {
        try {
            const video = await this.getVideo(videoId);
            return {
                status: video.status,
                encodeProgress: video.encodeProgress,
                width: video.width,
                height: video.height,
                length: video.length
            };
        } catch (error) {
            throw new Error(`Failed to get encoding status: ${error.message}`);
        }
    }

    /**
     * Upload video with automatic processing
     * @param {Buffer} fileBuffer - Video file buffer
     * @param {string} title - Video title
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Object>} Complete video data with URLs
     */
    async uploadVideoComplete(fileBuffer, title, onProgress) {
        try {
            // Step 1: Create video entry
            if (onProgress) onProgress(5, 'Creating video entry...');
            const video = await this.createVideo(title);

            // Step 2: Upload file
            if (onProgress) onProgress(10, 'Uploading video file...');
            await this.uploadVideo(video.guid, fileBuffer, (progress) => {
                // Map upload progress to 10-90%
                const mappedProgress = 10 + (progress * 0.8);
                if (onProgress) onProgress(mappedProgress, 'Uploading video file...');
            });

            // Step 3: Generate URLs
            if (onProgress) onProgress(95, 'Generating streaming URLs...');
            const streamingUrl = this.generateStreamingUrl(video.guid);
            const hlsUrl = this.generateHLSUrl(video.guid);
            const thumbnailUrl = this.generateThumbnailUrl(video.guid);

            const result = {
                videoId: video.guid,
                title: video.title,
                streamingUrl, // iframe embed URL
                hlsUrl, // HLS playlist URL
                thumbnailUrl,
                status: 'uploaded',
                bunnyStreamData: video
            };

            if (onProgress) onProgress(100, 'Upload completed successfully!');
            return result;

        } catch (error) {
            throw error;
        }
    }
}

module.exports = new BunnyStreamService();
