import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  Bot,
  MapPin,
  Navigation,
  CheckCircle2,
  LoaderCircle,
  Copy,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Layers,
  ArrowRight,
  Map as MapIcon,
  Crosshair,
} from 'lucide-react';
import { previewComplaint, submitComplaint } from '../services/api';
import { requestNotificationPermission } from '../services/notificationService';
import BoundingBoxCanvas from '../components/BoundingBoxCanvas';
import LocationMapPicker from '../components/LocationMapPicker';

const Home = () => {
  const navigate = useNavigate();

  // Proactively request FCM web push notification permissions for ticket status updates
  useEffect(() => {
    requestNotificationPermission().catch((err) => {
      console.debug('[FCM Permission Note]:', err);
    });
  }, []);
  const [currentStep, setCurrentStep] = useState(1);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [originalDescription, setOriginalDescription] = useState('');

  // Location State
  const [locationStatus, setLocationStatus] = useState('idle'); // 'idle', 'detecting', 'success', 'error'
  const [locationError, setLocationError] = useState('');
  const [locationData, setLocationData] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);

  // AI Analysis State (Stage 1)
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [defectType, setDefectType] = useState({
    en: 'Civic Defect',
    hi: 'नागरिक समस्या',
  });
  const [bilingualIssue, setBilingualIssue] = useState({
    en: 'Civic defect detected at reported coordinates.',
    hi: 'रिपोर्ट किए गए स्थान पर नागरिक समस्या पाई गई।',
  });
  const [boundingBox, setBoundingBox] = useState([0, 0, 0, 0]);
  const [selectedLanguage, setSelectedLanguage] = useState('EN');
  const [wasEdited, setWasEdited] = useState(false);
  const [aiDescription, setAiDescription] = useState('');

  // Submission State (Stage 2)
  const [submissionState, setSubmissionState] = useState('idle'); // 'idle', 'submitting', 'success', 'error'
  const [submissionErrorMsg, setSubmissionErrorMsg] = useState('');
  const [complaintResult, setComplaintResult] = useState(null);
  const [complaintId, setComplaintId] = useState(null);

  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // Auto GPS Location Detection
  const detectLocation = () => {
    setLocationStatus('detecting');
    setLocationError('');
    setLocationData(null);

    if (!navigator.geolocation) {
      setLocationStatus('error');
      setLocationError('Geolocation is not supported by your browser. Please drop a pin on the map manually.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1`
          );
          if (!response.ok) throw new Error('Network response was not ok');
          const data = await response.json();

          let formattedAddress = '';
          let road = null,
            area = null,
            city = null,
            state = null,
            country = null,
            postcode = null;

          if (data && data.address) {
            const addr = data.address;
            road = addr.road || addr.street || addr.pedestrian || null;
            area =
              addr.suburb ||
              addr.neighbourhood ||
              addr.village ||
              addr.subdivision ||
              null;
            city =
              addr.city ||
              addr.town ||
              addr.municipality ||
              addr.county ||
              null;
            state = addr.state || null;
            country = addr.country || null;
            postcode = addr.postcode || null;

            const parts = [road, area, city, state, country, postcode].filter(
              Boolean
            );
            formattedAddress = parts.join(', ');
          }

          setLocationData({
            latitude,
            longitude,
            accuracy: Math.round(accuracy),
            formattedAddress: formattedAddress || null,
            road: road || '',
            area: area || city || 'Local Area',
            city: city || 'City',
            state: state || '',
            country,
            postcode,
            isManual: false,
          });
          setLocationStatus('success');
        } catch (err) {
          console.error('Geocoding error:', err);
          setLocationData({
            latitude,
            longitude,
            accuracy: Math.round(accuracy),
            formattedAddress: null,
            road: '',
            area: 'Local Area',
            city: 'City',
            state: '',
            country: null,
            postcode: null,
            isManual: false,
          });
          setLocationStatus('success');
        }
      },
      (geoErr) => {
        setLocationStatus('error');
        switch (geoErr.code) {
          case geoErr.PERMISSION_DENIED:
            setLocationError(
              'Location permission was denied. You can set the location on the map below.'
            );
            break;
          case geoErr.POSITION_UNAVAILABLE:
            setLocationError('GPS signal unavailable. You can drop a pin on the map.');
            break;
          case geoErr.TIMEOUT:
            setLocationError('Location request timed out. Please pick location on map.');
            break;
          default:
            setLocationError(
              'Could not detect current GPS. Please drop a pin on the map.'
            );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  // Handle Manual Pin Drop confirmation from LocationMapPicker modal
  const handleManualLocationConfirm = (manualData) => {
    setLocationData({
      latitude: manualData.latitude,
      longitude: manualData.longitude,
      accuracy: manualData.accuracy || 5,
      formattedAddress: manualData.formattedAddress,
      road: manualData.road || '',
      area: manualData.area || manualData.city || 'Local Area',
      city: manualData.city || 'City',
      state: manualData.state || '',
      isManual: true,
    });
    setLocationStatus('success');
    setLocationError('');
    setError('');
  };

  const handleImageCapture = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const objectUrl = URL.createObjectURL(file);
      setImagePreview(objectUrl);
      setError('');
      // Trigger location immediately after image capture
      detectLocation();
    }
  };

  const handleCopyCoords = () => {
    if (locationData) {
      navigator.clipboard.writeText(
        `${locationData.latitude}, ${locationData.longitude}`
      );
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  // Step 1 -> Step 2: Trigger AI Stage 1 Preview
  const handleNextToStep2 = async () => {
    if (!imagePreview || !imageFile) {
      setError('Please capture or upload an image first.');
      return;
    }
    if (locationStatus !== 'success' || !locationData) {
      setError('Please detect your location or drop a pin on the map before proceeding.');
      return;
    }

    setError('');
    setAiLoading(true);
    setAiError('');

    try {
      // Call Backend Stage 1: /api/complaints/preview
      const result = await previewComplaint(imageFile);

      if (result && result.data) {
        const payload = result.data;
        const suggested =
          payload.suggested_description ||
          payload.final_issue ||
          {};
        const defect =
          payload.defect_type ||
          {};

        // Extract full model-generated description
        const enDesc =
          suggested.en ||
          originalDescription ||
          'Civic hazard detected in vicinity.';
        const hiDesc =
          suggested.hi ||
          'सार्वजनिक क्षेत्र में नागरिक समस्या की पहचान की गई है।';

        // Extract 1-2 word defect title
        let enDefect = defect.en;
        let hiDefect = defect.hi;

        if (!enDefect) {
          const enWords = enDesc
            .replace(/[^a-zA-Z\s]/g, '')
            .split(/\s+/)
            .filter(
              (w) =>
                !['a', 'an', 'the', 'in', 'on', 'of', 'with', 'there', 'is', 'are', 'large', 'small', 'visible'].includes(
                  w.toLowerCase()
                )
            );
          enDefect =
            enWords
              .slice(0, 2)
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(' ') || 'Civic Defect';
          hiDefect = 'नागरिक समस्या';
        }

        setBilingualIssue({ en: enDesc, hi: hiDesc });
        setDefectType({ en: enDefect, hi: hiDefect });
        setBoundingBox(payload.bounding_box || [0, 0, 0, 0]);
        setAiDescription(selectedLanguage === 'HI' ? hiDesc : enDesc);
        setWasEdited(false);
      }
    } catch (err) {
      console.warn('[AI Preview Note] Microservice preview fallback triggered:', err);
      // Clean fallback if AI microservice is warming up
      const fallbackEn =
        originalDescription ||
        'Civic hazard detected at reported coordinates. Inspection requested.';
      const fallbackHi =
        'रिपोर्ट किए गए स्थान पर नागरिक समस्या पाई गई। निरीक्षण का अनुरोध किया गया है।';

      setBilingualIssue({ en: fallbackEn, hi: fallbackHi });
      setDefectType({ en: 'Civic Defect', hi: 'नागरिक समस्या' });
      setBoundingBox([0, 0, 0, 0]);
      setAiDescription(selectedLanguage === 'HI' ? fallbackHi : fallbackEn);
      setAiError(
        'AI vision service is offline or warming up; you can review and edit the description manually.'
      );
    } finally {
      setAiLoading(false);
      setCurrentStep(2);
    }
  };

  const handleLanguageToggle = (lang) => {
    setSelectedLanguage(lang);
    if (!wasEdited) {
      setAiDescription(lang === 'HI' ? bilingualIssue.hi : bilingualIssue.en);
    }
  };

  const handleAiDescriptionChange = (e) => {
    setAiDescription(e.target.value);
    setWasEdited(true);
  };

  const handleNextToStep3 = () => {
    if (!aiDescription.trim()) {
      setError('Please provide a description of the issue.');
      return;
    }
    setCurrentStep(3);
  };

  // Step 3 -> Step 4: Submit to Backend (Stage 2)
  const handleSubmit = async () => {
    if (submissionState === 'submitting') return;
    setSubmissionState('submitting');
    setSubmissionErrorMsg('');

    try {
      const response = await submitComplaint({
        image: imageFile,
        final_text: aiDescription,
        was_edited: wasEdited,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        areaName: locationData.area || locationData.city || 'Local Area',
        city: locationData.city || 'Local City',
        road: locationData.road || '',
        suburb: locationData.area || '',
        state: locationData.state || '',
      });

      if (response && response.success) {
        const ticket = response.complaint || {};
        const id = ticket._id || `CVC-${Date.now().toString().slice(-6)}`;
        setComplaintId(id);
        setComplaintResult(response);
        setSubmissionState('success');
        setCurrentStep(4);
      } else {
        throw new Error(response?.message || 'Submission failed.');
      }
    } catch (err) {
      console.error('[Complaint Submission Error]:', err);
      setSubmissionState('error');
      setSubmissionErrorMsg(
        err.response?.data?.message ||
          err.message ||
          'Failed to submit complaint to the server. Please verify your connection.'
      );
    }
  };

  // Step 4: Success Screen
  if (currentStep === 4) {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const formattedTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const isDuplicate = complaintResult?.is_duplicate;
    const similarityScore = complaintResult?.similarity_score;
    const complaintData = complaintResult?.complaint;

    return (
      <div className="flex flex-col items-center justify-center p-4 h-full min-h-[calc(100vh-4rem)]">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8 text-center max-w-md w-full animate-in fade-in zoom-in duration-300">
          <div className="mx-auto h-20 w-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(34,197,94,0.3)]">
            <CheckCircle2 className="h-10 w-10" strokeWidth={2.5} />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {isDuplicate ? 'Report Upvoted & Prioritized!' : 'Request Successfully Submitted'}
          </h2>

          <p className="text-gray-500 mb-6 text-sm">
            {isDuplicate
              ? `AI spatial deduplication detected an existing active issue within 50 meters (similarity: ${(similarityScore * 100).toFixed(1)}%). We've upvoted its priority!`
              : 'Your civic complaint has been recorded and assigned to the municipal department.'}
          </p>

          {isDuplicate && (
            <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-800 flex items-start gap-2">
              <Layers className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">Community Deduplication Match</span>
                Total reports on this issue: <strong>{complaintData?.reportCount || 2}</strong>. Priority escalated to <strong>{complaintData?.severity || 'HIGH'}</strong>.
              </div>
            </div>
          )}

          {!isDuplicate && complaintResult?.is_recurrent && (
            <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-800 flex items-start gap-2">
              <RefreshCw className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">Recurring Defect Tracked</span>
                Our system detected that a similar issue was previously resolved at this location. A fresh grievance has been registered and prioritized for municipal addressing!
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-6">
            <p className="text-xs text-gray-500 font-medium mb-1 uppercase tracking-wider">Ticket Identifier</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-base font-bold text-gray-900 font-mono tracking-wide">
                {complaintId}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(complaintId);
                  setCopySuccess(true);
                  setTimeout(() => setCopySuccess(false), 2000);
                }}
                className="p-1.5 text-gray-400 hover:text-gray-700 bg-white border border-gray-200 rounded-lg shadow-sm transition-colors"
                title="Copy ID"
              >
                {copySuccess ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            {copySuccess && (
              <p className="text-xs text-green-600 mt-1 font-medium">Ticket ID copied to clipboard</p>
            )}
          </div>

          <div className="text-left bg-gray-50 rounded-xl border border-gray-200 p-4 mb-8 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <span className="text-gray-500 font-medium">Issue:</span>
              <span className="col-span-2 font-bold text-gray-900">
                {selectedLanguage === 'HI' ? defectType.hi : defectType.en}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <span className="text-gray-500 font-medium">Severity:</span>
              <span className="col-span-2">
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${
                    complaintData?.severity === 'CRITICAL'
                      ? 'bg-red-100 text-red-700'
                      : complaintData?.severity === 'HIGH'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {complaintData?.severity || 'MEDIUM'}
                </span>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <span className="text-gray-500 font-medium">Status:</span>
              <span className="col-span-2 text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md inline-block w-max border border-amber-200 text-xs">
                {complaintData?.status || 'Pending'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <span className="text-gray-500 font-medium">Location:</span>
              <span className="col-span-2 text-gray-900 text-xs line-clamp-2">
                {locationData?.formattedAddress || `${locationData?.latitude}, ${locationData?.longitude}`}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <span className="text-gray-500 font-medium">Submitted:</span>
              <span className="col-span-2 text-gray-900 text-xs">
                {formattedDate} &bull; {formattedTime}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate('/my-complaints')}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 text-white rounded-xl font-medium shadow-md hover:bg-blue-700 transition-colors"
            >
              View My Complaints <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setCurrentStep(1);
                setImagePreview(null);
                setImageFile(null);
                setOriginalDescription('');
                setWasEdited(false);
                setAiDescription('');
                setSelectedLanguage('EN');
                setLocationStatus('idle');
                setLocationError('');
                setLocationData(null);
                setCopySuccess(false);
                setError('');
                setSubmissionState('idle');
                setComplaintResult(null);
                setComplaintId(null);
                setBoundingBox([0, 0, 0, 0]);
                setDefectType({ en: 'Civic Defect', hi: 'नागरिक समस्या' });
              }}
              className="w-full flex items-center justify-center py-3 px-4 bg-white text-gray-700 border border-gray-200 rounded-xl font-medium shadow-sm hover:bg-gray-50 transition-colors"
            >
              Report Another Hazard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Ready to Submit
  if (currentStep === 3) {
    const isSubmitting = submissionState === 'submitting';
    const hasError = submissionState === 'error';
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const formattedTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    return (
      <div className="p-4 flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8">
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2 text-center tracking-tight">
            Ready to Submit
          </h1>
          <p className="text-center text-sm text-gray-500 mb-6">
            Please review your civic complaint details before final submission.
          </p>

          {hasError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6 text-sm text-center">
              <p className="font-bold mb-1">Submission Failed</p>
              <p>{submissionErrorMsg || 'Could not connect to backend server. Please try again.'}</p>
            </div>
          )}

          <div className="space-y-6">
            <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 shadow-sm relative">
              {boundingBox && boundingBox.some((v) => v > 0) ? (
                <BoundingBoxCanvas imageUrl={imagePreview} boundingBox={boundingBox} />
              ) : (
                <img
                  src={imagePreview}
                  alt="Captured preview"
                  className="w-full h-auto object-cover max-h-72"
                />
              )}
            </div>

            {/* Detected Defect (1-2 Word Name) */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                  Identified Defect
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-emerald-600" />
                  AI Verified
                </span>
              </div>
              <p className="text-gray-900 font-extrabold text-lg">
                {selectedLanguage === 'HI' ? defectType.hi : defectType.en}
              </p>
            </div>

            {/* Location Display in Final Step */}
            {locationData && (
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-blue-600">
                    <MapPin className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Location
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMapPickerOpen(true)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <MapIcon className="h-3.5 w-3.5" /> Adjust
                  </button>
                </div>
                {locationData.formattedAddress ? (
                  <p className="text-gray-900 font-medium text-sm mb-2 leading-snug">
                    {locationData.formattedAddress}
                  </p>
                ) : (
                  <p className="text-amber-700 font-medium text-sm mb-2">
                    Coordinates captured, but reverse address is pending.
                  </p>
                )}
                <div className="text-xs text-gray-500 font-mono">
                  {locationData.latitude.toFixed(6)}, {locationData.longitude.toFixed(6)}
                </div>
              </div>
            )}

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 relative">
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1 block">
                Final Description
              </span>
              <p className="text-gray-900 text-sm leading-relaxed">{aiDescription}</p>
              {wasEdited && (
                <span className="absolute top-4 right-4 bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200">
                  Edited
                </span>
              )}
            </div>

            {/* Date & Time */}
            <div className="text-center text-xs text-gray-500 font-medium">
              {formattedDate} &bull; {formattedTime}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setCurrentStep(2)}
                disabled={isSubmitting}
                className="flex-1 flex items-center justify-center py-3 px-4 bg-white text-gray-700 rounded-xl font-medium shadow-sm hover:bg-gray-50 border border-gray-200 transition-colors disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-[2] flex items-center justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-md active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <LoaderCircle className="h-4 w-4 animate-spin" /> Submitting...
                  </span>
                ) : hasError ? (
                  'Retry Submission'
                ) : (
                  'Confirm & Submit'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Location Map Picker Modal */}
        {isMapPickerOpen && (
          <LocationMapPicker
            initialLat={locationData?.latitude || 26.4499}
            initialLng={locationData?.longitude || 74.6399}
            initialAddress={locationData?.formattedAddress || ''}
            onConfirm={handleManualLocationConfirm}
            onClose={() => setIsMapPickerOpen(false)}
          />
        )}
      </div>
    );
  }

  // Step 2: AI Review Screen
  if (currentStep === 2) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8">
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1 text-center tracking-tight">
            AI Defect Inspection
          </h1>
          <p className="text-center text-xs text-gray-500 mb-6">
            Multi-modal vision analysis by Florence-2 &amp; FLAN-T5
          </p>

          {aiError && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl mb-4 text-xs">
              {aiError}
            </div>
          )}

          <div className="space-y-6">
            {/* Visualizer with BoundingBoxCanvas */}
            <div className="relative w-full rounded-xl overflow-hidden border border-gray-200 bg-gray-50 shadow-sm">
              {boundingBox && boundingBox.some((v) => v > 0) ? (
                <BoundingBoxCanvas imageUrl={imagePreview} boundingBox={boundingBox} />
              ) : (
                <img
                  src={imagePreview}
                  alt="Captured preview"
                  className="w-full h-auto object-cover max-h-72"
                />
              )}
            </div>

            {/* AI Analysis Section */}
            <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-blue-600">
                  <Bot className="h-5 w-5" />
                  <span className="font-semibold text-xs uppercase tracking-wider">
                    AI Grounding &amp; Detection
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <Sparkles className="h-3 w-3 text-emerald-600" />
                  Model Output
                </span>
              </div>

              {/* Identified Defect: One-Word / Two-Word Label */}
              <div className="mb-4 bg-white p-3.5 rounded-xl border border-blue-100 shadow-sm">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  Identified Defect (Issue)
                </span>
                <p className="font-extrabold text-gray-900 text-xl tracking-tight text-blue-900">
                  {selectedLanguage === 'HI' ? defectType.hi : defectType.en}
                </p>
              </div>

              {/* Model Generated Description */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    AI Description
                  </span>

                  {/* Language Toggle */}
                  <div className="flex bg-white rounded-lg border border-gray-200 p-0.5">
                    <button
                      type="button"
                      onClick={() => handleLanguageToggle('EN')}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-colors ${
                        selectedLanguage === 'EN'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      EN
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLanguageToggle('HI')}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-colors ${
                        selectedLanguage === 'HI'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      हिंदी
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    className="w-full border border-gray-200 rounded-xl p-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[110px] resize-none bg-white shadow-sm transition-shadow leading-relaxed"
                    value={aiDescription}
                    onChange={handleAiDescriptionChange}
                    placeholder="Provide details about the issue..."
                  />
                  {wasEdited && (
                    <span className="absolute bottom-3 right-3 bg-yellow-100 text-yellow-800 text-[10px] font-bold px-2 py-0.5 rounded border border-yellow-200">
                      Description edited
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Tagged Location with Map Adjustment */}
            {locationData && (
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-blue-600">
                    <Navigation className="h-4 w-4" />
                    <span className="font-semibold text-xs uppercase tracking-wider">
                      Tagged Location
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMapPickerOpen(true)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors"
                  >
                    <MapIcon className="h-3.5 w-3.5" /> Adjust on Map
                  </button>
                </div>

                {locationData.formattedAddress ? (
                  <div className="flex items-start gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="font-medium text-gray-900 text-sm leading-snug">
                      {locationData.formattedAddress}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="font-medium text-amber-700 text-sm leading-snug">
                      Coordinates captured, reverse address could not be resolved.
                    </p>
                  </div>
                )}

                <div className="text-xs text-gray-500 font-mono bg-gray-50 p-2.5 rounded-lg flex items-center justify-between">
                  <span>{locationData.latitude.toFixed(6)}, {locationData.longitude.toFixed(6)}</span>
                  {locationData.isManual && (
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                      Pinned on Map
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setCurrentStep(1)}
                className="flex-1 flex items-center justify-center py-3 px-4 bg-gray-50 text-gray-700 rounded-xl font-medium shadow-sm hover:bg-gray-100 border border-gray-200 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleNextToStep3}
                className="flex-[2] flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-md active:scale-[0.98]"
              >
                Proceed to Review
              </button>
            </div>
          </div>
        </div>

        {/* Location Map Picker Modal */}
        {isMapPickerOpen && (
          <LocationMapPicker
            initialLat={locationData?.latitude || 26.4499}
            initialLng={locationData?.longitude || 74.6399}
            initialAddress={locationData?.formattedAddress || ''}
            onConfirm={handleManualLocationConfirm}
            onClose={() => setIsMapPickerOpen(false)}
          />
        )}
      </div>
    );
  }

  // Step 1: Image Capture & Location Setup
  return (
    <div className="p-4 flex items-center justify-center min-h-[calc(100vh-4rem)]">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1 text-center tracking-tight">
          Report Civic Hazard
        </h1>
        <p className="text-center text-xs text-gray-500 mb-6">
          Capture photo and verify location for multimodal AI inspection
        </p>

        <div className="space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm text-center">
              {error}
            </div>
          )}

          {/* Image Capture Area */}
          <div className="flex flex-col items-center justify-center">
            {imagePreview ? (
              <div className="relative w-full rounded-xl overflow-hidden border border-gray-200 bg-gray-50 shadow-sm">
                <img
                  src={imagePreview}
                  alt="Captured preview"
                  className="w-full h-auto object-cover max-h-72"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-3 right-3 bg-white/90 backdrop-blur text-gray-800 p-2 rounded-lg shadow-sm font-medium text-xs border border-gray-200 hover:bg-white transition-colors"
                >
                  Change Photo
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl p-10 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer flex flex-col items-center justify-center text-gray-500"
              >
                <div className="bg-white p-3 rounded-full shadow-sm mb-3 text-blue-600">
                  <Camera className="h-8 w-8" />
                </div>
                <span className="font-semibold text-gray-900">Upload or Capture Hazard</span>
                <span className="text-xs text-gray-500 mt-1">
                  Click to select JPEG, PNG, or camera snapshot
                </span>
              </div>
            )}

            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileInputRef}
              onChange={handleImageCapture}
              className="hidden"
            />
          </div>

          {/* Location UI Section */}
          {imagePreview && (
            <div className="mt-2 space-y-3">
              {locationStatus === 'detecting' && (
                <div className="flex items-center justify-between p-4 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 shadow-sm">
                  <div className="flex items-center gap-3">
                    <LoaderCircle className="h-5 w-5 animate-spin flex-shrink-0" />
                    <span className="text-sm font-medium">Detecting GPS location...</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMapPickerOpen(true)}
                    className="text-xs font-bold text-blue-700 underline ml-2 hover:text-blue-900"
                  >
                    Set on Map
                  </button>
                </div>
              )}

              {locationStatus === 'error' && (
                <div className="flex flex-col gap-3 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 shadow-sm">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <span className="text-sm font-semibold leading-snug">
                      {locationError}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsMapPickerOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow hover:bg-blue-700 transition-colors"
                    >
                      <MapPin className="h-4 w-4" /> Drop Pin on Map
                    </button>
                    <button
                      type="button"
                      onClick={detectLocation}
                      className="flex items-center gap-1 px-3 py-2 bg-white text-gray-700 rounded-xl text-xs font-medium border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Retry GPS
                    </button>
                  </div>
                </div>
              )}

              {locationStatus === 'success' && locationData && (
                <div className="flex flex-col gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
                  <div
                    className={`absolute top-0 left-0 w-1.5 h-full ${
                      locationData.isManual ? 'bg-purple-500' : 'bg-green-500'
                    }`}
                  ></div>

                  <div className="flex items-center justify-between mb-1 pl-2">
                    <div className="flex items-center gap-2 text-gray-900">
                      <MapPin
                        className={`h-4 w-4 ${
                          locationData.isManual ? 'text-purple-600' : 'text-green-600'
                        }`}
                      />
                      <span className="text-sm font-bold tracking-tight">
                        {locationData.isManual ? 'Manual Location Pinned' : 'Location Detected'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setIsMapPickerOpen(true)}
                        className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 transition-colors"
                      >
                        <MapIcon className="h-3.5 w-3.5" />
                        <span>Change on Map</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyCoords}
                        className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
                        title="Copy Coordinates"
                      >
                        {copySuccess ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="pl-2">
                    {locationData.formattedAddress ? (
                      <p className="text-sm text-gray-800 font-medium leading-snug mb-2">
                        {locationData.formattedAddress}
                      </p>
                    ) : (
                      <div className="flex items-start gap-2 mb-2">
                        <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-amber-700 font-medium leading-snug">
                          Coordinates captured, reverse address could not be resolved.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg">
                      <div>
                        <span className="font-semibold text-gray-500">Lat:</span>{' '}
                        <span className="font-mono">{locationData.latitude.toFixed(6)}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-500">Lng:</span>{' '}
                        <span className="font-mono">{locationData.longitude.toFixed(6)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Manual Pin Change / Open Map Action */}
                  <button
                    type="button"
                    onClick={() => setIsMapPickerOpen(true)}
                    className="mt-1 w-full flex items-center justify-center gap-2 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <Crosshair className="h-3.5 w-3.5 text-blue-600" />
                    <span>Drop / Drag Pin on Interactive Map</span>
                  </button>
                </div>
              )}

              {/* In case no location is active yet */}
              {locationStatus === 'idle' && (
                <button
                  type="button"
                  onClick={() => setIsMapPickerOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors"
                >
                  <MapPin className="h-4 w-4 text-red-500" />
                  <span>Set / Drop Pin on Map Manually</span>
                </button>
              )}
            </div>
          )}

          {/* Quick optional description */}
          <div className="space-y-1.5">
            <label htmlFor="description" className="block text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Citizen Notes (Optional)
            </label>
            <textarea
              id="description"
              className="w-full border border-gray-200 rounded-xl p-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[90px] resize-none bg-gray-50 focus:bg-white transition-shadow text-sm"
              placeholder="e.g., Sadak par gehra gaddha hai ya pipeline leak ho rhi hai..."
              value={originalDescription}
              onChange={(e) => setOriginalDescription(e.target.value)}
            />
          </div>

          {/* Action Button */}
          <button
            onClick={handleNextToStep2}
            disabled={aiLoading}
            className="group relative w-full flex items-center justify-center gap-2 py-3.5 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-md active:scale-[0.98] disabled:opacity-75"
          >
            {aiLoading ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                <span>Running Florence-2 AI Inspection...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Inspect Hazard with AI</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Location Map Picker Modal */}
      {isMapPickerOpen && (
        <LocationMapPicker
          initialLat={locationData?.latitude || 26.4499}
          initialLng={locationData?.longitude || 74.6399}
          initialAddress={locationData?.formattedAddress || ''}
          onConfirm={handleManualLocationConfirm}
          onClose={() => setIsMapPickerOpen(false)}
        />
      )}
    </div>
  );
};

export default Home;
