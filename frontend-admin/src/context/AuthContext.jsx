import React, { createContext, useContext, useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../config/firebase';
import { civicApi } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'super_admin' | 'managing_officer' | 'ward_officer' | 'field_officer' | null
  const [officerProfile, setOfficerProfile] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [selectedWard, setSelectedWard] = useState('All City');

  /**
   * Helper: verify session against authoritative backend /api/auth/me
   */
  const verifyBackendSession = async (token, firebaseUser = null) => {
    try {
      const data = await civicApi.getMe(token);

      const staffRoles = ['super_admin', 'managing_officer', 'ward_officer', 'field_officer', 'admin'];
      if (data && staffRoles.includes(data.role)) {
        const profile = {
          uid: data.uid,
          _id: data._id,
          email: data.email,
          name: data.displayName || data.name || (data.email ? data.email.split('@')[0] : 'Officer'),
          phone: data.phone || '',
          photoURL: data.photoURL || null,
          role: data.role,
          ward: data.ward || null,
          department: data.department || null,
          isOnLeave: Boolean(data.isOnLeave),
          permissions: data.permissions || [],
        };

        if (firebaseUser) {
          setUser(firebaseUser);
        } else {
          setUser({
            uid: profile.uid,
            email: profile.email,
            displayName: profile.name,
            getIdToken: async () => token,
          });
        }

        setUserRole(data.role);
        setOfficerProfile(profile);
        setPermissions(data.permissions || []);

        sessionStorage.setItem('civic_user_role', data.role);
        sessionStorage.setItem('civic_officer_profile', JSON.stringify(profile));
        sessionStorage.setItem('civic_officer_token', token);
        return { success: true, role: data.role, profile };
      } else {
        throw new Error('Access Denied: You do not have municipal staff credentials.');
      }
    } catch (err) {
      console.warn('[AuthContext] Backend verification failed:', err.message);
      throw err;
    }
  };

  const refreshProfile = async () => {
    const token = sessionStorage.getItem('civic_officer_token');
    if (token) {
      try {
        await verifyBackendSession(token);
      } catch (err) {
        console.warn('[AuthContext] refreshProfile error:', err.message);
      }
    }
  };

  // Restore stored session if available
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = sessionStorage.getItem('civic_officer_token');
      const storedRole = sessionStorage.getItem('civic_user_role');
      const storedProfile = sessionStorage.getItem('civic_officer_profile');

      if (storedToken && storedRole && storedProfile) {
        try {
          const parsed = JSON.parse(storedProfile);
          setUserRole(storedRole);
          setOfficerProfile(parsed);
          setPermissions(parsed.permissions || []);
          verifyBackendSession(storedToken).catch(() => {});
        } catch (e) {
          console.warn('Failed to parse cached profile:', e);
        }
      }

      // Subscribe to Firebase Auth state
      if (isFirebaseConfigured) {
        onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
            try {
              const token = await firebaseUser.getIdToken();
              await verifyBackendSession(token, firebaseUser);
            } catch (err) {
              console.error('[AuthContext] Session validation rejected:', err.message);
              await signOut(auth).catch(() => {});
              sessionStorage.clear();
              setUser(null);
              setUserRole(null);
              setOfficerProfile(null);
              setPermissions([]);
            }
          } else {
            setUser(null);
            setUserRole(null);
            setOfficerProfile(null);
            setPermissions([]);
          }
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  /**
   * Official Municipal Officer Login with Firebase Auth
   * Validates credentials strictly against backend GET /api/auth/me
   */
  const login = async (email, password) => {
    setAuthError(null);
    setLoading(true);

    try {
      if (!isFirebaseConfigured) {
        throw new Error('Firebase configuration is missing or incomplete.');
      }

      // Step 1: Sign in with Firebase Client SDK
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = credential.user;

      // Step 2: Get live ID Token
      const token = await firebaseUser.getIdToken(true);

      // Step 3: Validate Role Strictly via Backend Authority
      const result = await verifyBackendSession(token, firebaseUser);

      setLoading(false);
      return { success: true, role: result.role, user: firebaseUser };
    } catch (err) {
      setLoading(false);
      let message = err.message || 'Login failed';
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password'
      ) {
        message = 'Invalid email or password. Please verify your municipal officer credentials.';
      } else if (err.code === 'auth/too-many-requests') {
        message = 'Too many failed login attempts. Please wait a few minutes before trying again.';
      }
      setAuthError(message);
      throw new Error(message);
    }
  };

  /**
   * Municipal Logout
   */
  const logout = async () => {
    try {
      if (isFirebaseConfigured && auth.currentUser) {
        await signOut(auth);
      }
    } catch (e) {
      console.warn('SignOut warning:', e);
    } finally {
      sessionStorage.clear();
      setUser(null);
      setUserRole(null);
      setOfficerProfile(null);
      setPermissions([]);
    }
  };

  const hasPermission = (perm) => permissions.includes(perm);

  return (
    <AuthContext.Provider
      value={{
        user,
        userRole,
        officerProfile,
        permissions,
        hasPermission,
        loading,
        authError,
        setAuthError,
        login,
        logout,
        refreshProfile,
        selectedWard,
        setSelectedWard,
        isAuthenticated: Boolean(userRole && userRole !== 'citizen'),
        isSuperAdmin: userRole === 'super_admin',
        isManagingOfficer: userRole === 'managing_officer',
        isWardOfficer: userRole === 'ward_officer',
        isFieldOfficer: userRole === 'field_officer',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;
