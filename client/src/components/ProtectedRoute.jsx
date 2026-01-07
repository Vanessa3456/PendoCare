import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * ProtectedRoute Component
 * Restricts access based on authentication status and user roles.
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
    const location = useLocation();

    // Check for token and role in localStorage
    const token = localStorage.getItem('auth_token');
    const userRole = localStorage.getItem('user_role');

    // 1. Not Authenticated: Redirect to login
    if (!token) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // 2. Role Not Allowed Check - REMOVED per user request
    // if (allowedRoles && !allowedRoles.includes(userRole)) { ... }

    // 3. Authorized: Render the component
    return children;
};

export default ProtectedRoute;
