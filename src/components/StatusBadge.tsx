import { Clock, Check, X } from "lucide-react";
import { AttendanceStatus, LeaveType, LeaveStatus } from "../types";

export const STATUS_CONFIG: Record<AttendanceStatus, { label: string; bg: string; text: string; dot: string }> = {
  hadir:     { label: "Hadir",     bg: "bg-emerald-50",  text: "text-emerald-700", dot: "bg-emerald-500" },
  terlambat: { label: "Terlambat", bg: "bg-amber-50",    text: "text-amber-700",   dot: "bg-amber-500"   },
  absen:     { label: "Absen",     bg: "bg-red-50",      text: "text-red-700",     dot: "bg-red-500"     },
  izin:      { label: "Izin",      bg: "bg-blue-50",     text: "text-blue-700",    dot: "bg-blue-500"    },
};

export function StatusBadge({ status }: { status: AttendanceStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export const LEAVE_CONFIG: Record<LeaveType, { label: string; color: string }> = {
  izin:  { label: "Izin",  color: "bg-purple-100 text-purple-700" },
  sakit: { label: "Sakit", color: "bg-rose-100 text-rose-700"     },
  cuti:  { label: "Cuti",  color: "bg-sky-100 text-sky-700"       },
};

export const LEAVE_STATUS_CONFIG: Record<LeaveStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending:  { label: "Menunggu", color: "bg-amber-100 text-amber-700",   icon: <Clock className="w-3 h-3" /> },
  approved: { label: "Disetujui",color: "bg-emerald-100 text-emerald-700", icon: <Check className="w-3 h-3" /> },
  rejected: { label: "Ditolak", color: "bg-red-100 text-red-700",        icon: <X className="w-3 h-3" /> },
};
