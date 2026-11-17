import React, { useState } from 'react';
import { User } from 'lucide-react';

/**
 * Smart Profile Avatar with automatic fallback to initial or Lucide user icon.
 *
 * @param {Object} props
 * @param {Object} props.user - Firebase user object (or object with photoURL, displayName, email)
 * @param {string} [props.size] - Tailwind size classes (default: 'w-9 h-9 text-sm')
 * @param {string} [props.className] - Additional CSS class names
 */
const UserAvatar = ({ user, size = 'w-9 h-9 text-sm', className = '' }) => {
  const [imageError, setImageError] = useState(false);

  const photoURL = user?.photoURL;
  const displayName = user?.displayName || '';
  const email = user?.email || '';

  // Get first letter initial
  const initial = (displayName.trim() || email.trim() || 'U')[0].toUpperCase();

  // Vibrant gradient colors based on initial character for visual richness
  const getGradientForChar = (char) => {
    const gradients = [
      'from-blue-600 to-indigo-600',
      'from-emerald-500 to-teal-600',
      'from-violet-600 to-purple-600',
      'from-amber-500 to-orange-600',
      'from-rose-500 to-pink-600',
      'from-cyan-500 to-blue-600',
    ];
    const index = (char.charCodeAt(0) || 0) % gradients.length;
    return gradients[index];
  };

  const gradientClass = getGradientForChar(initial);

  if (photoURL && !imageError) {
    return (
      <img
        src={photoURL}
        alt={displayName || 'User Avatar'}
        onError={() => setImageError(true)}
        className={`rounded-full object-cover border border-gray-200 shadow-sm ${size} ${className}`}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-gradient-to-tr ${gradientClass} text-white font-bold flex items-center justify-center shadow-sm select-none border border-white/20 ${size} ${className}`}
      title={displayName || email || 'User'}
    >
      {initial ? (
        <span>{initial}</span>
      ) : (
        <User className="w-1/2 h-1/2 text-white" />
      )}
    </div>
  );
};

export default UserAvatar;
