import { useEffect, useRef } from 'react';
import socket from '../socket/socket';

const useFrameSubmission = (localVideoRef, calibration, isMyTurn) => {
    const canvasRef = useRef(document.createElement('canvas'));

    useEffect(() => {
        const frameSubmissionInterval = setInterval(() => {
            if (isMyTurn && localVideoRef.current && calibration) {
                const video = localVideoRef.current;
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');

                // Match canvas size to video dimensions
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;

                // Draw the current video frame onto the canvas
                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                // Get the image data as a base64 encoded string
                const imageData = canvas.toDataURL('image/jpeg', 0.5); // 50% quality for performance

                // Emit to the server
                socket.emit('video-frame', {
                    image: imageData,
                    calibration: calibration,
                });
            }
        }, 1000); // Send one frame per second

        return () => clearInterval(frameSubmissionInterval); // Cleanup the interval
    }, [localVideoRef, calibration, isMyTurn]);
};

export default useFrameSubmission;
