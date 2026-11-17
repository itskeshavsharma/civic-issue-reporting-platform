import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { civicApi } from '../../services/api';
import {
  Users,
  UserPlus,
  Trash2,
  Mail,
  Lock,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  RefreshCw,
  Search,
  Building2,
  Briefcase,
  Phone,
  Clock,
  History,
  Edit,
  X,
  FileText,
  AlertCircle,
  Eye,
} from 'lucide-react';

const ROLE_OPTIONS = {
  super_admin: [
    { value: 'managing_officer', label: 'Managing Officer (Central Intake)' },
    { value: 'ward_officer', label: 'Ward Officer (Ward Supervisor)' },
    { value: 'field_officer', label: 'Field Officer (Ground Crew)' },
  ],
  managing_officer: [
    { value: 'ward_officer', label: 'Ward Officer (Ward Supervisor)' },
  ],
  ward_officer: [
    { value: 'field_officer', label: 'Field Officer (Ground Crew)' },
  ],
};

const ManageOfficers = () => {
  const { userRole, isSuperAdmin, isManagingOfficer, isWardOfficer, officerProfile } = useAuth();

  const [officers, setOfficers] = useState([]);
  const [wards, setWards] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Creation Form state
  const allowedCreateRoles = ROLE_OPTIONS[userRole] || [];
  const defaultRole = allowedCreateRoles[0]?.value || 'field_officer';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState(defaultRole);
  const [selectedWard, setSelectedWard] = useState(officerProfile?.wardId?._id || officerProfile?.wardId || '');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Modals state
  const [officerToRevoke, setOfficerToRevoke] = useState(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const [editingOfficer, setEditingOfficer] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editWard, setEditWard] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editIsOnLeave, setEditIsOnLeave] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // History & Audit Trail Modal state
  const [historyOfficer, setHistoryOfficer] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState('tickets'); // 'tickets' | 'audit'

  // Fetch all personnel
  const fetchOfficers = async () => {
    setLoading(true);
    try {
      const res = await civicApi.getStaff();
      setOfficers(res.officers || []);
    } catch (err) {
      console.error('Failed to fetch staff:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Master Wards and Departments
  const fetchMasters = async () => {
    try {
      const [wardsRes, deptsRes] = await Promise.all([
        civicApi.getWards(),
        civicApi.getDepartments(),
      ]);
      setWards(wardsRes.wards || []);
      setDepartments(deptsRes.departments || []);
    } catch (err) {
      console.warn('Could not load master data:', err);
    }
  };

  useEffect(() => {
    fetchOfficers();
    fetchMasters();
  }, []);

  // Update default ward if Ward Officer
  useEffect(() => {
    if (isWardOfficer && (officerProfile?.wardId?._id || officerProfile?.wardId)) {
      setSelectedWard(officerProfile.wardId._id || officerProfile.wardId);
    }
  }, [isWardOfficer, officerProfile]);

  // Create Officer
  const handleCreateOfficer = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setFeedback({
        type: 'error',
        message: 'Full Name, Email, and temporary password are required.',
      });
      return;
    }

    if (password.length < 6) {
      setFeedback({
        type: 'error',
        message: 'Security password must be at least 6 characters long.',
      });
      return;
    }

    if (selectedRole === 'ward_officer' && !selectedWard) {
      setFeedback({
        type: 'error',
        message: 'Ward selection is mandatory for Ward Officer accounts.',
      });
      return;
    }

    if (selectedRole === 'field_officer') {
      const effWard = isWardOfficer ? (officerProfile?.wardId?._id || officerProfile?.wardId) : selectedWard;
      if (!effWard) {
        setFeedback({ type: 'error', message: 'Ward selection is mandatory for Field Officer accounts.' });
        return;
      }
      if (!selectedDepartment) {
        setFeedback({ type: 'error', message: 'Department selection is mandatory for Field Officer accounts.' });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const effWard = isWardOfficer ? (officerProfile?.wardId?._id || officerProfile?.wardId) : selectedWard;
      const res = await civicApi.createStaff({
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
        phone: phone.trim(),
        role: selectedRole,
        wardId: effWard || null,
        departmentId: selectedRole === 'field_officer' ? selectedDepartment : null,
      });

      setFeedback({
        type: 'success',
        message: res.message || `Officer ${fullName} provisioned successfully as ${selectedRole}.`,
      });

      // Reset form
      setFullName('');
      setEmail('');
      setPassword('');
      setPhone('');
      setSelectedRole(defaultRole);
      setSelectedDepartment('');
      fetchOfficers();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to provision officer credentials.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Revoke Officer (Soft-delete)
  const handleConfirmRevoke = async () => {
    if (!officerToRevoke) return;
    setIsRevoking(true);
    try {
      await civicApi.revokeStaff(officerToRevoke._id);
      setFeedback({
        type: 'success',
        message: `Revoked access credentials for ${officerToRevoke.name}. Historical audit trail preserved.`,
      });
      setOfficerToRevoke(null);
      fetchOfficers();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to revoke credentials.',
      });
    } finally {
      setIsRevoking(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (officer) => {
    setEditingOfficer(officer);
    setEditName(officer.name || '');
    setEditPhone(officer.phone || '');
    setEditWard(officer.wardId?._id || officer.wardId || '');
    setEditDept(officer.departmentId?._id || officer.departmentId || '');
    setEditIsOnLeave(Boolean(officer.isOnLeave));
  };

  // Save Edit Officer
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingOfficer) return;
    setIsEditing(true);
    try {
      await civicApi.updateStaff(editingOfficer._id, {
        name: editName.trim(),
        phone: editPhone.trim(),
        wardId: editWard || null,
        departmentId: editDept || null,
        isOnLeave: editIsOnLeave,
      });
      setFeedback({
        type: 'success',
        message: `Officer details for "${editName}" updated successfully.`,
      });
      setEditingOfficer(null);
      fetchOfficers();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to update officer.',
      });
    } finally {
      setIsEditing(false);
    }
  };

  // Open History Drawer
  const openHistoryDrawer = async (officer) => {
    setHistoryOfficer(officer);
    setHistoryData(null);
    setLoadingHistory(true);
    setHistoryTab('tickets');
    try {
      const res = await civicApi.getStaffHistory(officer._id);
      setHistoryData(res);
    } catch (err) {
      console.error('Failed to load officer history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Filter officers
  const filteredOfficers = officers.filter((o) => {
    const name = (o.name || '').toLowerCase();
    const mail = (o.email || '').toLowerCase();
    const wardName = (o.wardId?.name || '').toLowerCase();
    const deptName = (o.departmentId?.name || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch = name.includes(q) || mail.includes(q) || wardName.includes(q) || deptName.includes(q);

    if (roleFilter === 'ALL') return matchesSearch;
    return matchesSearch && o.role === roleFilter;
  });

  const getRoleStyle = (role) => {
    switch (role) {
      case 'super_admin':
        return { label: 'Super Admin', bg: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'managing_officer':
        return { label: 'Managing Officer', bg: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'ward_officer':
        return { label: 'Ward Officer', bg: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
      case 'field_officer':
        return { label: 'Field Officer', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      default:
        return { label: role, bg: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Page Title & Hierarchy Verification Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
              5-Tier Municipal Personnel
            </span>
            <span className="text-xs text-slate-400 font-medium">• Live MongoDB Records</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-indigo-600" />
            Hierarchy Personnel Roster
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Provision, monitor, edit, and audit subordinate officers across Municipal Wards and Departments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchOfficers}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Roster
          </button>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback.message && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback({ type: '', message: '' })}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Provision New Officer Form (Only if allowed to create) */}
      {allowedCreateRoles.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <UserPlus className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Provision Subordinate Municipal Officer</h2>
          </div>

          <form onSubmit={handleCreateOfficer} autoComplete="off" className="space-y-4">
            {/* Hidden dummy fields to prevent browser password managers from auto-filling saved login credentials */}
            <input type="text" name="prevent_autofill_user" tabIndex="-1" className="hidden" aria-hidden="true" autoComplete="off" />
            <input type="password" name="prevent_autofill_pwd" tabIndex="-1" className="hidden" aria-hidden="true" autoComplete="new-password" />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="officer_full_name"
                  id="officer_full_name"
                  required
                  autoComplete="off"
                  placeholder="e.g. Ramesh Kumar"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Official Email *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    name="officer_official_email"
                    id="officer_official_email"
                    required
                    autoComplete="off"
                    placeholder="officer@civic.gov.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Temporary Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Temp Password (min 6) *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    name="officer_temp_password"
                    id="officer_temp_password"
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Phone (Optional) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    name="officer_contact_phone"
                    id="officer_contact_phone"
                    autoComplete="off"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Designated Role *
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {allowedCreateRoles.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ward Selection (Required for Ward Officer and Field Officer) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Assigned Ward {selectedRole !== 'managing_officer' ? '*' : '(N/A for Managing)'}
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    disabled={selectedRole === 'managing_officer' || isWardOfficer}
                    value={selectedWard}
                    onChange={(e) => setSelectedWard(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">-- Select Master Ward --</option>
                    {wards.map((w) => (
                      <option key={w._id} value={w._id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Department Selection (Required for Field Officer) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Department {selectedRole === 'field_officer' ? '*' : '(Field Crew Only)'}
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    disabled={selectedRole !== 'field_officer'}
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">-- Select Department --</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} ({d.code} • SLA {d.slaHours}h)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Provisioning Officer...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Provision Officer Credentials
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Officers List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Header & Search Filter */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">Officer Roster</h3>
            <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
              {filteredOfficers.length} {filteredOfficers.length === 1 ? 'officer' : 'officers'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search name, ward, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Roles</option>
              <option value="managing_officer">Managing Officers</option>
              <option value="ward_officer">Ward Officers</option>
              <option value="field_officer">Field Officers</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-2" />
            <p className="text-sm">Loading municipal personnel records...</p>
          </div>
        ) : filteredOfficers.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-600">No municipal officers found.</p>
            <p className="text-xs text-slate-400 mt-1">
              Use the form above to provision subordinate officers into the 5-tier municipal hierarchy.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3">Officer</th>
                  <th className="px-4 py-3">Role Tier</th>
                  <th className="px-4 py-3">Jurisdiction</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOfficers.map((o) => {
                  const roleStyle = getRoleStyle(o.role);
                  const isRevoked = !o.isActive;

                  return (
                    <tr key={o._id} className={`hover:bg-slate-50/70 ${isRevoked ? 'bg-slate-50/40 opacity-75' : ''}`}>
                      {/* Name & Contact */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          {o.photoURL ? (
                            <img
                              src={o.photoURL}
                              alt={o.name}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                              {(o.name || 'O').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-900">{o.name}</p>
                            <p className="text-slate-500 text-[11px]">{o.email}</p>
                            {o.phone && <p className="text-slate-400 text-[10px]">{o.phone}</p>}
                          </div>
                        </div>
                      </td>

                      {/* Role Tier */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] border ${roleStyle.bg}`}>
                          {roleStyle.label}
                        </span>
                      </td>

                      {/* Ward Jurisdiction */}
                      <td className="px-4 py-3.5">
                        {o.wardId ? (
                          <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                            <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{o.wardId.name || o.wardId}</span>
                            {o.wardId.code && (
                              <span className="text-[10px] text-slate-400">({o.wardId.code})</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">
                            {o.role === 'managing_officer' ? 'Central Citywide' : 'Unassigned'}
                          </span>
                        )}
                      </td>

                      {/* Department */}
                      <td className="px-4 py-3.5">
                        {o.departmentId ? (
                          <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                            <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                            <span>{o.departmentId.name || o.departmentId}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        {isRevoked ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              Revoked
                            </span>
                            {o.revokedAt && (
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {new Date(o.revokedAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ) : o.isOnLeave ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            On Leave
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Active
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* History & Audit Trail */}
                          <button
                            type="button"
                            onClick={() => openHistoryDrawer(o)}
                            title="View Complete Lifetime Audit Trail & Assigned Grievances"
                            className="p-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          {/* Edit Details */}
                          {!isRevoked && (
                            <button
                              type="button"
                              onClick={() => openEditModal(o)}
                              title="Edit Officer Info & Reassignment"
                              className="p-1.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}

                          {/* Revoke */}
                          {!isRevoked && (
                            <button
                              type="button"
                              onClick={() => setOfficerToRevoke(o)}
                              title="Revoke Officer Access (Preserves Immutable History)"
                              className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Revocation Confirmation Modal */}
      {officerToRevoke && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center border border-rose-100">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Revoke Officer Credentials?</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Are you sure you want to revoke access credentials for{' '}
              <span className="font-bold text-slate-900">{officerToRevoke.name}</span> (
              <span className="text-slate-500">{officerToRevoke.email}</span>)?
              <br />
              <br />
              <strong className="text-slate-800">Note:</strong> Their account will be deactivated from Firebase Auth,
              preventing sign-in. Their entire historical ticket resolution and audit record remains permanently
              accessible for municipal oversight.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setOfficerToRevoke(null)}
                disabled={isRevoking}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                disabled={isRevoking}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                {isRevoking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Confirm Revocation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Officer Modal */}
      {editingOfficer && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Edit Officer: {editingOfficer.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingOfficer(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Ward Reassignment (Super Admin or Managing Officer) */}
              {(isSuperAdmin || isManagingOfficer) && editingOfficer.role !== 'managing_officer' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Reassign Ward
                  </label>
                  <select
                    value={editWard}
                    onChange={(e) => setEditWard(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- No Ward Assigned --</option>
                    {wards.map((w) => (
                      <option key={w._id} value={w._id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Department Reassignment (Field Officer) */}
              {editingOfficer.role === 'field_officer' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Department
                  </label>
                  <select
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- No Department Assigned --</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} ({d.code} • SLA {d.slaHours}h)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* On Leave Status Toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsOnLeave}
                    onChange={(e) => setEditIsOnLeave(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Mark Officer as Currently On Leave
                  </span>
                </label>
                <p className="text-[11px] text-slate-400 ml-6 mt-0.5">
                  When enabled, Ward Officers are notified to reassign active tasks to available crew.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingOfficer(null)}
                  disabled={isEditing}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditing}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  {isEditing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History & Chronological Audit Drawer */}
      {historyOfficer && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex justify-end z-50">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    Audit Trail: {historyOfficer.name}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Role: <span className="font-semibold">{historyOfficer.role}</span> • Email: {historyOfficer.email}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setHistoryOfficer(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Stat Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 bg-slate-100/70 border-b border-slate-200 text-center text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Assigned Tickets</span>
                <span className="text-base font-black text-indigo-700">
                  {historyData?.assignedTicketsCount ?? '...'}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Audit Events</span>
                <span className="text-base font-black text-blue-700">
                  {historyData?.auditLogsCount ?? '...'}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Ward</span>
                <span className="text-xs font-bold text-slate-800 truncate block">
                  {historyOfficer.wardId?.name || 'N/A'}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Account</span>
                <span
                  className={`text-xs font-bold block ${
                    historyOfficer.isActive ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {historyOfficer.isActive ? 'Active' : 'Revoked'}
                </span>
              </div>
            </div>

            {/* Tab Buttons */}
            <div className="flex border-b border-slate-200 px-4 bg-white">
              <button
                type="button"
                onClick={() => setHistoryTab('tickets')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  historyTab === 'tickets'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Assigned Grievances ({historyData?.assignedTicketsCount || 0})
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('audit')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  historyTab === 'audit'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Action Audit Logs ({historyData?.auditLogsCount || 0})
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingHistory ? (
                <div className="py-16 text-center text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-2" />
                  <p className="text-xs">Loading officer history & audit records...</p>
                </div>
              ) : historyTab === 'tickets' ? (
                <div className="space-y-3">
                  {historyData?.assignedTickets?.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      No grievance tickets assigned to this officer yet.
                    </div>
                  ) : (
                    historyData?.assignedTickets?.map((t) => (
                      <div
                        key={t._id}
                        className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900">
                            {typeof t.title === 'object' ? t.title?.en || t.title?.hi : t.title}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              t.status === 'Resolved' || t.status === 'Closed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : t.status === 'In Progress'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {t.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1">
                          {typeof t.description === 'object'
                            ? t.description?.en || t.description?.hi
                            : t.description || (t.title?.hi ? t.title.hi : '')}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                          <span>{t.address?.areaName || t.address?.formattedAddress || 'Location'}</span>
                          <span>{new Date(t.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {historyData?.auditLogs?.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      No audit events logged for this officer.
                    </div>
                  ) : (
                    historyData?.auditLogs?.map((log) => (
                      <div
                        key={log._id}
                        className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-indigo-700">{log.action}</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        {log.reason && (
                          <p className="text-[11px] text-slate-700 italic bg-white p-2 rounded-lg border border-slate-200">
                            "{log.reason}"
                          </p>
                        )}
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                          <span>
                            Transition: <strong className="text-slate-700">{log.fromStatus || 'None'}</strong> →{' '}
                            <strong className="text-slate-700">{log.toStatus || 'None'}</strong>
                          </span>
                          {log.complaintId && (
                            <span className="text-slate-400 truncate max-w-[200px]">
                              Ticket: {typeof log.complaintId.title === 'object' ? log.complaintId.title.en : log.complaintId.title || log.complaintId._id}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageOfficers;