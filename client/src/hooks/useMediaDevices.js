import { useState, useEffect, useCallback } from 'react';

const useMediaDevices = () => {
    const [devices, setDevices] = useState({ audio: [], video: [] });
    const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
    const [selectedVideoDevice, setSelectedVideoDevice] = useState('');
    const [error, setError] = useState(null);

    const getDevices = useCallback(async () => {
        try {
            // Ensure permissions are granted before enumerating
            await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            const allDevices = await navigator.mediaDevices.enumerateDevices();
            const audioDevices = allDevices.filter(device => device.kind === 'audioinput');
            const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
            
            setDevices({ audio: audioDevices, video: videoDevices });

            // Set default device if not already set
            if (audioDevices.length > 0 && !selectedAudioDevice) {
                setSelectedAudioDevice(audioDevices[0].deviceId);
            }
            if (videoDevices.length > 0 && !selectedVideoDevice) {
                setSelectedVideoDevice(videoDevices[0].deviceId);
            }
        } catch (err) {
            console.error("Error enumerating devices:", err);
            setError("Could not access camera or microphone. Please check permissions.");
        }
    }, [selectedAudioDevice, selectedVideoDevice]);

    useEffect(() => {
        getDevices();
        // Listen for changes in device availability
        navigator.mediaDevices.addEventListener('devicechange', getDevices);

        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', getDevices);
        };
    }, [getDevices]);

    return {
        devices,
        selectedAudioDevice,
        selectedVideoDevice,
        setSelectedAudioDevice,
        setSelectedVideoDevice,
        error
    };
};

export default useMediaDevices;
