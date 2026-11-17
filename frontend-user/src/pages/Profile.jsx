import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Camera,
  Lock,
  LogOut,
  Pencil,
  Check,
  X,
  ShieldCheck,
  CalendarDays,
  FileText,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUserStats, getProfile, updateProfile } from '../services/api';

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'civic_profile';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const loadSavedProfile = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveProfile = (data) => {
  // TODO: Replace localStorage profile persistence with Firebase/Firestore later.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
};

// Phone validation: allow empty OR a valid-ish mobile number
const isValidPhone = (val) => {
  if (!val.trim()) return true;
  return /^[+]?[\d\s\-().]{7,15}$/.test(val.trim());
};

// ─── Profile Page ─────────────────────────────────────────────────────────────
const Profile = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // ── Derive initial values from AuthContext + localStorage ──
  const saved = loadSavedProfile();
  const authName =
    currentUser?.displayName || currentUser?.name || 'Civic User';
  const authEmail =
    currentUser?.email || 'user@example.com';

  // ── State ──────────────────────────────────────────────────
  const [profilePhoto, setProfilePhoto] = useState(
    saved?.profilePhoto || currentUser?.photoURL || null
  );
  const [name, setName]   = useState(saved?.name  || authName);
  const [phone, setPhone] = useState(saved?.phone || '');
  const [area, setArea]   = useState(saved?.area  || '');

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [draftName,  setDraftName]  = useState(name);
  const [draftPhone, setDraftPhone] = useState(phone);
  const [draftArea,  setDraftArea]  = useState(area);

  // Feedback
  const [successMsg, setSuccessMsg] = useState('');
  const [errors, setErrors]         = useState({});

  // Live Backend Stats & User Profile
  const [stats, setStats] = useState({ total: 0, pending: 0, underWorking: 0, resolved: 0 });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, profileRes] = await Promise.all([
          getUserStats().catch(() => null),
          getProfile().catch(() => null),
        ]);

        if (statsRes && statsRes.success) {
          setStats({
            total: statsRes.total ?? 0,
            pending: statsRes.pending ?? 0,
            underWorking: statsRes.underWorking ?? 0,
            resolved: statsRes.resolved ?? 0,
          });
        }

        if (profileRes && profileRes.user) {
          setName(profileRes.user.name || '');
          setPhone(profileRes.user.phone || '');
          if (profileRes.user.photoURL) {
            setProfilePhoto(profileRes.user.photoURL);
          }
        }
      } catch (err) {
        console.debug('[Profile] Data load note:', err.message);
      }
    };
    fetchData();
  }, [currentUser]);

  // Keep name in sync if authContext updates after render
  useEffect(() => {
    if (!name && authName !== 'Civic User') setName(authName);
  }, [authName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-clear success message
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(''), 3500);
    return () => clearTimeout(t);
  }, [successMsg]);

  // ── Photo picker ───────────────────────────────────────────
  const handlePhotoClick = () => fileInputRef.current?.click();

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview immediately
    setProfilePhoto(URL.createObjectURL(file));

    // Upload to Cloudinary via backend PATCH /api/users/profile
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await updateProfile(formData);
      if (res.user?.photoURL) {
        setProfilePhoto(res.user.photoURL);
      }
      setSuccessMsg('Profile photo updated and saved to cloud.');
    } catch (err) {
      console.warn('Avatar upload failed:', err);
    }
    e.target.value = '';
  };

  // ── Edit / Cancel / Save ───────────────────────────────────
  const handleEditClick = () => {
    setDraftName(name);
    setDraftPhone(phone);
    setDraftArea(area);
    setErrors({});
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setErrors({});
  };

  const handleSave = async () => {
    const newErrors = {};

    if (!draftName.trim()) {
      newErrors.name = 'Full name is required.';
    }
    if (!isValidPhone(draftPhone)) {
      newErrors.phone = 'Please enter a valid phone number.';
    }

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateProfile({
        name: draftName.trim(),
        phone: draftPhone.trim(),
      });

      setName(draftName.trim());
      setPhone(draftPhone.trim());
      setArea(draftArea.trim());
      setIsEditing(false);
      setErrors({});
      setSuccessMsg(res.message || 'Profile updated successfully');
    } catch (err) {
      setErrors({ name: err.response?.data?.message || err.message || 'Failed to save profile' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Logout ─────────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // ── Field component ────────────────────────────────────────
  const Field = ({ label, icon: Icon, value, children, helper }) => (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </label>
      {children || (
        <p className="text-sm font-medium text-gray-900 py-2 px-3 bg-gray-50 rounded-lg border border-gray-100">
          {value || <span className="text-gray-400 italic">Not set</span>}
        </p>
      )}
      {helper && <p className="text-xs text-gray-400 mt-0.5">{helper}</p>}
    </div>
  );

  const inputCls = (hasError) =>
    `w-full text-sm px-3 py-2 rounded-lg border ${
      hasError
        ? 'border-red-400 focus:ring-red-400'
        : 'border-gray-200 focus:ring-blue-500'
    } bg-white text-gray-900 focus:outline-none focus:ring-2 transition-all placeholder-gray-400`;

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Profile</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your personal information and account settings.
          </p>
        </div>

        {/* Success banner */}
        {successMsg && (
          <div className="flex items-center gap-2.5 mb-5 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />
            {successMsg}
          </div>
        )}

        {/* ── Profile card ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">

          {/* Top accent bar */}
          <div className="h-1.5 w-full bg-blue-600 rounded-t-2xl" />

          <div className="px-6 py-7">

            {/* ── Avatar section ── */}
            <div className="flex flex-col items-center mb-8">
              <div className="relative mb-3">
                {/* Avatar circle */}
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-md bg-blue-50 flex items-center justify-center">
                  {profilePhoto ? (
                    <img
                      src={profilePhoto}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-12 h-12 text-blue-300" strokeWidth={1.5} />
                  )}
                </div>

                {/* Camera button */}
                <button
                  onClick={handlePhotoClick}
                  title="Change photo"
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-blue-600 border-2 border-white shadow flex items-center justify-center hover:bg-blue-700 active:bg-blue-800 transition-colors"
                >
                  <Camera className="w-3.5 h-3.5 text-white" />
                </button>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>

              <button
                onClick={handlePhotoClick}
                className="text-xs text-blue-600 font-semibold hover:underline"
              >
                Change photo
              </button>

              {/* Name + email under avatar */}
              <h2 className="mt-3 text-lg font-bold text-gray-900">{name}</h2>
              <p className="text-sm text-gray-400">{authEmail}</p>
            </div>

            {/* ── Stats row ── */}
            <div className="grid grid-cols-2 gap-3 mb-7">
              <div className="flex flex-col items-center py-3 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span className="text-xl font-bold text-blue-700">{stats.total}</span>
                </div>
                <span className="text-xs text-blue-600 font-medium">Complaints Raised</span>
              </div>
              <div className="flex flex-col items-center py-3 bg-green-50 rounded-xl border border-green-100">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-xl font-bold text-green-700">{stats.resolved}</span>
                </div>
                <span className="text-xs text-green-600 font-medium">Resolved</span>
              </div>
            </div>

            {/* ── Section divider ── */}
            <div className="flex items-center gap-3 mb-5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">
                Personal Information
              </span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* ── VIEW MODE ── */}
            {!isEditing ? (
              <div className="space-y-4">
                <Field label="Full Name" icon={User} value={name} />

                <Field
                  label="Email Address"
                  icon={Mail}
                  helper={
                    <span className="flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Email is linked to your account
                    </span>
                  }
                >
                  <p className="text-sm font-medium text-gray-900 py-2 px-3 bg-gray-100 rounded-lg border border-gray-200 flex items-center gap-2">
                    <span className="flex-1">{authEmail}</span>
                    <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  </p>
                </Field>

                <Field label="Phone Number" icon={Phone} value={phone} />
                <Field label="City / Area"  icon={MapPin} value={area}  />

                {/* Edit button */}
                <div className="pt-2">
                  <button
                    onClick={handleEditClick}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit Profile
                  </button>
                </div>
              </div>
            ) : (
              /* ── EDIT MODE ── */
              <div className="space-y-4">

                {/* Full Name */}
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <User className="w-3.5 h-3.5" />
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => {
                      setDraftName(e.target.value);
                      if (errors.name) setErrors((p) => ({ ...p, name: '' }));
                    }}
                    placeholder="Enter your full name"
                    className={inputCls(!!errors.name)}
                  />
                  {errors.name && (
                    <p className="flex items-center gap-1 text-xs text-red-500 mt-0.5">
                      <AlertCircle className="w-3 h-3" />
                      {errors.name}
                    </p>
                  )}
                </div>

                {/* Email — read-only */}
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <Mail className="w-3.5 h-3.5" />
                    Email Address
                  </label>
                  <div className="flex items-center gap-2 text-sm px-3 py-2 bg-gray-100 rounded-lg border border-gray-200 text-gray-500">
                    <span className="flex-1">{authEmail}</span>
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                  </div>
                  <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                    <Lock className="w-3 h-3" />
                    Email is linked to your account
                  </p>
                </div>

                {/* Phone */}
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <Phone className="w-3.5 h-3.5" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={draftPhone}
                    onChange={(e) => {
                      setDraftPhone(e.target.value);
                      if (errors.phone) setErrors((p) => ({ ...p, phone: '' }));
                    }}
                    placeholder="+91 XXXXX XXXXX (optional)"
                    className={inputCls(!!errors.phone)}
                  />
                  {errors.phone && (
                    <p className="flex items-center gap-1 text-xs text-red-500 mt-0.5">
                      <AlertCircle className="w-3 h-3" />
                      {errors.phone}
                    </p>
                  )}
                </div>

                {/* City / Area */}
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <MapPin className="w-3.5 h-3.5" />
                    City / Area
                  </label>
                  <input
                    type="text"
                    value={draftArea}
                    onChange={(e) => setDraftArea(e.target.value)}
                    placeholder="e.g. Ajmer, Rajasthan"
                    className={inputCls(false)}
                  />
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white text-gray-600 text-sm font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Account Information card ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">
              Account Information
            </span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                <CalendarDays className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Member Since</p>
                <p className="text-sm font-semibold text-gray-800">September 2026</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Account Status</p>
                <p className="text-sm font-semibold text-green-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                  Active
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Account actions card ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">
              Account
            </span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 active:bg-red-200 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

      </div>
    </div>
  );
};

export default Profile;
