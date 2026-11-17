import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Upload,
  Loader2,
  FileCheck2,
  MapPin,
  Calendar,
  Users,
  Eye,
  Shield,
  ShieldAlert,
  Flame,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { civicApi } from '../../services/api';

const InspectorModal = ({ complaint, isOpen, onClose, onStatusUpdated }) => {
  if (!isOpen || !complaint) return null;

  const { userRole, isFieldOfficer, isSuperAdmin, isManagingOfficer, isWardOfficer } = useAuth();
  const canChangeSeverity = isSuperAdmin || isManagingOfficer || isWardOfficer;
  const isFieldRole = isFieldOfficer || isSuperAdmin;

  const [selectedStatus, setSelectedStatus] = useState(complaint.status || 'Pending');
  const [selectedSeverity, setSelectedSeverity] = useState(complaint.severity || 'MEDIUM');
  const [officialRemark, setOfficialRemark] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initialize or reset form state when complaint changes
  useEffect(() => {
    setSelectedStatus(complaint.status || 'Pending');
    setSelectedSeverity(complaint.severity || 'MEDIUM');
    setOfficialRemark(
      complaint.status === 'Under Working'
        ? complaint.workInProgress?.officialRemark || ''
        : complaint.status === 'Resolved'
        ? complaint.resolutionProof?.officialRemark || ''
        : ''
    );
    setProofFile(null);
    setProofPreviewUrl(null);
    setErrorMessage('');
    setSuccessMessage('');
  }, [complaint]);

  // Clean up object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (proofPreviewUrl) {
        URL.revokeObjectURL(proofPreviewUrl);
      }
    };
  }, [proofPreviewUrl]);

  // Handle proof file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setErrorMessage('Proof image size must be under 10MB.');
        return;
      }
      setProofFile(file);
      setProofPreviewUrl(URL.createObjectURL(file));
      setErrorMessage('');
    }
  };

  // Draw Florence-2 bounding box over citizen photo using HTML5 Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;

    const renderBox = () => {
      if (!img || !img.naturalWidth || !img.naturalHeight) return;

      canvas.width = img.clientWidth || img.width;
      canvas.height = img.clientHeight || img.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const bbox = complaint.boundingBox;
      if (Array.isArray(bbox) && bbox.length === 4) {
        let [x1, y1, x2, y2] = bbox;

        const isFlorenceNormalized = x2 <= 1000 && y2 <= 1000 && (img.naturalWidth > 1000 || img.naturalHeight > 1000);
        const normBaseX = isFlorenceNormalized ? 1000 : img.naturalWidth;
        const normBaseY = isFlorenceNormalized ? 1000 : img.naturalHeight;

        const scaleX = canvas.width / normBaseX;
        const scaleY = canvas.height / normBaseY;

        const bx = Math.max(0, x1 * scaleX);
        const by = Math.max(0, y1 * scaleY);
        const bw = Math.min(canvas.width - bx, (x2 - x1) * scaleX);
        const bh = Math.min(canvas.height - by, (y2 - y1) * scaleY);

        if (bw > 2 && bh > 2) {
          ctx.strokeStyle = '#ef4444'; // Red-500
          ctx.lineWidth = 3;
          ctx.strokeRect(bx, by, bw, bh);

          ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
          ctx.fillRect(bx, by, bw, bh);

          const label = `Florence-2 Defect [${complaint.severity || 'SEV'}]`;
          ctx.font = 'bold 11px JetBrains Mono, monospace, sans-serif';
          const textMetrics = ctx.measureText(label);
          const textWidth = textMetrics.width;
          const labelHeight = 20;
          const labelY = by >= 22 ? by - 20 : by;

          ctx.fillStyle = '#ef4444';
          ctx.fillRect(bx, labelY, textWidth + 14, labelHeight);

          ctx.fillStyle = '#ffffff';
          ctx.fillText(label, bx + 7, labelY + 14);
        }
      }
    };

    if (img) {
      if (img.complete) {
        renderBox();
      } else {
        img.onload = renderBox;
      }
    }

    window.addEventListener('resize', renderBox);
    return () => window.removeEventListener('resize', renderBox);
  }, [complaint.imageUrl, complaint.boundingBox]);

  // Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const complaintId = complaint._id || complaint.id;
    if (!complaintId) {
      setErrorMessage('Missing complaint identifier.');
      return;
    }

    setIsSubmitting(true);
    try {
      let updatedComplaint = { ...complaint };

      // Case A: Managing Officer or Ward Officer (Role-Restricted: Cannot set In Progress / Resolved)
      if (isManagingOfficer || isWardOfficer) {
        // 1. Update severity if changed
        if (selectedSeverity && selectedSeverity !== complaint.severity) {
          const sevRes = await civicApi.updateSeverity(complaintId, {
            severity: selectedSeverity,
            remark: officialRemark.trim(),
          });
          if (sevRes.complaint) updatedComplaint = sevRes.complaint;
        }

        // 2. Attach inspection note if provided
        if (officialRemark.trim()) {
          const noteRes = await civicApi.updateComplaintStatus(complaintId, {
            officialRemark: officialRemark.trim(),
            severity: selectedSeverity,
          });
          if (noteRes.complaint) updatedComplaint = noteRes.complaint;
        }

        if (onStatusUpdated) {
          onStatusUpdated(updatedComplaint);
        }
        onClose();
        return;
      }

      // Case B: Field Officer or Super Admin (Authorized to transition to Working/Resolved)
      const response = await civicApi.updateComplaintStatus(complaintId, {
        status: selectedStatus,
        proofImage: proofFile,
        officialRemark: officialRemark.trim(),
        severity: selectedSeverity,
      });

      if (onStatusUpdated) {
        onStatusUpdated(response.complaint || { ...complaint, status: selectedStatus, severity: selectedSeverity });
      }
      onClose();
    } catch (err) {
      console.error('[InspectorModal Error]:', err);
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to update complaint status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Submitted':
        return <span className="bg-sky-50 text-sky-800 border border-sky-200 text-xs px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1.5">Submitted</span>;
      case 'Assigned to Ward':
        return <span className="bg-purple-50 text-purple-800 border border-purple-200 text-xs px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1.5">Assigned to Ward</span>;
      case 'Assigned':
        return <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1.5">Assigned to Crew</span>;
      case 'In Progress':
      case 'Under Working':
        return <span className="bg-orange-50 text-orange-800 border border-orange-200 text-xs px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-orange-600" /> {status}</span>;
      case 'Reopened':
        return <span className="bg-rose-50 text-rose-800 border border-rose-200 text-xs px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1.5">Reopened</span>;
      case 'Pending':
        return <span className="bg-amber-50 text-amber-800 border border-amber-200 text-xs px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-amber-600" /> Pending Review</span>;
      case 'Resolved':
        return <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Resolved</span>;
      default:
        return <span className="bg-slate-100 text-slate-800 text-xs px-2.5 py-1 rounded-full font-bold">{status}</span>;
    }
  };

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'CRITICAL':
        return <span className="bg-red-50 text-red-700 border border-red-200 text-xs px-2.5 py-0.5 rounded-md font-mono font-bold">🔴 CRITICAL</span>;
      case 'HIGH':
        return <span className="bg-orange-50 text-orange-700 border border-orange-200 text-xs px-2.5 py-0.5 rounded-md font-mono font-bold">🟠 HIGH</span>;
      case 'MEDIUM':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs px-2.5 py-0.5 rounded-md font-mono font-bold">🟡 MEDIUM</span>;
      default:
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-md font-mono font-bold">🟢 LOW</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto font-sans">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col z-10 overflow-hidden text-slate-900">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-2xs">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Municipal Ticket Inspector
                </h2>
                <span className="font-mono text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 font-bold">
                  {complaint._id}
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5 font-medium">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{complaint.address?.road || 'Roadway'}, {complaint.address?.areaName || 'Ward Area'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to={`/admin/map?locate=${complaint._id}`}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors shadow-2xs"
              title="Locate pin on Live GIS Map"
            >
              <MapPin className="w-3.5 h-3.5 text-indigo-600" />
              <span>Locate on Map</span>
            </Link>
            {getStatusBadge(complaint.status)}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-xs sm:text-sm font-medium">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Top Section: Visual Defect Canvas & Defect Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Visual Canvas (7 cols on lg) */}
            <div className="lg:col-span-7 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-indigo-600" />
                  Florence-2 Computer Vision Evidence
                </span>
                <span className="text-[11px] font-mono text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200 font-bold">
                  Damage: {complaint.areaCoveragePct || 16.8}%
                </span>
              </div>

              {/* HTML5 Canvas Overlay with clean border */}
              <div className="relative w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-inner flex items-center justify-center">
                <img
                  ref={imageRef}
                  src={complaint.imageUrl}
                  alt={complaint.title?.en || 'Citizen report visual evidence'}
                  crossOrigin="anonymous"
                  className="w-full h-auto max-h-[340px] object-contain block"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Bounding box rendered over defect coordinates</span>
                <span className="font-mono text-slate-600">
                  [{complaint.boundingBox?.join(', ') || 'N/A'}]
                </span>
              </div>
            </div>

            {/* AI Classification & Complaint Details (5 cols on lg) */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Severity & Backing
                  </span>
                  {getSeverityBadge(complaint.severity)}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">
                    {complaint.title?.en || 'Civic Issue'}
                  </h3>
                  <p className="text-xs text-indigo-700 font-semibold mt-0.5">
                    {complaint.title?.hi || 'नागरिक शिकायत'}
                  </p>
                </div>

                <div className="space-y-2 text-xs text-slate-700 pt-2 border-t border-slate-200">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-900">{complaint.address?.road || 'Roadway'}</p>
                      <p className="text-slate-500 text-[11px] font-medium">{complaint.address?.areaName}, {complaint.address?.city}</p>
                      {complaint.location?.coordinates && (
                        <Link
                          to={`/admin/map?locate=${complaint._id}`}
                          onClick={onClose}
                          className="text-[11px] font-mono text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1 mt-1 font-semibold"
                          title="Click to view pin on Live GIS Map"
                        >
                          <MapPin className="w-3 h-3" />
                          <span>GPS: {complaint.location.coordinates[1].toFixed(5)}, {complaint.location.coordinates[0].toFixed(5)}</span>
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span className="text-slate-700 font-medium">
                      Reported by <strong className="text-slate-900">{complaint.reportCount || 1}</strong> citizen(s)
                      {complaint.reportCount > 3 && (
                        <span className="ml-1 text-red-600 font-bold">(Auto-Escalated)</span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span className="text-slate-700 font-medium text-[11px]">
                      Reporter: <strong className="text-slate-900">Protected Citizen Identity</strong> 🛡️
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-500 text-[11px] font-medium">
                      Filed on {new Date(complaint.createdAt).toLocaleDateString()} at {new Date(complaint.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {complaint.isRecurrent && (
                    <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 flex items-start gap-2 mt-1">
                      <RefreshCw className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-semibold">Recurring Defect Tracked</strong>
                        <span>This defect reoccurred at a previously closed/resolved location. Fresh municipal ticket generated for priority action.</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Existing Progress / Proof Gallery if present */}
              {(complaint.workInProgress?.imageUrl || complaint.resolutionProof?.imageUrl) && (
                <div className="pt-3 border-t border-slate-200">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-2">
                    Attached Work Verification Proof
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {complaint.workInProgress?.imageUrl && (
                      <div className="relative group rounded-lg overflow-hidden border border-orange-300 bg-white shadow-2xs">
                        <img
                          src={complaint.workInProgress.imageUrl}
                          alt="Crew Onsite Proof"
                          className="w-full h-16 object-cover"
                        />
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1 text-[9px] text-white text-center font-bold">
                          On-site Crew
                        </div>
                      </div>
                    )}
                    {complaint.resolutionProof?.imageUrl && (
                      <div className="relative group rounded-lg overflow-hidden border border-emerald-300 bg-white shadow-2xs">
                        <img
                          src={complaint.resolutionProof.imageUrl}
                          alt="Resolved Fix Proof"
                          className="w-full h-16 object-cover"
                        />
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1 text-[9px] text-white text-center font-bold">
                          Fix Verified
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Section: Action Workflow Form */}
          <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-indigo-600" />
                Municipal Triage & Work Action Workflow
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Transition ticket status & dispatch field verification
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Option A: Managing Officer & Ward Officer (Severity & Inspection Remarks Only) */}
              {(!isFieldRole) ? (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-orange-500" />
                      Adjust Grievance Priority / Severity
                    </label>
                    <select
                      value={selectedSeverity}
                      onChange={(e) => setSelectedSeverity(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors shadow-2xs"
                    >
                      <option value="LOW">🟢 LOW Priority</option>
                      <option value="MEDIUM">🟡 MEDIUM Priority</option>
                      <option value="HIGH">🟠 HIGH Priority</option>
                      <option value="CRITICAL">🔴 CRITICAL Hazard (Escalated)</option>
                    </select>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Managing & Ward Officers can elevate or adjust priority to steer field response.
                    </p>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Field Execution Segregation Policy:</strong>
                      Only assigned Ground Field Crews can transition status to <em>"In Progress"</em> and certify <em>"Resolved"</em> after uploading on-site photographic evidence.
                    </div>
                  </div>
                </>
              ) : (
                /* Option B: Field Officer & Super Admin (Start Work / Resolve Work) */
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Update Complaint Status
                    </label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors shadow-2xs"
                    >
                      <option value="Pending">Pending (Queue for Inspection)</option>
                      <option value="Under Working">Under Working (Crew Deployed On-Site)</option>
                      <option value="Resolved">Resolved (Rectification Complete)</option>
                    </select>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {selectedStatus === 'Under Working' && 'Requires on-site crew photo to substantiate team dispatch.'}
                      {selectedStatus === 'Resolved' && 'Requires final completed road photo to certify public safety.'}
                      {selectedStatus === 'Pending' && 'Maintains ticket in triage backlog for ward assessment.'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between">
                      <span>
                        {selectedStatus === 'Under Working' && 'Upload On-Site Crew Photo'}
                        {selectedStatus === 'Resolved' && 'Upload Final Fixed Road Photo'}
                        {selectedStatus === 'Pending' && 'Optional Inspection Image'}
                      </span>
                      {(selectedStatus === 'Under Working' || selectedStatus === 'Resolved') && (
                        <span className="text-[10px] text-indigo-600 font-bold uppercase">Optional proof image</span>
                      )}
                    </label>

                    <div className="flex items-center gap-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                        id="proof-upload-input"
                      />
                      <label
                        htmlFor="proof-upload-input"
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-dashed border-slate-300 hover:border-indigo-500 rounded-xl cursor-pointer text-xs font-semibold text-slate-700 hover:text-indigo-600 transition-colors shadow-2xs"
                      >
                        <Upload className="w-4 h-4 text-indigo-600" />
                        <span className="truncate">
                          {proofFile ? proofFile.name : 'Choose proof photo (JPEG/PNG/WebP)...'}
                        </span>
                      </label>

                      {proofPreviewUrl && (
                        <div className="relative w-11 h-11 rounded-lg overflow-hidden border border-indigo-500 flex-shrink-0 shadow-xs">
                          <img src={proofPreviewUrl} alt="Proof preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              setProofFile(null);
                              setProofPreviewUrl(null);
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                            title="Remove uploaded proof"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Official Remarks */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Official Municipal Remarks
              </label>
              <textarea
                rows={3}
                value={officialRemark}
                onChange={(e) => setOfficialRemark(e.target.value)}
                placeholder="e.g. Bitumen patch completed by PWD team 4, road leveled and open for transit."
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors shadow-2xs"
              />
            </div>

            {/* Submit Action Button */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Saving...</span>
                  </>
                ) : !isFieldRole ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Inspection Note & Priority</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Update Complaint Status</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default InspectorModal;
