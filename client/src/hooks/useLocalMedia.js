import { useState, useEffect, useRef } from 'react';

export const useLocalMedia = (selectedAudioDevice, selectedVideoDevice) => {
    const [localStream, setLocalStream] = useState(null);
    const localVideoRef = useRef(null);
    const [isAudioMuted, setIsAudioMuted] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);

    useEffect(() => {
        const startMedia = async () => {
            if (selectedAudioDevice && selectedVideoDevice) {
                try {
                    const constraints = {
                        video: {
                            deviceId: { exact: selectedVideoDevice },
                            width: { ideal: 1280 },
                            height: { ideal: 720 },
                            frameRate: { ideal: 30 }
                        },
                        audio: {
                            deviceId: { exact: selectedAudioDevice },
                            echoCancellation: true,
                            noiseSuppression: true
                        }
                    };
                    const stream = await navigator.mediaDevices.getUserMedia(constraints);
                    setLocalStream(stream);
                    if (localVideoRef.current) {
                        localVideoRef.current.srcObject = stream;
                    }
                } catch (error) {
                    console.error("Could not access camera/microphone.", error);
                }
            }
        };

        startMedia();

        return () => {
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedAudioDevice, selectedVideoDevice]);

    const toggleAudio = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
                setIsAudioMuted(!track.enabled);
            });
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled;
                setIsVideoEnabled(track.enabled);
            });
        }
    };

    return {
        localStream,
        localVideoRef,
        isAudioMuted,
        isVideoEnabled,
        toggleAudio,
        toggleVideo
    };
};
