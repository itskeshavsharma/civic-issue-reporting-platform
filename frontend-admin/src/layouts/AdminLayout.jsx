import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AdminHeader from '../components/admin/AdminHeader';
import {
  LayoutDashboard,
  MapPin,
  FileText,
  Users,
  X,
  ChevronRight,
  Shield,
  CheckCircle2,
  Building2,
  Briefcase,
  User,
} from 'lucide-react';

const AdminLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { userRole, isSuperAdmin, isManagingOfficer, isWardOfficer, isFieldOfficer, officerProfile } = useAuth();
  const location = useLocation();

  // Dynamic Dashboard Label & Subtitle by Role
  const getDashboardLabel = () => {
    if (isSuperAdmin) return { name: 'Analytics & SLA', desc: 'System Executive Radar' };
    if (isManagingOfficer) return { name: 'Intake & Routing', desc: 'Central Dispatch Queue' };
    if (isWardOfficer) return { name: 'Ward Dispatch', desc: 'Field Task Allocation' };
    if (isFieldOfficer) return { name: 'My Tasks', desc: 'Ground Operations' };
    return { name: 'Dashboard', desc: 'Operational Console' };
  };

  const dashInfo = getDashboardLabel();

  const navLinks = [
    {
      name: dashInfo.name,
      path: '/admin/dashboard',
      icon: LayoutDashboard,
      description: dashInfo.desc,
    },
  ];

  // Super Admin Exclusive Master Data Setup
  if (isSuperAdmin) {
    navLinks.push({
      name: 'Master Wards',
      path: '/admin/wards',
      icon: Building2,
      description: 'Municipal Ward Registry',
    });
    navLinks.push({
      name: 'Departments & SLA',
      path: '/admin/departments',
      icon: Briefcase,
      description: 'SLA Hours & Categories',
    });
  }

  // Hierarchy Staff Management (Super Admin, Managing Officer, Ward Officer)
  if (isSuperAdmin || isManagingOfficer || isWardOfficer) {
    navLinks.push({
      name: isSuperAdmin ? 'Hierarchy Officers' : isManagingOfficer ? 'Ward Supervisors' : 'Field Crew',
      path: '/admin/officers',
      icon: Users,
      description: isSuperAdmin ? 'Provision & Revoke Staff' : 'Personnel Roster',
    });
  }

  // Common Operations
  navLinks.push({
    name: 'Live Map Radar',
    path: '/admin/map',
    icon: MapPin,
    description: 'Active Geospatial Radar',
  });

  navLinks.push({
    name: 'Grievance Directory',
    path: '/admin/complaints',
    icon: FileText,
    description: 'Full Issue Directory',
  });

  navLinks.push({
    name: 'Resolved Archive',
    path: '/admin/resolved',
    icon: CheckCircle2,
    description: 'Area Proof Records',
  });

  navLinks.push({
    name: 'My Profile',
    path: '/admin/profile',
    icon: User,
    description: 'Officer Credentials & Leave',
  });

  const getRoleBadge = () => {
    if (isSuperAdmin) return { title: 'MUNICIPAL HEAD', color: 'bg-purple-100 text-purple-800 border-purple-200' };
    if (isManagingOfficer) return { title: 'CENTRAL INTAKE', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    if (isWardOfficer) return { title: 'WARD SUPERVISOR', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
    if (isFieldOfficer) return { title: 'FIELD CREW', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    return { title: 'OFFICER', color: 'bg-slate-100 text-slate-800 border-slate-200' };
  };

  const getJurisdictionLabel = () => {
    if (isSuperAdmin) return 'Full Citywide Authority';
    if (isManagingOfficer) return 'Central Intake & Ward Router';
    if (isWardOfficer) return officerProfile?.wardName || officerProfile?.wardId?.name || 'Assigned Ward';
    if (isFieldOfficer) {
      const wName = officerProfile?.wardName || officerProfile?.wardId?.name || 'Assigned Ward';
      const dName = officerProfile?.departmentName || officerProfile?.departmentId?.name || '';
      return dName ? `${wName} • ${dName}` : wName;
    }
    return officerProfile?.assignedArea || 'Municipal Sector';
  };

  const roleBadge = getRoleBadge();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Mobile Drawer Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Shell - Light Enterprise Design */}
      <aside
        className={`w-64 bg-white text-slate-800 h-screen fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 shadow-sm transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Sidebar Brand Header with CivicSathi Logo */}
        <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="CivicSathi Logo"
              className="w-9 h-9 rounded-xl object-contain shadow-xs border border-slate-100"
            />
            <div>
              <span className="text-base font-extrabold tracking-tight text-slate-900 block leading-tight">
                Civic<span className="text-indigo-600">Sathi</span>
              </span>
              <span className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase block">
                Municipal Portal
              </span>
            </div>
          </div>

          {/* Close button for mobile drawer */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 focus:outline-none"
            aria-label="Close Sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Operational Dispatch Status Indicator */}
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-700 font-medium text-[11px]">Municipal Dispatch</span>
            </div>
            <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              LIVE
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Control Center
          </div>

          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `group flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  <span>{item.name}</span>
                </div>
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-opacity ${
                    isActive ? 'text-indigo-600 opacity-100' : 'opacity-0 group-hover:opacity-40 text-slate-400'
                  }`}
                />
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Officer Status Box */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70">
          <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Security Domain
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${roleBadge.color}`}
              >
                {roleBadge.title}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-900 truncate">
              {officerProfile?.name || 'Officer'}
            </p>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              {getJurisdictionLabel()}
            </p>
          </div>
          <div className="mt-2 text-center text-[10px] text-slate-400 font-medium">
            CivicSathi 5-Tier Municipal System
          </div>
        </div>
      </aside>

      {/* Content Area takes remaining width: lg:pl-64 flex flex-col flex-1 */}
      <div className="lg:pl-64 flex flex-col flex-1 min-h-screen">
        <AdminHeader onMobileMenuToggle={() => setMobileMenuOpen((prev) => !prev)} />
        <main className="flex-1 bg-slate-50 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
