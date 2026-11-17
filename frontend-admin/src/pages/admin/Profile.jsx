import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { civicApi } from '../../services/api';
import {
  User,
  Mail,
  Phone,
  Shield,
  MapPin,
  Briefcase,
  Camera,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CalendarCheck,
  CalendarOff,
} from 'lucide-react';

const Profile = () => {
  const { officerProfile, userRole, refreshProfile } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isOnLeave, setIsOnLeave] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  useEffect(() => {
    if (officerProfile) {
      setName(officerProfile.name || '');
      setPhone(officerProfile.phone || '');
      setIsOnLeave(Boolean(officerProfile.isOnLeave));
      if (officerProfile.photoURL) {
        setAvatarPreview(officerProfile.photoURL);
      }
    }
  }, [officerProfile]);

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('phone', phone.trim());
      formData.append('isOnLeave', String(isOnLeave));
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      const res = await civicApi.updateProfile(formData);

      if (res && res.success) {
        setFeedback({ type: 'success', message: 'Profile details updated successfully.' });
        await refreshProfile();
      } else {
        throw new Error(res?.message || 'Update failed.');
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update profile.' });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (str) => {
    if (!str) return 'OF';
    const parts = str.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return str.substring(0, 2).toUpperCase();
  };

  const getRoleLabel = (r) => {
    switch (r) {
      case 'super_admin':
        return 'Municipal Head / IT Admin (Tier 1)';
      case 'managing_officer':
        return 'Central Intake & Ward Router (Tier 2)';
      case 'ward_officer':
        return 'Ward Supervisor (Tier 3)';
      case 'field_officer':
        return 'Ground Execution Officer (Tier 4)';
      default:
        return 'Citizen';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 font-sans">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="relative group">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-indigo-50 border-2 border-indigo-200 flex items-center justify-center shadow-xs">
              {avatarPreview ? (
                <img src={avatarPreview} alt={name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-black text-indigo-700 tracking-wider">
                  {getInitials(name)}
                </span>
              )}
            </div>
            <label
              htmlFor="avatar-upload"
              className="absolute -bottom-2 -right-2 p-1.5 rounded-xl bg-indigo-600 text-white shadow-md hover:bg-indigo-700 transition-colors cursor-pointer"
              title="Change Profile Picture"
            >
              <Camera className="w-4 h-4" />
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">{name || 'Officer'}</h1>
              {isOnLeave && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                  <CalendarOff className="w-3 h-3 text-amber-600" />
                  On Leave
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-indigo-600 mt-0.5">{getRoleLabel(userRole)}</p>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{officerProfile?.email}</p>
          </div>
        </div>

        {/* Operational Context Badges */}
        <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-2 text-xs">
          {officerProfile?.ward && (
            <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 font-semibold flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              Ward: {officerProfile.ward.name} ({officerProfile.ward.code})
            </span>
          )}
          {officerProfile?.department && (
            <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 font-semibold flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-blue-500" />
              Dept: {officerProfile.department.name} ({officerProfile.department.code})
            </span>
          )}
        </div>
      </div>

      {/* Profile Edit Form */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100">
          Personal Details & Operational Availability
        </h2>

        {feedback.message && (
          <div
            className={`mb-6 p-4 rounded-2xl border flex items-center gap-3 text-xs sm:text-sm font-semibold ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Official Contact Phone
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Email (Readonly) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Email Address (Authentication ID)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                disabled
                value={officerProfile?.email || ''}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-mono text-slate-500 cursor-not-allowed"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Managed via Firebase Authentication credentials.</p>
          </div>

          {/* Officer "On Leave" Toggle Switch */}
          {userRole !== 'citizen' && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
              <div>
                <span className="text-sm font-bold text-slate-900 block">
                  Operational Leave Status (isOnLeave)
                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  When toggled ON, supervisors will be alerted and can reassign incoming or active ward grievances to covering officers.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsOnLeave(!isOnLeave)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isOnLeave ? 'bg-amber-500' : 'bg-slate-300'
                }`}
                role="switch"
                aria-checked={isOnLeave}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isOnLeave ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm disabled:opacity-60 transition-all flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Update Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;
