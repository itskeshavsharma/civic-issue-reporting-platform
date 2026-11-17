import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Loader2 } from 'lucide-react';

const AdminRoute = ({ children, requireSuperAdmin = false, allowedRoles = null }) => {
  const { isAuthenticated, isSuperAdmin, loading, userRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-700">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
        <p className="text-sm font-semibold tracking-wide text-slate-600">Verifying municipal officer credentials...</p>
      </div>
    );
  }

  // Not authenticated as officer -> redirect to /admin/login
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // Route requires super_admin but current role is not super admin -> block and redirect to /admin/dashboard
  if (requireSuperAdmin && !isSuperAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto my-12 bg-white border border-red-200 rounded-2xl text-center shadow-xl">
        <div className="w-16 h-16 bg-red-50 border border-red-200 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Restricted Access: Super Admin Only</h2>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          Your current security role (<span className="text-blue-700 font-bold uppercase">{userRole}</span>) does not have permission to access this section.
        </p>
        <Navigate to="/admin/dashboard" replace />
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
};

export default AdminRoute;
