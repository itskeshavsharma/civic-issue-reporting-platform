import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Mail,
  Lock,
  Loader2,
  Globe2,
  User
} from 'lucide-react';

const Login = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const otpInputRefs = useRef([]);

  const {
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
  } = useAuth();

  const navigate = useNavigate();

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      await loginWithEmail(email, password);
      navigate('/');
    } catch (err) {
      console.error(err);
      let message = err?.message || 'Authentication failed.';
      if (err?.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else if (
        err?.code === 'auth/invalid-credential' ||
        err?.code === 'auth/wrong-password' ||
        err?.code === 'auth/user-not-found'
      ) {
        message = 'Invalid email or password.';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    // TODO: Replace frontend demo OTP with backend /auth/send-otp and /auth/verify-otp APIs.
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(newOtp);
    setOtpMode(true);
    setResendCooldown(30);
    setOtp(['', '', '', '', '', '']);
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const enteredOtp = otp.join('');
    if (enteredOtp.length !== 6) {
      setError('Please enter all 6 digits.');
      return;
    }

    if (enteredOtp !== generatedOtp) {
      setError('Invalid OTP. Please try again.');
      return;
    }

    registerWithEmail(name, email);
    navigate('/');
  };

  const handleResendOtp = () => {
    if (resendCooldown > 0) return;
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(newOtp);
    setOtp(['', '', '', '', '', '']);
    setResendCooldown(30);
    setError('');
    setSuccessMsg('A new OTP has been generated.');
  };

  const handleChangeEmail = () => {
    setOtpMode(false);
    setError('');
    setSuccessMsg('');
    setOtp(['', '', '', '', '', '']);
  };

  const handleOtpChange = (index, value) => {
    if (!/^[0-9]*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next
    if (value !== '' && index < 5) {
      otpInputRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
      otpInputRefs.current[index - 1].focus();
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate('/');
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Failed to sign in with Google.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (registering) => {
    setIsRegistering(registering);
    setOtpMode(false);
    setError('');
    setSuccessMsg('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-gray-100 relative">

        {/* Demo OTP display */}
        {otpMode && (
          <div className="absolute -top-12 left-0 right-0 text-center">
            <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-1 rounded border border-yellow-200">
              Demo OTP: {generatedOtp}
            </span>
          </div>
        )}

        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-20 w-20 p-2 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-md border border-gray-100">
            <img src="/logo.png" alt="Civic Logo" className="h-full w-full object-contain" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            {otpMode ? 'Verify your email' : 'Civic'}
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            {otpMode
              ? 'Enter the 6-digit OTP sent to your email'
              : 'Report local issues and make your city better'}
          </p>
          {otpMode && (
            <p className="mt-1 text-sm font-medium text-gray-900">{email}</p>
          )}
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm text-center">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-sm text-center">
            {successMsg}
          </div>
        )}

        {!otpMode && (
          <>
            {/* Login / Register Toggle */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${!isRegistering
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
                onClick={() => switchMode(false)}
              >
                Login
              </button>
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${isRegistering
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
                onClick={() => switchMode(true)}
              >
                Register
              </button>
            </div>

            {/* Form */}
            <form className="mt-8 space-y-6" onSubmit={isRegistering ? handleSendOtp : handleLoginSubmit}>
              <div className="space-y-4">

                {isRegistering && (
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      required
                      className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow bg-gray-50 focus:bg-white"
                      placeholder="Full Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                )}

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow bg-gray-50 focus:bg-white"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {!isRegistering && (
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="password"
                      required
                      minLength={6}
                      autoComplete="current-password"
                      className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow bg-gray-50 focus:bg-white"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center items-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-md active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {loading ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  isRegistering ? 'Send OTP' : 'Sign In'
                )}
              </button>
            </form>

            {/* Divider & Google Login */}
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full flex items-center justify-center px-4 py-3 border border-gray-200 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <Globe2 className="h-5 w-5 mr-2 text-blue-500" />
                  Sign in with Google
                </button>
              </div>
            </div>
          </>
        )}

        {otpMode && (
          <form className="mt-8 space-y-6" onSubmit={handleVerifyOtp}>
            <div className="flex justify-between gap-2 mb-6">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (otpInputRefs.current[index] = el)}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className="w-12 h-14 text-center text-2xl font-bold border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow bg-gray-50 focus:bg-white"
                />
              ))}
            </div>

            <button
              type="submit"
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-md active:scale-[0.98]"
            >
              Verify OTP
            </button>

            <div className="flex flex-col space-y-3 mt-4">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend OTP'}
              </button>
              <button
                type="button"
                onClick={handleChangeEmail}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Change Email
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          By continuing, you agree to use Civic responsibly.
        </p>

      </div>
    </div>
  );
};

export default Login;