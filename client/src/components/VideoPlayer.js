import React, { useRef, useEffect, forwardRef } from 'react';

const VideoPlayer = forwardRef(({ stream, muted = false }, ref) => {
    const internalRef = useRef(null);
    const videoRef = ref || internalRef;

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream, videoRef]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={muted}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
    );
});

export default VideoPlayer;
