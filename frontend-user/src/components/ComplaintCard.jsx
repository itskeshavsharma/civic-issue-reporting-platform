import React, { useState } from 'react';
import {
  MapPin,
  Clock,
  Hash,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Sparkles,
  ChevronDown,
  Layers,
  ShieldCheck,
  Eye,
  SlidersHorizontal,
  RefreshCw,
} from 'lucide-react';
import BoundingBoxCanvas from './BoundingBoxCanvas';

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

/**
 * Progressive Complaint Card Component
 * Dynamically switches layout and visual proofs based on status ('Pending', 'Under Working', 'Resolved').
 */
const ComplaintCard = ({ complaint, onViewDetails }) => {
  const [showProofComparison, setShowProofComparison] = useState(false);
  const rawStatus = complaint.rawStatus || 'Pending';

  const hasBoundingBox =
    Array.isArray(complaint.boundingBox) &&
    complaint.boundingBox.some((v) => v > 0);

  const workInProgress = complaint.workInProgress || {};
  const resolutionProof = complaint.resolutionProof || {};

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col">
      {/* ── CARD HEADER ── */}
      <div className="p-5 pb-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 text-base leading-snug">
              {complaint.title}
            </h3>
            {complaint.titleHi && (
              <p className="text-xs text-gray-500 mt-0.5">{complaint.titleHi}</p>
            )}
          </div>

          {/* Status Tag */}
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border shrink-0 ${
              rawStatus === 'Resolved'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : rawStatus === 'Under Working'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {rawStatus === 'Resolved'
              ? 'Resolved'
              : rawStatus === 'Under Working'
              ? 'Under Working'
              : 'Pending Review'}
          </span>
        </div>

        {/* Meta Info: Location, Date, ID */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="truncate max-w-[200px]">{complaint.location}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            {complaint.date}
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-gray-400">
            <Hash className="w-3 h-3" />
            {String(complaint.id).substring(0, 8)}...
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getSeverityBadge(
              complaint.severity
            )}`}
          >
            Severity: {complaint.severity}
          </span>

          {complaint.reportCount > 1 && (
            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
              <Layers className="w-3 h-3 text-amber-600" />
              {complaint.reportCount} Citizens Reported
            </span>
          )}

          {complaint.isRecurrent && (
            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1">
              <RefreshCw className="w-3 h-3 text-amber-600" />
              Recurring Defect
            </span>
          )}
        </div>
      </div>

      {/* ── CARD BODY: PROGRESSIVE STATUS LAYOUTS ── */}
      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
        {/* =========================================================
            STATE 1: PENDING (Complaint Raised)
            ========================================================= */}
        {rawStatus === 'Pending' && (
          <div className="space-y-3">
            {/* Warning Banner */}
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Complaint under review by municipal team. Action will commence shortly.</span>
            </div>

            {/* Citizen image with defect bounding box overlay */}
            <div className="rounded-xl overflow-hidden bg-gray-100 border border-gray-200 relative aspect-video max-h-56">
              {hasBoundingBox ? (
                <BoundingBoxCanvas
                  imageUrl={complaint.image}
                  boundingBox={complaint.boundingBox}
                />
              ) : (
                <img
                  src={complaint.image}
                  alt={complaint.title}
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded">
                Reported Hazard
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            STATE 2: UNDER WORKING
            ========================================================= */}
        {rawStatus === 'Under Working' && (
          <div className="space-y-4">
            {/* Horizontal Timeline Progress Indicator */}
            <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-100">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 mb-2">
                Field Action Timeline
              </p>
              <div className="flex items-center justify-between text-[11px] font-semibold text-gray-700 relative">
                <div className="flex flex-col items-center gap-1 z-10">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] text-emerald-700">Reported</span>
                </div>
                <div className="flex-1 h-0.5 bg-emerald-400 mx-1 mb-4" />

                <div className="flex flex-col items-center gap-1 z-10">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] text-emerald-700">Team Assigned</span>
                </div>
                <div className="flex-1 h-0.5 bg-blue-400 mx-1 mb-4 animate-pulse" />

                <div className="flex flex-col items-center gap-1 z-10">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-sm ring-4 ring-blue-100 animate-pulse">
                    <Wrench className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] text-blue-700 font-bold">In Progress ⏳</span>
                </div>
                <div className="flex-1 h-0.5 bg-gray-200 mx-1 mb-4" />

                <div className="flex flex-col items-center gap-1 z-10">
                  <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-400 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] text-gray-400">Resolution</span>
                </div>
              </div>
            </div>

            {/* Official Remark if present */}
            {workInProgress.officialRemark && (
              <div className="p-3 bg-blue-50/50 border-l-4 border-blue-600 rounded-r-xl text-xs text-gray-700">
                <span className="font-bold text-blue-900 block mb-0.5">Official Remark:</span>
                {workInProgress.officialRemark}
              </div>
            )}

            {/* Photos: Reported + On-site inspection photo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl overflow-hidden bg-gray-100 border border-gray-200 relative aspect-video">
                <img
                  src={complaint.image}
                  alt="Original Citizen Report"
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded">
                  Citizen Report Photo
                </span>
              </div>

              {workInProgress.imageUrl ? (
                <div className="rounded-xl overflow-hidden bg-gray-100 border border-blue-200 relative aspect-video">
                  <img
                    src={workInProgress.imageUrl}
                    alt="On-Site Inspection Proof"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-2 left-2 bg-blue-700/90 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                    <Wrench className="w-3 h-3" /> On-site Inspection
                  </span>
                </div>
              ) : (
                <div className="rounded-xl bg-gray-50 border border-dashed border-gray-300 flex flex-col items-center justify-center p-4 text-center aspect-video">
                  <Wrench className="w-6 h-6 text-gray-400 mb-1" />
                  <p className="text-xs font-semibold text-gray-600">PWD Crew Dispatched</p>
                  <p className="text-[10px] text-gray-400">On-site photo will appear once logged.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================
            STATE 3: RESOLVED (Before vs After Proof)
            ========================================================= */}
        {rawStatus === 'Resolved' && (
          <div className="space-y-3.5">
            {/* Resolution Header Callout */}
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-bold text-emerald-900">
                  Issue Verified &amp; Resolved by Municipal Team
                </p>
                <p className="text-emerald-700 mt-0.5">
                  {resolutionProof.officialRemark ||
                    'Hazard has been fully repaired and verified on-site by municipal inspectors.'}
                </p>
              </div>
            </div>

            {/* Toggle Button: View Before vs After Proof */}
            <button
              onClick={() => setShowProofComparison(!showProofComparison)}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:from-emerald-700 hover:to-teal-700 transition-all"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {showProofComparison ? 'Hide Side-by-Side Comparison' : 'View Before vs. After Proof 📸'}
            </button>

            {/* Side-by-side Proof Comparison View */}
            {showProofComparison ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Before: Reported Defect */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-gray-600">
                    <span className="text-red-600 font-extrabold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />
                      BEFORE (Reported)
                    </span>
                    <span className="text-gray-400 font-normal">{complaint.date}</span>
                  </div>
                  <div className="rounded-xl overflow-hidden bg-gray-100 border border-red-200 relative aspect-video">
                    {hasBoundingBox ? (
                      <BoundingBoxCanvas
                        imageUrl={complaint.image}
                        boundingBox={complaint.boundingBox}
                      />
                    ) : (
                      <img
                        src={complaint.image}
                        alt="Defect Before Fix"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                </div>

                {/* After: Fixed & Resolved */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-gray-600">
                    <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                      AFTER (Fixed)
                    </span>
                    <span className="text-emerald-700 font-semibold">Verified Safe</span>
                  </div>
                  <div className="rounded-xl overflow-hidden bg-gray-100 border border-emerald-300 relative aspect-video">
                    {resolutionProof.imageUrl ? (
                      <img
                        src={resolutionProof.imageUrl}
                        alt="Resolution Proof"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-emerald-50/50">
                        <CheckCircle2 className="w-7 h-7 text-emerald-600 mb-1" />
                        <p className="text-xs font-semibold text-emerald-800">Fixed &amp; Verified</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Compact Resolved Preview */
              <div className="rounded-xl overflow-hidden bg-gray-100 border border-gray-200 relative aspect-video max-h-48">
                <img
                  src={resolutionProof.imageUrl || complaint.image}
                  alt={complaint.title}
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-2 left-2 bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Fix Completed
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── CARD FOOTER ACTIONS ── */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-500 line-clamp-1 italic">
            "{complaint.description}"
          </p>
          <button
            onClick={() => onViewDetails(complaint)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 active:bg-blue-200 border border-blue-200 transition-colors shrink-0 ml-2"
          >
            <Eye className="w-3.5 h-3.5" />
            Full Details
            <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComplaintCard;
