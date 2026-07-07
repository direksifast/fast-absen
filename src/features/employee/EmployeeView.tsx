import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { LogOut, Clock, CheckCircle2, AlertCircle, FileText, QrCode, CalendarDays, Download, Printer, MapPin, Shield, KeyRound, ChevronRight } from "lucide-react";
import { Employee, AttendanceRecord, LeaveRequest, LeaveType, AttendanceStatus } from "../../types";
import { StatusBadge, LEAVE_CONFIG, LEAVE_STATUS_CONFIG } from "../../components/StatusBadge";
import { BarcodeScanner } from "../../components/BarcodeScanner";
import { api } from "../../services/api";
import { getTodayStr, formatDate, formatDateTime } from "../../utils";

function LeaveForm({ employee, onSubmit }: { employee: Employee; onSubmit: (req: Omit<LeaveRequest, "id" | "status" | "submittedAt">) => void }) {
  const [type, setType] = useState<LeaveType>("izin");
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    onSubmit({ employeeId: employee.id, type, startDate, endDate, reason });
    setSubmitted(true);
    setReason("");
    setTimeout(() => setSubmitted(false), 3000);
  };

  const typeOptions: { value: LeaveType; label: string; desc: string; icon: string }[] = [
    { value: "izin",  label: "Izin",  desc: "Keperluan mendadak", icon: "🏠" },
    { value: "sakit", label: "Sakit", desc: "Tidak sehat / sakit", icon: "🏥" },
    { value: "cuti",  label: "Cuti",  desc: "Cuti tahunan",       icon: "✈️" },
  ];

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-3">
        <FileText className="w-5 h-5 text-primary" />
        <span className="font-semibold text-foreground">Pengajuan Izin / Cuti</span>
      </div>
      <div className="p-6">
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="font-bold text-foreground">Pengajuan Terkirim!</h3>
            <p className="text-sm text-muted-foreground">Menunggu persetujuan dari atasan.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">Jenis Pengajuan</label>
              <div className="grid grid-cols-3 gap-2">
                {typeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all ${
                      type === opt.value
                        ? "border-primary bg-secondary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span className="text-2xl">{opt.icon}</span>
                    <span className="text-xs font-bold text-foreground">{opt.label}</span>
                    <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Tanggal Mulai</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-input-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Tanggal Selesai</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-input-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Keterangan</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Jelaskan alasan pengajuan izin…"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-input-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <button
              type="submit"
              disabled={!reason.trim()}
              className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              Kirim Pengajuan
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function BarcodeDisplay({ employee }: { employee: Employee }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      QRCode.toCanvas(canvasRef.current, employee.id, {
        width: 200,
        margin: 2,
        color: {
          dark: "#0f172a",
          light: "#ffffff"
        }
      });
    } catch {}
  }, [employee.id]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `barcode-${employee.id}-${employee.name.replace(/\s/g, "_")}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  const handlePrint = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Barcode ${employee.id}</title>
      <style>
        body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; }
        .card { border: 2px solid #1B3E7A; border-radius: 12px; padding: 24px 32px; text-align: center; }
        h2 { margin: 0 0 4px; font-size: 18px; color: #0D1B2A; }
        p { margin: 0 0 16px; font-size: 13px; color: #6B7A99; }
        img { max-width: 100%; }
      </style></head>
      <body><div class="card">
        <h2>${employee.name}</h2>
        <p>${employee.position} &middot; ${employee.department}</p>
        <img src="${dataUrl}" />
      </div></body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-3">
        <QrCode className="w-5 h-5 text-primary" />
        <span className="font-semibold text-foreground">Barcode Saya</span>
      </div>
      <div className="p-6 flex flex-col items-center gap-4">
        <div className="bg-card rounded-xl border-2 border-dashed border-border p-4">
          <canvas ref={canvasRef} className="max-w-full" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{employee.name}</p>
          <p className="text-xs text-muted-foreground font-mono">{employee.id}</p>
        </div>
        <div className="flex gap-2 w-full">
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Download className="w-4 h-4" /> Download
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 bg-secondary text-secondary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-secondary/80 transition-colors"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          Simpan atau cetak barcode ini. Tunjukkan ke kamera saat absen masuk dan pulang.
        </p>
      </div>
    </div>
  );
}

export function EmployeeView({
  employee,
  attendance,
  leaveRequests,
  employees,
  onScanSuccess,
  onLeaveSubmit,
  onLogout,
  onUpdateEmployee,
}: {
  employee: Employee;
  attendance: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  employees: Employee[];
  onScanSuccess: (empId: string, action?: "absen" | "lemburIn" | "lemburOut" | "pulang_cepat", photoData?: string, location?: any, reason?: string) => void;
  onLeaveSubmit: (req: Omit<LeaveRequest, "id" | "status" | "submittedAt">) => void;
  onLogout: () => void;
  onUpdateEmployee: (emp: Employee) => Promise<void>;
}) {
  const [tab, setTab] = useState<"scan" | "lembur" | "barcode" | "izin" | "riwayat" | "akun">("scan");
  const [currentTime, setCurrentTime] = useState(new Date());

  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");

  const [showPulangCepat, setShowPulangCepat] = useState(false);
  const [pulangCepatReason, setPulangCepatReason] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const isSaturday = currentTime.getDay() === 6;
  const currentMinsTotal = currentTime.getHours() * 60 + currentTime.getMinutes();
  const startCheckOutMins = isSaturday ? 12 * 60 : 17 * 60; // 12:00 on Saturday, else 17:00
  const endCheckOutMins = isSaturday ? 12 * 60 + 30 : 17 * 60 + 30; // 12:30 on Saturday, else 17:30

  const todayRecord = attendance.find((r) => r.date === getTodayStr() && r.employeeId === employee.id);
  const myLeave = leaveRequests.filter((r) => r.employeeId === employee.id);

  const scanLabel = !todayRecord
    ? "Belum Absen"
    : todayRecord.checkOut
    ? "Sudah Pulang"
    : "Sudah Check-in";

  const scanLabelColor = !todayRecord
    ? "text-muted-foreground"
    : todayRecord.checkOut
    ? "text-emerald-600"
    : "text-blue-600";

  const isPastCheckOutLimit = todayRecord && !todayRecord.checkOut && !!todayRecord.checkIn && currentMinsTotal > endCheckOutMins;

  useEffect(() => {
    if (isPastCheckOutLimit && todayRecord && todayRecord.status !== "absen") {
      const updatedRecord = { ...todayRecord, status: "absen" as AttendanceStatus };
      api.saveAttendanceRecord(updatedRecord).catch(console.error);
    }
  }, [isPastCheckOutLimit, todayRecord]);

  // Tombol scan nyala terus dari pagi sampai 17:30. Mati SETELAH 17:30.
  const canScan = !todayRecord || (!todayRecord.checkOut && !!todayRecord.checkIn && currentMinsTotal <= endCheckOutMins);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
            {employee.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{employee.name}</p>
            <p className="text-xs text-primary-foreground/70">{employee.position} · {employee.department}</p>
          </div>
          <div className="text-right mr-2">
            <p className="text-xs text-primary-foreground/70">Status</p>
            <p className={`text-xs font-semibold ${scanLabelColor.replace("text-","text-white/")}`}>{scanLabel}</p>
          </div>
          <button onClick={onLogout} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Today Status Bar */}
        {todayRecord && (
          <div className="border-t border-white/10 bg-white/5">
            <div className="max-w-2xl mx-auto px-4 py-2 flex gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-white/60" />
                <span className="text-white/60">Masuk:</span>
                <span className="font-mono font-semibold">{todayRecord.checkIn || "–"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-white/60" />
                <span className="text-white/60">Pulang:</span>
                <span className="font-mono font-semibold">{todayRecord.checkOut || "–"}</span>
              </div>
              {todayRecord.lemburIn && (
                <div className="flex items-center gap-1.5 text-orange-300">
                  <Clock className="w-3.5 h-3.5 opacity-60" />
                  <span className="opacity-80">Lembur:</span>
                  <span className="font-mono font-semibold">{todayRecord.lemburIn} - {todayRecord.lemburOut || "–"}</span>
                </div>
              )}
              <div className="ml-auto">
                <StatusBadge status={todayRecord.status} />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Tabs */}
      <div className="max-w-2xl mx-auto w-full px-4 pt-4">
        <div className="flex gap-1 bg-muted rounded-xl p-1 overflow-x-auto">
          {(["scan","lembur","barcode","izin","riwayat","akun"] as const).map((t) => {
            const labels = { scan: "Absen", lembur: "Lembur", barcode: "Barcode", izin: "Pengajuan", riwayat: "Riwayat", akun: "Akun" };
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 space-y-4 pb-8">
        {tab === "scan" && (
          <>
            {/* Time info */}
            <div className="bg-card rounded-2xl border border-border shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Hari ini</p>
                  <p className="font-semibold text-foreground text-sm">{formatDate(getTodayStr())}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Ketentuan</p>
                  <p className="text-xs font-mono font-semibold text-foreground">Masuk 09:00 · Telat ≥09:15</p>
                </div>
              </div>
            </div>

            <BarcodeScanner onScan={(id, photo, loc) => onScanSuccess(id, "absen", photo, loc)} disabled={!canScan} employees={employees} targetEmployeeId={employee.id} />

            {isPastCheckOutLimit && (
              <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-xl p-4 text-sm font-semibold">
                <AlertCircle className="w-5 h-5 shrink-0" />
                Batas waktu absen pulang ({isSaturday ? "12:30" : "17:30"}) telah terlewat. Kehadiran Anda hari ini dianggap Tidak Hadir (Absen).
              </div>
            )}

            {!canScan && todayRecord?.checkOut && (
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 rounded-xl p-4 text-sm font-semibold">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                Kamu sudah absen pulang hari ini. Sampai besok!
              </div>
            )}

            {!todayRecord?.checkOut && (
              <div className="mt-6 border-t border-border pt-4">
                <button
                  onClick={() => setShowPulangCepat(!showPulangCepat)}
                  className="text-sm font-semibold text-amber-600 hover:text-amber-700 underline underline-offset-4"
                >
                  Ada keperluan mendadak (Pulang Cepat)?
                </button>
                
                {showPulangCepat && (
                  <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <p className="text-sm text-amber-800 font-semibold mb-3">Formulir Pulang Cepat</p>
                    <textarea 
                      placeholder="Tuliskan alasan pulang cepat..."
                      value={pulangCepatReason}
                      onChange={e => setPulangCepatReason(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white text-slate-900 placeholder:text-slate-400 border border-amber-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      rows={2}
                    />
                    {pulangCepatReason.trim().length > 0 ? (
                      <div className="bg-white rounded-lg p-2 border border-amber-200">
                        <p className="text-xs text-center text-muted-foreground mb-2">Scan wajah untuk konfirmasi pulang cepat</p>
                        <BarcodeScanner 
                          onScan={(id, photo, loc) => onScanSuccess(id, "pulang_cepat", photo, loc, pulangCepatReason)} 
                          disabled={false} 
                          employees={employees} 
                          targetEmployeeId={employee.id} 
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700 italic">Isi alasan terlebih dahulu untuk memunculkan scanner.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {tab === "lembur" && (
          <>
            <div className="bg-card rounded-2xl border border-border shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Lembur Hari Ini</p>
                  <p className="font-semibold text-foreground text-sm">{formatDate(getTodayStr())}</p>
                </div>
              </div>
            </div>

            {!todayRecord?.checkOut ? (
              <div className="flex items-center gap-2 bg-amber-50 text-amber-700 rounded-xl p-4 text-sm font-semibold">
                <AlertCircle className="w-5 h-5 shrink-0" />
                Lembur hanya dapat dilakukan setelah Anda melakukan absen pulang (Check Out).
              </div>
            ) : todayRecord?.lemburOut ? (
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 rounded-xl p-4 text-sm font-semibold">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                Lembur hari ini sudah selesai.
              </div>
            ) : todayRecord?.lemburIn ? (
              <BarcodeScanner 
                onScan={(id, photo, loc) => onScanSuccess(id, "lemburOut", photo, loc)} 
                employees={employees} 
                targetEmployeeId={employee.id} 
                forceMode="face"
                title="Selesai Lembur"
              />
            ) : (
              <BarcodeScanner 
                onScan={(id, photo, loc) => onScanSuccess(id, "lemburIn", photo, loc)} 
                employees={employees} 
                targetEmployeeId={employee.id} 
                forceMode="face"
                title="Ambil Lembur"
              />
            )}
          </>
        )}

        {tab === "barcode" && <BarcodeDisplay employee={employee} />}

        {tab === "izin" && (
          <>
            <LeaveForm employee={employee} onSubmit={onLeaveSubmit} />

            {myLeave.length > 0 && (
              <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <span className="font-semibold text-foreground text-sm">Riwayat Pengajuan</span>
                </div>
                <div className="divide-y divide-border">
                  {myLeave.slice(0,5).map((lr) => {
                    const lsc = LEAVE_STATUS_CONFIG[lr.status];
                    const ltc = LEAVE_CONFIG[lr.type];
                    return (
                      <div key={lr.id} className="px-6 py-3 flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ltc.color}`}>{ltc.label}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground font-medium truncate">{lr.reason}</p>
                          <p className="text-xs text-muted-foreground">{lr.startDate} s/d {lr.endDate}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${lsc.color}`}>
                          {lsc.icon}{lsc.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {tab === "riwayat" && (
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center gap-3">
              <CalendarDays className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">Riwayat Absensi</span>
            </div>
            {attendance.filter((r) => r.employeeId === employee.id).length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Belum ada data absensi</p>
            ) : (
              <div className="divide-y divide-border">
                {attendance
                  .filter((r) => r.employeeId === employee.id)
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 20)
                  .map((rec) => (
                    <div key={rec.id} className="px-6 py-3 flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{formatDate(rec.date)}</p>
                        <div className="text-xs text-muted-foreground font-mono mt-2 space-y-2">
                          {rec.checkIn && (
                            <div className="flex flex-col items-start gap-1">
                              <span className="font-semibold text-foreground">Masuk {rec.checkIn}</span>
                              {rec.locationCheckIn && (
                                <a
                                  href={`https://maps.google.com/?q=${rec.locationCheckIn.lat},${rec.locationCheckIn.lng}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-start gap-1.5 text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded-md hover:bg-blue-100 transition-colors w-full sm:w-auto"
                                >
                                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                  <span className="whitespace-normal leading-relaxed text-left">{rec.locationCheckIn.address || "Lihat di Peta"}</span>
                                </a>
                              )}
                            </div>
                          )}
                          {rec.checkOut && (
                            <div className="flex flex-col items-start gap-1 mt-2">
                              <span className="font-semibold text-foreground">Pulang {rec.checkOut}</span>
                              {rec.locationCheckOut && (
                                <a
                                  href={`https://maps.google.com/?q=${rec.locationCheckOut.lat},${rec.locationCheckOut.lng}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-start gap-1.5 text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md hover:bg-emerald-100 transition-colors w-full sm:w-auto"
                                >
                                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                  <span className="whitespace-normal leading-relaxed text-left">{rec.locationCheckOut.address || "Lihat di Peta"}</span>
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={rec.status} />
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {tab === "akun" && (
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center gap-3">
              <Shield className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">Pengaturan Keamanan</span>
            </div>
            <div className="p-6">
              {!employee.pin ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="font-semibold text-amber-800 text-sm">PIN Belum Dibuat</p>
                      <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                        Anda belum memiliki PIN. Silakan buat PIN 6 digit untuk mengamankan akun Anda. 
                        Setelah dibuat, Anda wajib memasukkan PIN tersebut setiap kali masuk.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  setPinError("");
                  if (employee.pin && oldPin !== employee.pin) {
                    setPinError("PIN Lama yang Anda masukkan salah.");
                    return;
                  }
                  if (newPin.length !== 6 || confirmPin.length !== 6) {
                    setPinError("PIN harus terdiri dari 6 digit.");
                    return;
                  }
                  if (newPin !== confirmPin) {
                    setPinError("PIN Baru dan Konfirmasi PIN tidak cocok.");
                    return;
                  }

                  try {
                    await onUpdateEmployee({ ...employee, pin: newPin });
                    setOldPin("");
                    setNewPin("");
                    setConfirmPin("");
                  } catch (err: any) {
                    setPinError("Gagal menyimpan ke database! Error: " + (err?.message || err?.toString() || "Unknown error"));
                  }
                }}
                className="space-y-4"
              >
                {employee.pin && (
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">PIN Lama</label>
                    <input
                      type="password"
                      maxLength={6}
                      inputMode="numeric"
                      value={oldPin}
                      onChange={(e) => setOldPin(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-input-background text-sm font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-ring/30"
                      placeholder="••••••"
                      required
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">{employee.pin ? "PIN Baru (6 Digit)" : "Buat PIN Baru (6 Digit)"}</label>
                  <input
                    type="password"
                    maxLength={6}
                    inputMode="numeric"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-input-background text-sm font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-ring/30"
                    placeholder="••••••"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Konfirmasi PIN Baru</label>
                  <input
                    type="password"
                    maxLength={6}
                    inputMode="numeric"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-input-background text-sm font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-ring/30"
                    placeholder="••••••"
                    required
                  />
                </div>

                {pinError && (
                  <p className="text-red-500 text-xs font-semibold">{pinError}</p>
                )}

                <button
                  type="submit"
                  disabled={!newPin || !confirmPin || (!!employee.pin && !oldPin)}
                  className="w-full mt-4 bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-4 h-4" />
                  {employee.pin ? "Ubah PIN" : "Simpan PIN Baru"}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
