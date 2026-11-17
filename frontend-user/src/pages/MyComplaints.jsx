import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  MapPin,
  Clock,
  Hash,
  CheckCircle2,
  Circle,
  X,
  Trash2,
  Lightbulb,
  Construction,
  Droplets,
  AlertTriangle,
  Footprints,
  LoaderCircle,
  RefreshCw,
  Layers,
  Wrench,
  ShieldCheck,
  SlidersHorizontal,
  RotateCcw,
  Send,
  Building2,
  Briefcase,
  Check,
} from 'lucide-react';
import { getUserComplaints, citizenAction, getImageUrl } from '../services/api';
import BoundingBoxCanvas from '../components/BoundingBoxCanvas';
import ComplaintCard from '../components/ComplaintCard';

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  submitted: {
    label: 'Submitted (Intake)',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200',
  },
  assigned_ward: {
    label: 'Routed to Ward',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-700',
    badgeBorder: 'border-indigo-200',
  },
  assigned: {
    label: 'Field Assigned',
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-700',
    badgeBorder: 'border-sky-200',
  },
  working: {
    label: 'Under Working',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200',
  },
  resolved: {
    label: 'Resolved (Verify)',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
  },
  closed: {
    label: 'Closed & Confirmed',
    badgeBg: 'bg-teal-50',
    badgeText: 'text-teal-700',
    badgeBorder: 'border-teal-200',
  },
  reopened: {
    label: 'Reopened',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
    badgeBorder: 'border-rose-200',
  },
};

const getSeverityBadge = (severity) => {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'HIGH':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'LOW':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'MEDIUM':
    default:
      return 'bg-blue-100 text-blue-700 border-blue-200';
  }
};

const getCategoryIcon = (title = '') => {
  const t = title.toLowerCase();
  if (t.includes('garbage') || t.includes('waste') || t.includes('kachra')) return Trash2;
  if (t.includes('light') || t.includes('batti') || t.includes('lamp')) return Lightbulb;
  if (t.includes('water') || t.includes('leak') || t.includes('pipe')) return Droplets;
  if (t.includes('drain') || t.includes('manhole') || t.includes('sewer')) return AlertTriangle;
  if (t.includes('footpath') || t.includes('pavement')) return Footprints;
  return Construction;
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.submitted;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border shrink-0 ${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder}`}
    >
      {cfg.label}
    </span>
  );
};

// ─── Detail Modal with Citizen Confirmation & Reopen ─────────────────────────
const DetailModal = ({ complaint, onClose, onCitizenAction }) => {
  if (!complaint) return null;
  const [showComparison, setShowComparison] = useState(false);
  const [showReopenInput, setShowReopenInput] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionToast, setActionToast] = useState('');

  const workInProgress = complaint.workInProgress || {};
  const resolutionProof = complaint.resolutionProof || {};

  const handleConfirm = async () => {
    setActionLoading(true);
    const res = await onCitizenAction(complaint.id, 'confirm');
    setActionLoading(false);
    if (res.success) {
      setActionToast('Resolution confirmed! Ticket is now marked as Closed.');
    }
  };

  const handleReopen = async (e) => {
    e.preventDefault();
    if (!reopenReason.trim()) return;
    setActionLoading(true);
    const res = await onCitizenAction(complaint.id, 'reopen', reopenReason.trim());
    setActionLoading(false);
    if (res.success) {
      setShowReopenInput(false);
      setActionToast('Ticket has been reopened and routed back to Ward Supervisor.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-y-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Complaint Details</h2>
            <span className="font-mono text-xs text-gray-400">ID: {complaint.id}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toast Feedback */}
        {actionToast && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{actionToast}</span>
          </div>
        )}

        {/* Primary Reported Image */}
        <div className="w-full overflow-hidden bg-gray-100 relative">
          {complaint.boundingBox && complaint.boundingBox.some((v) => v > 0) ? (
            <BoundingBoxCanvas imageUrl={complaint.image} boundingBox={complaint.boundingBox} />
          ) : (
            <img src={complaint.image} alt={complaint.title} className="w-full h-56 object-cover" />
          )}
          <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded">
            Citizen Reported Image
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-gray-900">{complaint.title}</h3>
              {complaint.titleHi && <p className="text-xs text-gray-500 mt-0.5">{complaint.titleHi}</p>}
            </div>
            <StatusBadge status={complaint.status} />
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md uppercase border ${getSeverityBadge(
                complaint.severity
              )}`}
            >
              Severity: {complaint.severity}
            </span>
            {complaint.reportCount > 1 && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                <Layers className="w-3 h-3 text-amber-600" />
                {complaint.reportCount} Citizens Reported
              </span>
            )}
            {complaint.wardName && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-indigo-600" />
                {complaint.wardName}
              </span>
            )}
            {complaint.deptName && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1">
                <Briefcase className="w-3 h-3 text-blue-600" />
                {complaint.deptName}
              </span>
            )}
          </div>

          <div className="space-y-1.5 text-sm text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-xs font-medium">{complaint.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-xs">
                {complaint.date} &bull; {complaint.time}
              </span>
            </div>
          </div>

          {/* Under Working Details */}
          {['In Progress', 'Under Working'].includes(complaint.rawStatus) && (
            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                <Wrench className="w-4 h-4 text-blue-600" />
                <span>Municipal Field Status</span>
              </div>
              <p className="text-xs text-blue-800">
                {workInProgress.officialRemark || 'Municipal team dispatched and actively resolving the issue.'}
              </p>
              {workInProgress.imageUrl && (
                <div className="mt-2 rounded-lg overflow-hidden border border-blue-200">
                  <img src={workInProgress.imageUrl} alt="On Site Inspection" className="w-full h-44 object-cover" />
                </div>
              )}
            </div>
          )}

          {/* Resolved Proof Details (Before vs After) */}
          {['Resolved', 'Closed'].includes(complaint.rawStatus) && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Resolution Verification</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowComparison(!showComparison)}
                  className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-lg hover:bg-emerald-200 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  {showComparison ? 'Hide Grid' : 'Compare Before/After'}
                </button>
              </div>

              <p className="text-xs text-emerald-800">
                {resolutionProof.officialRemark || 'The civic issue has been resolved and verified by municipal officers.'}
              </p>

              {showComparison ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-[10px] font-bold text-red-600 uppercase block mb-1">
                      Before (Reported)
                    </span>
                    <img src={complaint.image} alt="Before" className="w-full h-28 object-cover rounded-lg border border-red-200" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase block mb-1">
                      After (Fixed)
                    </span>
                    <img
                      src={resolutionProof.imageUrl || complaint.image}
                      alt="After"
                      className="w-full h-28 object-cover rounded-lg border border-emerald-300"
                    />
                  </div>
                </div>
              ) : resolutionProof.imageUrl ? (
                <div className="rounded-lg overflow-hidden border border-emerald-200">
                  <img src={resolutionProof.imageUrl} alt="Resolution Fix" className="w-full h-44 object-cover" />
                </div>
              ) : null}
            </div>
          )}

          {/* Citizen Confirmation Action Bar on 'Resolved' tickets */}
          {complaint.rawStatus === 'Resolved' && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Citizen Action Required</span>
                <span className="text-[10px] text-slate-500">Confirm or request re-work</span>
              </div>

              {!showReopenInput ? (
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleConfirm}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm & Close
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => setShowReopenInput(true)}
                    className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Not Fixed? Reopen
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReopen} className="space-y-2 pt-1">
                  <label className="block text-[11px] font-bold text-rose-800">
                    Reason for Reopening Issue *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Describe what was not resolved or if hazard returned..."
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-rose-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowReopenInput(false)}
                      className="text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading || !reopenReason.trim()}
                      className="text-xs font-bold px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {actionLoading ? 'Submitting...' : 'Submit Reopen'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Verified Closed Banner */}
          {complaint.rawStatus === 'Closed' && (
            <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-xl flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-teal-600 flex-shrink-0" />
              <div className="text-xs text-teal-900">
                <p className="font-bold">Issue Verified & Closed by You</p>
                <p className="text-[11px] text-teal-700 mt-0.5">
                  Thank you for confirming the repair. Your feedback helps ensure high municipal quality standards.
                </p>
              </div>
            </div>
          )}

          {/* Reopened Banner */}
          {complaint.rawStatus === 'Reopened' && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
              <RotateCcw className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900">
                <p className="font-bold">Issue Reopened by You</p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Returned to Ward Supervisor for re-inspection and corrective dispatch.
                </p>
                {complaint.reopenReason && (
                  <p className="text-[11px] italic text-amber-700 mt-1">"{complaint.reopenReason}"</p>
                )}
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              5-Tier Municipal Timeline
            </p>
            <div className="space-y-3">
              {complaint.timeline?.map((event, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-blue-600 shrink-0 mt-0.5" />
                    {idx < complaint.timeline.length - 1 && (
                      <div className="w-0.5 flex-1 bg-gray-200 my-1" style={{ minHeight: 20 }} />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">{event.step}</p>
                    <p className="text-[11px] text-gray-400">
                      {event.date} &bull; {event.time}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">{event.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 active:bg-blue-800 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Filter Options ───────────────────────────────────────────────────────────
const FILTER_OPTIONS = [
  { label: 'All', value: 'all', backendStatus: 'all' },
  { label: 'Submitted', value: 'submitted', backendStatus: 'Submitted' },
  { label: 'Under Working', value: 'working', backendStatus: 'In Progress' },
  { label: 'Resolved (To Verify)', value: 'resolved', backendStatus: 'Resolved' },
  { label: 'Closed', value: 'closed', backendStatus: 'Closed' },
];

// ─── Main Page ────────────────────────────────────────────────────────────────
const MyComplaints = () => {
  const location = useLocation();
  const highlightId = location.state?.highlightId;

  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [counts, setCounts] = useState({
    total: 0,
    submitted: 0,
    working: 0,
    resolved: 0,
    closed: 0,
  });

  const loadComplaints = async (filterValue = activeFilter) => {
    setLoading(true);
    setError('');

    const targetOpt = FILTER_OPTIONS.find((f) => f.value === filterValue);
    const backendStatus = targetOpt?.backendStatus || 'all';

    try {
      const response = await getUserComplaints(backendStatus);

      if (response && response.success) {
        setCounts({
          total: response.totalCount || 0,
          submitted: response.submittedCount || response.pendingCount || 0,
          working: response.workingCount || 0,
          resolved: response.resolvedCount || 0,
          closed: response.closedCount || 0,
        });

        const rawList = response.data || [];
        const formatted = rawList.map((item) => {
          const createdAt = new Date(item.createdAt || Date.now());
          const date = createdAt.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
          const time = createdAt.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });

          // Map backend status to UI status key
          let uiStatus = 'submitted';
          if (item.status === 'Assigned to Ward') uiStatus = 'assigned_ward';
          else if (item.status === 'Assigned') uiStatus = 'assigned';
          else if (item.status === 'In Progress' || item.status === 'Under Working') uiStatus = 'working';
          else if (item.status === 'Resolved') uiStatus = 'resolved';
          else if (item.status === 'Closed') uiStatus = 'closed';
          else if (item.status === 'Reopened') uiStatus = 'reopened';

          const titleEn = item.title?.en || item.title || 'Civic Issue';
          const titleHi = item.title?.hi || '';

          // Build Dynamic 5-Tier Timeline
          const timeline = [
            {
              step: 'Complaint Submitted',
              date,
              time,
              note: 'Reported by Citizen & AI verified with Florence-2 vision model.',
            },
          ];

          if (item.wardId) {
            timeline.push({
              step: 'Routed to Ward',
              date,
              time,
              note: `Routed to ${item.wardId.name || 'Municipal Ward'} by Central Intake Managing Officer.`,
            });
          }

          if (item.departmentId || item.assignedFieldOfficerId) {
            timeline.push({
              step: 'Dispatched to Field Crew',
              date,
              time,
              note: `Allocated to ${item.departmentId?.name || 'Department'} crew for on-ground repair.`,
            });
          }

          if (['In Progress', 'Under Working', 'Resolved', 'Closed'].includes(item.status)) {
            timeline.push({
              step: 'Ground Work Underway',
              date: item.workInProgress?.updatedAt
                ? new Date(item.workInProgress.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                : date,
              time: item.workInProgress?.updatedAt
                ? new Date(item.workInProgress.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                : time,
              note: item.workInProgress?.officialRemark || 'Ground crew commenced active repair work on site.',
            });
          }

          if (['Resolved', 'Closed'].includes(item.status)) {
            timeline.push({
              step: 'Issue Resolved & Proof Submitted',
              date: item.resolutionProof?.resolvedAt
                ? new Date(item.resolutionProof.resolvedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                : date,
              time: item.resolutionProof?.resolvedAt
                ? new Date(item.resolutionProof.resolvedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                : time,
              note: item.resolutionProof?.officialRemark || 'Field crew completed fix and uploaded photographic evidence.',
            });
          }

          if (item.status === 'Closed') {
            timeline.push({
              step: 'Closed & Confirmed',
              date,
              time,
              note: 'Resolution verified and officially closed by the reporting citizen.',
            });
          } else if (item.status === 'Reopened') {
            timeline.push({
              step: 'Reopened by Citizen',
              date,
              time,
              note: item.reopenReason ? `Reopened reason: "${item.reopenReason}"` : 'Issue reopened for further repair.',
            });
          }

          const locationStr = [item.address?.areaName, item.address?.city, item.address?.road]
            .filter(Boolean)
            .join(', ') || 'Local Vicinity';

          return {
            id: item._id,
            title: titleEn,
            titleHi,
            location: locationStr,
            wardName: item.wardId?.name || null,
            deptName: item.departmentId?.name || null,
            date,
            time,
            status: uiStatus,
            rawStatus: item.status,
            reopenReason: item.reopenReason || '',
            severity: item.severity || 'MEDIUM',
            reportCount: item.reportCount || 1,
            isRecurrent: Boolean(item.isRecurrent),
            recurrentFromTicketId: item.recurrentFromTicketId || null,
            description: titleEn,
            image: getImageUrl(item.imageUrl),
            boundingBox: item.boundingBox || [0, 0, 0, 0],
            icon: getCategoryIcon(titleEn),
            workInProgress: {
              imageUrl: item.workInProgress?.imageUrl ? getImageUrl(item.workInProgress.imageUrl) : null,
              updatedAt: item.workInProgress?.updatedAt || null,
              officialRemark: item.workInProgress?.officialRemark || '',
            },
            resolutionProof: {
              imageUrl: item.resolutionProof?.imageUrl ? getImageUrl(item.resolutionProof.imageUrl) : null,
              resolvedAt: item.resolutionProof?.resolvedAt || null,
              officialRemark: item.resolutionProof?.officialRemark || '',
            },
            timeline,
          };
        });

        // Apply strict client-side filtering matching the active tab
        let displayedList = formatted;
        if (filterValue === 'submitted') {
          displayedList = formatted.filter((c) =>
            ['Submitted', 'Assigned to Ward', 'Pending'].includes(c.rawStatus)
          );
        } else if (filterValue === 'working') {
          displayedList = formatted.filter((c) =>
            ['In Progress', 'Assigned', 'Under Working', 'Reopened'].includes(c.rawStatus)
          );
        } else if (filterValue === 'resolved') {
          displayedList = formatted.filter((c) => c.rawStatus === 'Resolved');
        } else if (filterValue === 'closed') {
          displayedList = formatted.filter((c) => c.rawStatus === 'Closed');
        }

        setComplaints(displayedList);

        // Auto-open or highlight ticket from notification navigation
        if (highlightId) {
          const match = formatted.find(
            (c) => String(c.id) === String(highlightId) || String(c._id) === String(highlightId)
          );
          if (match) {
            setSelectedComplaint(match);
          }
        }
      }
    } catch (err) {
      console.error('[MyComplaints Error]:', err);
      setError('Could not connect to live backend. Please ensure the backend server is running.');
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComplaints(activeFilter);
  }, [activeFilter]);

  // Citizen Action Handler (Confirm / Reopen)
  const handleCitizenAction = async (id, action, reason = '') => {
    try {
      const res = await citizenAction(id, { action, reason });
      const newRawStatus = action === 'confirm' ? 'Closed' : 'Reopened';
      const newUiStatus = action === 'confirm' ? 'closed' : 'reopened';

      setComplaints((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                rawStatus: newRawStatus,
                status: newUiStatus,
                reopenReason: action === 'reopen' ? reason : c.reopenReason,
              }
            : c
        )
      );

      setSelectedComplaint((prev) =>
        prev && prev.id === id
          ? {
              ...prev,
              rawStatus: newRawStatus,
              status: newUiStatus,
              reopenReason: action === 'reopen' ? reason : prev.reopenReason,
            }
          : prev
      );

      return { success: true, message: res.message };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || err.message };
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 pb-24">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                  My Reported Issues
                </h1>
                <p className="text-xs text-gray-500 mt-1">
                  Track real-time municipal resolution, inspect before vs after evidence, and confirm fixes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadComplaints(activeFilter)}
                className="p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                title="Refresh Grievances"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-4 pt-6">
          {error && (
            <div className="p-4 mb-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={() => loadComplaints(activeFilter)}
                className="font-bold underline ml-2 hover:text-amber-900"
              >
                Retry
              </button>
            </div>
          )}

          {/* Filter tabs */}
          <div className="flex flex-wrap gap-2 mb-5">
            {FILTER_OPTIONS.map((opt) => {
              let badgeCount = counts.total;
              if (opt.value === 'submitted') badgeCount = counts.submitted;
              if (opt.value === 'working') badgeCount = counts.working;
              if (opt.value === 'resolved') badgeCount = counts.resolved;
              if (opt.value === 'closed') badgeCount = counts.closed;

              return (
                <button
                  key={opt.value}
                  onClick={() => setActiveFilter(opt.value)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                    activeFilter === opt.value
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                  }`}
                >
                  <span>{opt.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      activeFilter === opt.value ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {badgeCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* List */}
          <div className="space-y-4">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-gray-400">
                <LoaderCircle className="w-8 h-8 animate-spin text-blue-600 mb-3" />
                <p className="text-sm font-medium">Fetching your civic tickets...</p>
              </div>
            ) : complaints.length > 0 ? (
              complaints.map((complaint) => {
                const isHighlighted = String(complaint.id) === String(highlightId);
                return (
                  <div
                    key={complaint.id}
                    className={`transition-all rounded-2xl ${
                      isHighlighted ? 'ring-2 ring-blue-500 shadow-md ring-offset-2' : ''
                    }`}
                  >
                    <ComplaintCard complaint={complaint} onViewDetails={setSelectedComplaint} />
                  </div>
                );
              })
            ) : (
              <div className="text-center py-20 bg-white rounded-2xl border border-gray-200 p-8 shadow-xs">
                <Circle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-900 mb-1">No complaints found</h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  You have not reported any civic issues under this filter yet. When you capture a hazard from the
                  Home tab, it will appear here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedComplaint && (
        <DetailModal
          complaint={selectedComplaint}
          onClose={() => setSelectedComplaint(null)}
          onCitizenAction={handleCitizenAction}
        />
      )}
    </>
  );
};

export default MyComplaints;