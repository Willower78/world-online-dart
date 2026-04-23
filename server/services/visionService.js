const axios = require('axios');
const gameStateManager = require('./gameStateManager');

// The URL for the Python AI service, configurable via environment variables
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001/detect';

/**
 * Returns a function to handle the video frame event from a client.
 * This function forwards the frame to the AI service for processing.
 * @param {object} io - The main socket.io server instance.
 * @param {object} socket - The socket.io socket object for the client.
 * @returns {function} An async function that processes the frame.
 */
const handleFrame = (io, socket) => async ({ image, calibration, gameId: payloadGameId }) => {
    try {
        // Forward the image data to the AI service
        const response = await axios.post(AI_SERVICE_URL, {
            image: image,
        });

        const detection = response.data;

        // If the AI service returns a valid detection, send it to the game state manager.
        if (detection && detection.score != null) {
            console.log(`[visionService] AI detection result: Score ${detection.score}, Segment: ${detection.segment}`);

            // Prefer an explicit gameId from the frame payload; fall back to whatever
            // game the socket last joined.
            const gameId = payloadGameId || socket.gameId;
            const userId = socket.userId;

            if (gameId && userId) {
                // Register the throw with the game state manager, which will handle all game logic
                await gameStateManager.registerThrow(gameId, userId, detection.score, detection.segment, io);
            } else {
                console.error(`[visionService] Received frame from socket ${socket.id} but gameId or userId was not found on the socket.`);
            }
        }

    } catch (error) {
        // Log errors gracefully without crashing the server
        if (error.code === 'ECONNREFUSED') {
            console.error(`[visionService] Connection to AI service at ${AI_SERVICE_URL} failed. Is the service running?`);
            // Optionally, notify the client about the issue
            socket.emit('ai-service-error', { message: 'The AI scoring service is currently unavailable.' });
        } else if (error.response) {
            // The AI service responded with an error status (4xx, 5xx)
            console.error(`[visionService] AI service responded with error: ${error.response.status}`, error.response.data);
        } else {
            // A different kind of error occurred
            console.error('[visionService] An unexpected error occurred while communicating with the AI service:', error.message);
        }
    }
};

module.exports = {
    handleFrame,
};