import { useRef, useEffect, useState, useCallback } from 'react';
import socket from '../socket/socket';

// ICE servers: STUN alone is enough for most home users; a TURN server is
// required for anyone behind symmetric NAT (often cellular / some corporate
// networks). In production, set one of these at build time:
//   - REACT_APP_ICE_SERVERS: a JSON array of RTCIceServer objects.
//   - REACT_APP_TURN_URL/USERNAME/CREDENTIAL: shorthand for a single TURN entry
//     (Metered / Twilio / self-hosted coturn).
// If none are set we fall back to Google's public STUN + the `openrelay`
// public TURN. openrelay is rate-limited and unreliable — do NOT rely on it
// for anything real.
const buildIceServers = () => {
    if (process.env.REACT_APP_ICE_SERVERS) {
        try {
            const parsed = JSON.parse(process.env.REACT_APP_ICE_SERVERS);
            if (Array.isArray(parsed) && parsed.length) return parsed;
        } catch (err) {
            console.warn('[WebRTC] REACT_APP_ICE_SERVERS is not valid JSON; ignoring.', err);
        }
    }

    const servers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ];

    if (process.env.REACT_APP_TURN_URL) {
        servers.push({
            urls: process.env.REACT_APP_TURN_URL,
            username: process.env.REACT_APP_TURN_USERNAME || '',
            credential: process.env.REACT_APP_TURN_CREDENTIAL || '',
        });
        return servers;
    }

    // Dev fallback — unreliable but lets things work out of the box.
    servers.push(
        { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    );
    return servers;
};

const PEER_CONNECTION_CONFIG = { iceServers: buildIceServers() };

export const useWebRTC = (roomName, localStream) => {
    const [remoteStreams, setRemoteStreams] = useState({});
    const [connectionStates, setConnectionStates] = useState({});
    const peerConnectionsRef = useRef({});
    const isInitiatorRef = useRef(false);

    const closePeerConnection = useCallback((userId) => {
        if (peerConnectionsRef.current[userId]) {
            console.log(`[WebRTC] Closing connection to ${userId}`);
            peerConnectionsRef.current[userId].close();
            delete peerConnectionsRef.current[userId];
            
            setRemoteStreams(prev => {
                const newStreams = { ...prev };
                delete newStreams[userId];
                return newStreams;
            });
            setConnectionStates(prev => {
                const newStates = { ...prev };
                delete newStates[userId];
                return newStates;
            });
        }
    }, []);

    const createPeerConnection = useCallback((targetId) => {
        if (peerConnectionsRef.current[targetId]) {
            return peerConnectionsRef.current[targetId];
        }
        console.log(`[WebRTC] Creating new peer connection for ${targetId}`);
        const pc = new RTCPeerConnection(PEER_CONNECTION_CONFIG);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('webrtc-ice-candidate', { to: targetId, candidate: event.candidate });
            }
        };

        pc.ontrack = (event) => {
            console.log(`[WebRTC] Received remote track from ${targetId}`);
            setRemoteStreams(prev => ({ ...prev, [targetId]: event.streams[0] }));
        };

        pc.onconnectionstatechange = () => {
            const state = pc.connectionState;
            console.log(`[WebRTC] Connection state for ${targetId} changed to: ${state}`);
            setConnectionStates(prev => ({ ...prev, [targetId]: state }));

            if (state === 'failed' || state === 'disconnected') {
                 if (isInitiatorRef.current) {
                    console.warn(`[WebRTC] Peer connection to ${targetId} is ${state}. Attempting ICE restart.`);
                    pc.createOffer({ iceRestart: true })
                        .then(offer => pc.setLocalDescription(offer))
                        .then(() => {
                             socket.emit('webrtc-offer', { to: targetId, offer: pc.localDescription });
                        })
                        .catch(err => console.error("[WebRTC] ICE restart offer failed:", err));
                 }
            }
        };
        
        if (localStream) {
            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });
        }

        peerConnectionsRef.current[targetId] = pc;
        return pc;
    }, [localStream]);

    useEffect(() => {
        if (!roomName || !localStream) return;
        
        console.log(`[WebRTC] Setting up for room: ${roomName}`);
        socket.emit('join-video-room', roomName);

        const handleUserConnected = (userId) => {
            if(userId === socket.id) return;
            console.log(`[WebRTC] User ${userId} connected, I will initiate the connection.`);
            isInitiatorRef.current = true;
            const pc = createPeerConnection(userId);
            pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .then(() => {
                    socket.emit('webrtc-offer', { to: userId, offer: pc.localDescription });
                })
                .catch(e => console.error("[WebRTC] Offer creation failed:", e));
        };

        const handleOffer = ({ offer, from }) => {
            console.log(`[WebRTC] Received offer from ${from}, creating answer...`);
            isInitiatorRef.current = false;
            const pc = createPeerConnection(from);
            pc.setRemoteDescription(new RTCSessionDescription(offer))
                .then(() => pc.createAnswer())
                .then(answer => pc.setLocalDescription(answer))
                .then(() => {
                    socket.emit('webrtc-answer', { to: from, answer: pc.localDescription });
                })
                .catch(e => console.error("[WebRTC] Answer creation failed:", e));
        };

        const handleAnswer = ({ answer, from }) => {
            console.log(`[WebRTC] Received answer from ${from}.`);
            const pc = peerConnectionsRef.current[from];
            if (pc) {
                pc.setRemoteDescription(new RTCSessionDescription(answer))
                  .catch(e => console.error("[WebRTC] Setting remote description failed:", e));
            }
        };

        const handleIceCandidate = ({ candidate, from }) => {
            const pc = peerConnectionsRef.current[from];
            if (pc && candidate) {
                pc.addIceCandidate(new RTCIceCandidate(candidate))
                  .catch(e => console.error("[WebRTC] Adding ICE candidate failed:", e));
            }
        };

        const handleUserLeft = (userId) => {
            console.log(`[WebRTC] User ${userId} left the video room.`);
            closePeerConnection(userId);
        };

        socket.on('video-user-connected', handleUserConnected);
        socket.on('video-user-left', handleUserLeft);
        socket.on('webrtc-offer', handleOffer);
        socket.on('webrtc-answer', handleAnswer);
        socket.on('webrtc-ice-candidate', handleIceCandidate);

        return () => {
            console.log("[WebRTC] Cleaning up WebRTC hook.");
            socket.emit('video-user-left', roomName);
            Object.keys(peerConnectionsRef.current).forEach(closePeerConnection);
            socket.off('video-user-connected', handleUserConnected);
            socket.off('video-user-left', handleUserLeft);
            socket.off('webrtc-offer', handleOffer);
            socket.off('webrtc-answer', handleAnswer);
            socket.off('webrtc-ice-candidate', handleIceCandidate);
        };

    }, [roomName, localStream, createPeerConnection, closePeerConnection]);

    return { remoteStreams, connectionStates };
};
