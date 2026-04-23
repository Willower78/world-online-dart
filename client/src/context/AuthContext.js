import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import socket from '../socket/socket';

const AuthContext = createContext(null);

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadUser = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                axios.defaults.headers.common['x-auth-token'] = token;
                try {
                    const res = await axios.get('/api/users/me'); // We will create this endpoint
                    setUser(res.data);
                    socket.emit('user_online', { userId: res.data._id, username: res.data.username });
                } catch (err) {
                    console.error("AuthContext: Could not load user.", err);
                    logout(); // Token is invalid or expired
                }
            }
            setLoading(false);
        };
        loadUser();
    }, []);
    
    const login = (userData) => {
        localStorage.setItem('token', userData.token);
        axios.defaults.headers.common['x-auth-token'] = userData.token;
        setUser(userData.user);
        socket.emit('user_online', { userId: userData.user._id, username: userData.user.username });
    };

    const logout = () => {
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['x-auth-token'];
        setUser(null);
        // We might want to emit a 'user_offline' event here
    };

    const value = {
        user,
        setUser,
        login,
        logout,
        isAuthenticated: !!user,
        isSubscriber: user?.subscriptionStatus === 'active',
        isAdmin: user?.isAdmin || false,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
