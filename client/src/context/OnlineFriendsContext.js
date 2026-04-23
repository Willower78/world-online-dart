import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import socket from '../socket/socket';
import { useAuth } from './AuthContext';

const OnlineFriendsContext = createContext({
    onlineFriends: [],
    onlineFriendCount: 0,
});

export const useOnlineFriends = () => {
    return useContext(OnlineFriendsContext);
};

export const OnlineFriendsProvider = ({ children }) => {
    const { user } = useAuth();
    const [friends, setFriends] = useState([]);
    const [onlineFriendIds, setOnlineFriendIds] = useState(new Set());

    useEffect(() => {
        if (!user) {
            setFriends([]);
            setOnlineFriendIds(new Set());
            return;
        };

        const fetchFriends = async () => {
            try {
                const res = await axios.get('/api/friends');
                const friendsData = res.data.friends || [];
                setFriends(friendsData);
                const onlineIds = friendsData.filter(f => f.isOnline).map(f => f._id);
                setOnlineFriendIds(new Set(onlineIds));
            } catch (err) {
                console.error("Could not fetch friends list for context", err);
            }
        };
        fetchFriends();

        const handleFriendOnline = ({ userId }) => {
            setOnlineFriendIds(prevIds => new Set(prevIds).add(userId));
        };

        const handleFriendOffline = ({ userId }) => {
            setOnlineFriendIds(prevIds => {
                const newIds = new Set(prevIds);
                newIds.delete(userId);
                return newIds;
            });
        };

        socket.on('friend_online', handleFriendOnline);
        socket.on('friend_offline', handleFriendOffline);

        return () => {
            socket.off('friend_online', handleFriendOnline);
            socket.off('friend_offline', handleFriendOffline);
        };
    }, [user]);

    const onlineFriends = friends.filter(f => onlineFriendIds.has(f._id));

    const value = {
        onlineFriends,
        onlineFriendCount: onlineFriends.length
    };

    return (
        <OnlineFriendsContext.Provider value={value}>
            {children}
        </OnlineFriendsContext.Provider>
    );
};

export default OnlineFriendsContext;

