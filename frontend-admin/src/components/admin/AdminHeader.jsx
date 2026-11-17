import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { civicApi } from '../../services/api';
import { Menu, LogOut, ShieldCheck, MapPin, ChevronDown, User } from 'lucide-react';

const AdminHeader = ({ onMobileMenuToggle }) => {
  const { officerProfile, userRole, isSuperAdmin, isManagingOfficer, isWardOfficer, isFieldOfficer, selectedWard, setSelectedWard, logout } = useAuth();
  const [dynamicAreas, setDynamicAreas] = useState([]);
  const [loadingAreas, setLoadingAreas] = useState(false);

  const officerName = officerProfile?.name || 'Officer';
  const assignedJurisdiction =
    officerProfile?.assignedArea || officerProfile?.wardName || officerProfile?.wardId?.name || 'Assigned Jurisdiction';

  // Fetch live distinct area names for Super Admin filter dropdown
  useEffect(() => {
    let isMounted = true;
    if (isSuperAdmin) {
      setLoadingAreas(true);
      civicApi
        .getDistinctAreas()
        .then((res) => {
          if (isMounted && res.areas) {
            setDynamicAreas(res.areas);
          }
        })
        .catch((err) => {
          console.warn('[AdminHeader] Could not load dynamic areas:', err);
        })
        .finally(() => {
          if (isMounted) setLoadingAreas(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isSuperAdmin]);

  const renderRoleBadge = () => {
    if (isSuperAdmin) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
          <ShieldCheck className="w-3 h-3 text-purple-600" />
          <span className="hidden md:inline">Super Admin</span>
          <span className="md:hidden">Super</span>
        </span>
      );
    }
    if (isManagingOfficer) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
          <ShieldCheck className="w-3 h-3 text-blue-600" />
          <span className="hidden md:inline">Managing Officer</span>
          <span className="md:hidden">Managing</span>
        </span>
      );
    }
    if (isWardOfficer) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
          <ShieldCheck className="w-3 h-3 text-indigo-600" />
          <span className="hidden md:inline">Ward Officer</span>
          <span className="md:hidden">Ward</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
        <ShieldCheck className="w-3 h-3 text-emerald-600" />
        <span className="hidden md:inline">Field Officer</span>
        <span className="md:hidden">Field</span>
      </span>
    );
  };

  const getHeaderJurisdiction = () => {
    if (isManagingOfficer) return 'Central Intake & Router';
    if (isWardOfficer) return officerProfile?.wardName || officerProfile?.wardId?.name || assignedJurisdiction;
    if (isFieldOfficer) {
      const w = officerProfile?.wardName || officerProfile?.wardId?.name || '';
      const d = officerProfile?.departmentName || officerProfile?.departmentId?.name || '';
      return [w, d].filter(Boolean).join(' • ') || assignedJurisdiction;
    }
    return assignedJurisdiction;
  };

  return (
    <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between shadow-2xs">
      {/* Left: Mobile Hamburger (Hidden on lg >= 1024px) + Portal Branding on Mobile */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          aria-label="Open Navigation Drawer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Small screen brand with logo */}
        <div className="lg:hidden flex items-center gap-2">
          <img
            src="/logo.png"
            alt="Civic Logo"
            className="w-7 h-7 rounded-lg object-contain"
          />
          <span className="text-sm font-bold tracking-tight text-slate-900">Civic</span>
        </div>
      </div>

      {/* Center: Jurisdiction Badge */}
      <div className="flex items-center gap-3">
        {isSuperAdmin ? (
          <div className="flex items-center gap-2 bg-purple-50/70 border border-purple-200/80 rounded-xl px-3 py-1.5 shadow-2xs">
            <MapPin className="w-4 h-4 text-purple-600 flex-shrink-0" />
            <label htmlFor="ward-select" className="text-xs text-purple-900 font-semibold hidden sm:inline">
              Jurisdiction:
            </label>
            <div className="relative">
              <select
                id="ward-select"
                value={selectedWard}
                onChange={(e) => setSelectedWard(e.target.value)}
                className="appearance-none bg-transparent text-xs font-bold text-purple-900 pr-6 pl-1 py-0.5 focus:outline-none cursor-pointer border-none"
              >
                <option value="All City" className="bg-white text-slate-800">
                  All Areas (Citywide)
                </option>
                {dynamicAreas.map((area) => (
                  <option key={area} value={area} className="bg-white text-slate-800">
                    {area}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-purple-600 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <span className="hidden md:inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-purple-200/70 text-purple-800 border border-purple-300">
              {loadingAreas ? 'Loading...' : 'Citywide'}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-blue-50/70 border border-blue-200/80 rounded-xl px-3 py-1.5 shadow-2xs">
            <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="text-xs text-blue-900 font-medium hidden sm:inline">Jurisdiction:</span>
            <span className="text-xs font-bold text-blue-900">{getHeaderJurisdiction()}</span>
            <span className="hidden md:inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-blue-200/70 text-blue-800 border border-blue-300">
              Assigned
            </span>
          </div>
        )}
      </div>

      {/* Right: Officer Profile Pill */}
      <div className="flex items-center gap-3">
        <Link
          to="/admin/profile"
          title="View & Edit Officer Profile"
          className="flex items-center gap-2.5 bg-slate-100/80 hover:bg-slate-200/70 border border-slate-200 rounded-full pl-2 pr-3 py-1 shadow-2xs transition-colors"
        >
          {/* Avatar Dot or Photo */}
          {officerProfile?.photoURL ? (
            <img
              src={officerProfile.photoURL}
              alt={officerName}
              className="w-7 h-7 rounded-full object-cover border border-indigo-200"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-xs">
              {officerName.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-bold text-slate-800 truncate max-w-[140px]">
              {officerName}
            </span>
            <span className="text-[10px] text-slate-500">
              {officerProfile?.email || 'officer@civic.gov.in'}
            </span>
          </div>

          {/* Dynamic 5-Tier Role Badge */}
          {renderRoleBadge()}
        </Link>

        {/* Logout Action */}
        <button
          type="button"
          onClick={logout}
          title="Sign out of Municipal Console"
          className="p-1.5 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

export default AdminHeader;
