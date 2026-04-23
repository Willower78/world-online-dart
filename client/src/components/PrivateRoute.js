import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from './Spinner';

// Auth-only route guard. Use for pages that require a logged-in user but are
// NOT gated behind a paid subscription — e.g. `/game/:gameId`, which includes
// free-tier practice games like Bob's 27 and bot games.
// Subscription-gated matchmaking (501 / Cricket / 301 DIDO find_match) is
// gated at the Lobby button level, so by the time a user reaches the game
// route the subscription check has already been applied where appropriate.
const PrivateRoute = () => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return <Spinner />;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
};

export default PrivateRoute;
