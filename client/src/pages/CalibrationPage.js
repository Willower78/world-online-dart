import React, { useState, useRef, useEffect } from 'react';
import { useLocalMedia } from '../hooks/useLocalMedia';
import useMediaDevices from '../hooks/useMediaDevices';
import socket from '../socket/socket';
import styles from './CalibrationPage.module.css';
import TopHeader from '../components/TopHeader';
import { useOutletContext } from 'react-router-dom';
import Spinner from '../components/Spinner';

const CalibrationPage = () => {
    const { 
        devices, 
        selectedAudioDevice, 
        selectedVideoDevice, 
        setSelectedAudioDevice, 
        setSelectedVideoDevice, 
        error: deviceError 
    } = useMediaDevices();
    
    const { stream } = useLocalMedia(selectedAudioDevice, selectedVideoDevice);
    
    const videoRef = useRef(null);
    const [points, setPoints] = useState([]);
    const [calibrationStatus, setCalibrationStatus] = useState('Not calibrated');
    const { onMenuClick } = useOutletContext();

    useEffect(() => {
        if (stream && videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    useEffect(() => {
        const handleCalibrationSaved = (data) => {
            if (data.success) {
                setCalibrationStatus(`Calibrated successfully at ${new Date(data.calibration.calibratedAt).toLocaleTimeString()}`);
                alert('Calibration saved successfully!');
            } else {
                setCalibrationStatus('Calibration failed.');
                alert('Failed to save calibration.');
            }
        };

        socket.on('calibration-saved', handleCalibrationSaved);
        
        return () => {
            socket.off('calibration-saved', handleCalibrationSaved);
        };
    }, []);

    const handleVideoClick = (e) => {
        if (points.length >= 4) {
            alert("You have already selected 4 points. Please reset if you want to select new ones.");
            return;
        }

        const rect = videoRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const normalizedX = x / rect.width;
        const normalizedY = y / rect.height;

        setPoints([...points, { x: normalizedX, y: normalizedY }]);
    };

    const handleReset = () => {
        setPoints([]);
    };

    const handleSave = () => {
        if (points.length !== 4) {
            alert('Please select exactly 4 corner points for the dartboard.');
            return;
        }
        console.log('Sending calibration data:', points);
        socket.emit('camera-calibration', points);
    };
    
    if (deviceError) {
        return (
             <>
                <TopHeader title="ERROR" onMenuClick={onMenuClick} />
                <div className={styles.calibrationContainer}>
                    <h1>Camera/Microphone Error</h1>
                    <p style={{ color: '#f04444' }}>{deviceError}</p>
                    <p>Please allow access to your camera and microphone in your browser settings and refresh the page.</p>
                </div>
            </>
        );
    }

    return (
        <>
            <TopHeader title="KAMERAKALIBRERING" onMenuClick={onMenuClick} />
            <div className={styles.calibrationContainer}>
                <h1>Dartboard Calibration</h1>
                <p>Click on the four corners of the dartboard in the video feed below. Start with the top-left corner and continue clockwise.</p>

                <div className={styles.deviceSelectors}>
                    <div className={styles.selectWrapper}>
                        <label htmlFor="video-device">Camera:</label>
                        <select id="video-device" value={selectedVideoDevice} onChange={e => setSelectedVideoDevice(e.target.value)}>
                            {devices.video.map(device => (
                                <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
                            ))}
                        </select>
                    </div>
                     <div className={styles.selectWrapper}>
                        <label htmlFor="audio-device">Microphone:</label>
                        <select id="audio-device" value={selectedAudioDevice} onChange={e => setSelectedAudioDevice(e.target.value)}>
                            {devices.audio.map(device => (
                                <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className={styles.videoWrapper}>
                    {!stream ? <Spinner /> : (
                        <video ref={videoRef} autoPlay playsInline muted className={styles.videoFeed} onClick={handleVideoClick}></video>
                    )}
                    {points.map((point, index) => (
                        <div
                            key={index}
                            className={styles.pointMarker}
                            style={{
                                left: `${point.x * 100}%`,
                                top: `${point.y * 100}%`,
                            }}
                        >
                            {index + 1}
                        </div>
                    ))}
                </div>

                <div className={styles.controls}>
                    <button onClick={handleSave} className={styles.btn} disabled={points.length !== 4}>Save Calibration</button>
                    <button onClick={handleReset} className={styles.btn}>Reset Points</button>
                </div>
                <div className={styles.status}>
                    <p>Points selected: {points.length} / 4</p>
                    <p>Status: <span className={styles.statusText}>{calibrationStatus}</span></p>
                </div>
                 <div className={styles.instructions}>
                    <h2>Instructions</h2>
                    <ol>
                        <li>Make sure your dartboard is well-lit and fully visible in the camera feed.</li>
                        <li>Click on the four corners of the dartboard itself (not the cabinet).</li>
                        <li>Order: 1. Top-Left, 2. Top-Right, 3. Bottom-Right, 4. Bottom-Left.</li>
                        <li>Once four points are selected, click "Save Calibration".</li>
                    </ol>
                </div>
            </div>
        </>
    );
};

export default CalibrationPage;
