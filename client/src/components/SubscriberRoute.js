import React from 'react';
import { Navigate, Outlet, useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from './Spinner';

const SubscriberRoute = () => {
    const { isAuthenticated, isSubscriber, loading } = useAuth();
    const context = useOutletContext(); // Get context from parent (MainLayout)

    if (loading) {
        return <Spinner />;
    }

    if (!isAuthenticated) {
        // Redirect them to the /login page, but save the current location they were
        // trying to go to. This allows us to send them along to that page after they login.
        return <Navigate to="/login" replace />;
    }

    if (!isSubscriber) {
        // User is logged in, but not a subscriber. Redirect to the premium page.
        return <Navigate to="/premium" replace />;
    }

    return <Outlet context={context} />; // Pass context down to children
};

export default SubscriberRoute;
