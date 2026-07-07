import { useState, useEffect, useCallback } from "react";
import { ClipboardList, UserCheck, Shield, ChevronRight, Maximize, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { Employee, AppView, AttendanceRecord, LeaveRequest, LocationData } from "../types";
import { api } from "../services/api";
import { supabase } from "../services/supabase";
import { getTodayStr, getNowTime, getCheckInStatus, timeToMinutes, minutesToTime, fetchAddressFromCoordinates } from "../utils";
import { EmployeeView } from "../features/employee/EmployeeView";
import { AdminView } from "../features/admin/AdminView";
import { AdminLogin } from "../features/auth/AdminLogin";

// ─── Scan Toast ────────────────────────────────────────────────────────────────

function ScanToast({ message, type, onDone }: { message: string; type: "success" | "warning" | "error"; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);

  const colors = {
    success: "bg-emerald-600 text-white",
    warning: "bg-amber-500 text-white",
    error:   "bg-red-600 text-white",
  };
  const icons = {
    success: <CheckCircle2 className="w-5 h-5 shrink-0" />,
    warning: <AlertCircle className="w-5 h-5 shrink-0" />,
    error:   <XCircle className="w-5 h-5 shrink-0" />,
  };

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-semibold ${colors[type]}`}
      style={{ animation: "slideDown 0.3s ease" }}>
      <style>{`@keyframes slideDown { from { transform: translate(-50%, -20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }`}</style>
      {icons[type]}
      <span>{message}</span>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  
  const [view, setView] = useState<AppView | "admin_login">(() => {
    return (localStorage.getItem("fast-absen-view") as AppView | "admin_login") || "login";
  });
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(() => {
    const saved = localStorage.getItem("fast-absen-emp");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return null; }
    }
    return null;
  });

  useEffect(() => {
    localStorage.setItem("fast-absen-view", view);
  }, [view]);

  useEffect(() => {
    if (currentEmployee) {
      localStorage.setItem("fast-absen-emp", JSON.stringify(currentEmployee));
    } else {
      localStorage.removeItem("fast-absen-emp");
    }
  }, [currentEmployee]);
  
  const [toast, setToast] = useState<{ msg: string; type: "success" | "warning" | "error" } | null>(null);
  const [loading, setLoading] = useState(true);

  // Load data on mount and subscribe to changes
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const emps = await api.getEmployees();
      const atts = await api.getAttendance();
      const leaves = await api.getLeaveRequests();
      setEmployees(emps);
      setCurrentEmployee((prev) => {
        if (!prev) return null;
        return emps.find((e) => e.id === prev.id) || null;
      });
      setAttendance(atts);
      setLeaveRequests(leaves);
      setLoading(false);
    }
    loadData();

    const channel = supabase.channel('app-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
        api.getAttendance().then(setAttendance);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
        api.getLeaveRequests().then(setLeaveRequests);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // API Sync happens locally per action now
  const handleScan = useCallback(async (empId: string, action?: "absen" | "lemburIn" | "lemburOut", photoData?: string, location?: LocationData) => {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) {
      setToast({ msg: "Barcode tidak dikenali", type: "error" });
      return;
    }

    if (location && !location.address) {
      const address = await fetchAddressFromCoordinates(location.lat, location.lng);
      if (address) location.address = address;
    }

    const today = getTodayStr();
    const now = getNowTime();
    const existingIdx = attendance.findIndex((r) => r.date === today && r.employeeId === empId);

    // Proses upload foto dummy (base64 => URL)
    let finalPhotoUrl = photoData;
    if (photoData) {
      finalPhotoUrl = await api.uploadPhoto(photoData, `attendance/${today}/${empId}-${Date.now()}.jpg`);
    }

    if (action === "lemburIn") {
      if (existingIdx === -1) return;
      const rec = attendance[existingIdx];
      const updated = { ...rec, lemburIn: now, photoLemburIn: finalPhotoUrl, locationLemburIn: location };
      try {
        await api.saveAttendanceRecord(updated);
        setAttendance((prev) => prev.map((r, i) => i === existingIdx ? updated : r));
        setToast({ msg: `${emp.name} — Lembur dimulai pukul ${now} ✓`, type: "success" });
      } catch (e) {
        setToast({ msg: "Gagal memproses lembur. Periksa koneksi internet.", type: "error" });
      }
      return;
    }

    if (action === "lemburOut") {
      if (existingIdx === -1) return;
      const rec = attendance[existingIdx];
      const updated = { ...rec, lemburOut: now, photoLemburOut: finalPhotoUrl, locationLemburOut: location };
      try {
        await api.saveAttendanceRecord(updated);
        setAttendance((prev) => prev.map((r, i) => i === existingIdx ? updated : r));
        setToast({ msg: `${emp.name} — Lembur selesai pukul ${now} 👋`, type: "success" });
      } catch (e) {
        setToast({ msg: "Gagal menyimpan data lembur. Periksa koneksi internet.", type: "error" });
      }
      return;
    }

    if (existingIdx === -1) {
      // Check-in
      const status = getCheckInStatus(now);
      const newRecord: AttendanceRecord = {
        id: `${today}-${empId}`,
        employeeId: empId,
        date: today,
        checkIn: now,
        photoCheckIn: finalPhotoUrl,
        locationCheckIn: location,
        status,
      };
      try {
        await api.saveAttendanceRecord(newRecord);
        setAttendance((prev) => [...prev, newRecord]);
        if (status === "hadir") {
          setToast({ msg: `${emp.name} — Check-in tepat waktu pukul ${now} ✓`, type: "success" });
        } else {
          setToast({ msg: `${emp.name} — Terlambat! Check-in pukul ${now}`, type: "warning" });
        }
      } catch (e) {
        setToast({ msg: "Gagal check-in. Periksa koneksi internet Anda.", type: "error" });
      }
    } else {
      const rec = attendance[existingIdx];
      if (rec.checkOut) {
        setToast({ msg: "Sudah absen pulang hari ini. Silakan absen masuk besok.", type: "warning" });
        return;
      }
      
      const checkInMins = timeToMinutes(rec.checkIn || "09:00");
      const currentMins = timeToMinutes(now);
      const requiredCheckOutMins = Math.max(17 * 60, checkInMins + 8 * 60);
      
      if (currentMins < requiredCheckOutMins) {
        setToast({ msg: `Belum waktunya pulang! Jam kerja Anda selesai pukul ${minutesToTime(requiredCheckOutMins)}`, type: "error" });
        return;
      }

      const updated = { ...rec, checkOut: now, photoCheckOut: finalPhotoUrl, locationCheckOut: location };
      try {
        await api.saveAttendanceRecord(updated);
        setAttendance((prev) => prev.map((r, i) => i === existingIdx ? updated : r));
        setToast({ msg: `${emp.name} — Pulang pukul ${now} 👋`, type: "success" });
      } catch (e) {
        setToast({ msg: "Gagal check-out. Periksa koneksi internet Anda.", type: "error" });
      }
    }
  }, [attendance, employees]);

  const handleLeaveSubmit = async (req: Omit<LeaveRequest, "id" | "status" | "submittedAt">) => {
    const newReq: LeaveRequest = {
      ...req,
      id: `LR${Date.now()}`,
      status: "pending",
      submittedAt: new Date().toISOString(),
    };
    try {
      await api.saveLeaveRequest(newReq);
      setLeaveRequests((prev) => [...prev, newReq]);
      setToast({ msg: "Pengajuan izin berhasil dikirim", type: "success" });
    } catch (e) {
      setToast({ msg: "Gagal mengirim pengajuan izin", type: "error" });
    }
  };

  const handleApprove = async (id: string) => {
    const req = leaveRequests.find(r => r.id === id);
    if (req) {
      const updated = { ...req, status: "approved" as const };
      try {
        await api.saveLeaveRequest(updated);
        setLeaveRequests((prev) => prev.map((r) => r.id === id ? updated : r));
      } catch (e) {
        setToast({ msg: "Gagal menyetujui izin", type: "error" });
      }
    }
  };

  const handleReject = async (id: string) => {
    const req = leaveRequests.find(r => r.id === id);
    if (req) {
      const updated = { ...req, status: "rejected" as const };
      try {
        await api.saveLeaveRequest(updated);
        setLeaveRequests((prev) => prev.map((r) => r.id === id ? updated : r));
      } catch (e) {
        setToast({ msg: "Gagal menolak izin", type: "error" });
      }
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {toast && (
        <ScanToast
          message={toast.msg}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}

      {view === "login" && (
        <LoginSelectionView
          employees={employees}
          onEmployeeLogin={(id) => {
            setCurrentEmployee(employees.find((e) => e.id === id)!);
            setView("employee");
          }}
          onAdminLogin={() => setView("admin_login")}
        />
      )}

      {view === "admin_login" && (
        <AdminLogin onLogin={() => setView("admin")} onBack={() => setView("login")} />
      )}

      {view === "employee" && currentEmployee && (
        <EmployeeView
          employee={currentEmployee}
          attendance={attendance}
          leaveRequests={leaveRequests}
          employees={employees}
          onScanSuccess={handleScan}
          onLeaveSubmit={handleLeaveSubmit}
          onLogout={() => { setCurrentEmployee(null); setView("login"); }}
          onUpdateEmployee={async (emp) => {
            await api.saveEmployee(emp);
            setEmployees(prev => prev.map(e => e.id === emp.id ? emp : e));
            setCurrentEmployee(emp);
            setToast({ msg: "PIN berhasil diperbarui!", type: "success" });
          }}
        />
      )}

      {view === "admin" && (
        <AdminView
          attendance={attendance}
          leaveRequests={leaveRequests}
          employees={employees}
          onApprove={handleApprove}
          onReject={handleReject}
          onLogout={() => setView("login")}
          onAddEmployee={async (emp) => {
            await api.saveEmployee(emp);
            setEmployees((prev) => [...prev, emp]);
          }}
          onEditEmployee={async (emp) => {
            try {
              await api.saveEmployee(emp);
              setEmployees((prev) => prev.map(e => e.id === emp.id ? emp : e));
              setToast({ msg: "Data karyawan berhasil diperbarui", type: "success" });
            } catch (e) {
              setToast({ msg: "Gagal memperbarui data karyawan", type: "error" });
            }
          }}
          onDeleteEmployee={async (id) => {
            await api.deleteEmployee(id);
            setEmployees((prev) => prev.filter(emp => emp.id !== id));
            setToast({ msg: "Karyawan berhasil dihapus", type: "success" });
          }}
        />
      )}
    </div>
  );
}

// ─── Login Selection View (Di dalam App.tsx untuk saat ini) ──────────

function LoginSelectionView({ onEmployeeLogin, onAdminLogin, employees }: { onEmployeeLogin: (id: string) => void; onAdminLogin: () => void; employees: Employee[] }) {
  const [mode, setMode] = useState<"select" | "employee" | "pin">("select");
  const [selectedEmp, setSelectedEmp] = useState<string>("");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <button
        onClick={() => {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
        }}
        className="absolute top-4 right-4 p-2 bg-card border border-border rounded-xl shadow-sm text-muted-foreground hover:text-primary hover:border-primary/30 transition-all"
        title="Toggle Fullscreen"
      >
        <Maximize className="w-5 h-5" />
      </button>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/25">
            <ClipboardList className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">FAST ABSEN</h1>
          <p className="text-sm text-muted-foreground mt-1">Sistem Absensi Karyawan</p>
        </div>

        {mode === "select" && (
          <div className="space-y-3">
            <button
              onClick={() => setMode("employee")}
              className="w-full bg-card border border-border rounded-2xl p-5 flex items-center gap-4 hover:border-primary/40 hover:shadow-sm transition-all group"
            >
              <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <UserCheck className="w-6 h-6 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-bold text-foreground">Masuk sebagai Karyawan</p>
                <p className="text-xs text-muted-foreground">Absen masuk & pulang, ajukan izin</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
            </button>

            <button
              onClick={onAdminLogin}
              className="w-full bg-card border border-border rounded-2xl p-5 flex items-center gap-4 hover:border-primary/40 hover:shadow-sm transition-all group"
            >
              <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-bold text-foreground">Masuk sebagai Admin / Bos</p>
                <p className="text-xs text-muted-foreground">Pantau absensi & kelola pengajuan</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
            </button>
          </div>
        )}

        {mode === "employee" && (
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center gap-3">
              <button onClick={() => { setMode("select"); setSelectedEmp(""); }} className="p-1 rounded-lg hover:bg-muted transition-colors">
                <ChevronRight className="w-4 h-4 rotate-180 text-muted-foreground" />
              </button>
              <span className="font-semibold text-foreground">Pilih Karyawan</span>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {employees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => setSelectedEmp(emp.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                    selectedEmp === emp.id ? "border-primary bg-secondary" : "border-transparent hover:bg-muted"
                  }`}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: emp.color }}>
                    {emp.initials}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-sm text-foreground">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">{emp.position}</p>
                  </div>
                  <span className="ml-auto text-xs font-mono text-muted-foreground">{emp.id}</span>
                </button>
              ))}
            </div>
            <div className="px-4 pb-4">
              <button
                disabled={!selectedEmp}
                onClick={() => {
                  const emp = employees.find(e => e.id === selectedEmp);
                  if (emp && emp.pin) {
                    setMode("pin");
                    setPinInput("");
                    setPinError("");
                  } else {
                    onEmployeeLogin(selectedEmp);
                  }
                }}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Masuk
              </button>
            </div>
          </div>
        )}

        {mode === "pin" && (
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center gap-3">
              <button onClick={() => { setMode("employee"); setPinInput(""); setPinError(""); }} className="p-1 rounded-lg hover:bg-muted transition-colors">
                <ChevronRight className="w-4 h-4 rotate-180 text-muted-foreground" />
              </button>
              <span className="font-semibold text-foreground">Masukkan PIN 6 Digit</span>
            </div>
            <div className="p-6">
              <p className="text-sm text-center text-muted-foreground mb-6">
                Masukkan PIN Anda untuk masuk sebagai <strong className="text-foreground">{employees.find(e => e.id === selectedEmp)?.name}</strong>
              </p>
              
              <div className="flex justify-center gap-2 mb-4">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <div 
                    key={index}
                    className={`w-10 h-12 rounded-lg border-2 flex items-center justify-center text-xl font-bold
                      ${pinInput.length > index ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/50"}
                    `}
                  >
                    {pinInput.length > index ? "•" : ""}
                  </div>
                ))}
              </div>
              
              {pinError && <p className="text-red-500 text-xs text-center mb-4 font-semibold">{pinError}</p>}

              <div className="grid grid-cols-3 gap-2 mt-6">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    onClick={() => {
                      if (pinInput.length < 6) setPinInput(prev => prev + num);
                      setPinError("");
                    }}
                    className="p-4 rounded-xl bg-muted/50 hover:bg-muted font-bold text-lg transition-colors"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={() => setPinInput("")}
                  className="p-4 rounded-xl text-red-500 hover:bg-red-50 font-bold text-sm transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={() => {
                    if (pinInput.length < 6) setPinInput(prev => prev + "0");
                    setPinError("");
                  }}
                  className="p-4 rounded-xl bg-muted/50 hover:bg-muted font-bold text-lg transition-colors"
                >
                  0
                </button>
                <button
                  onClick={() => {
                    if (pinInput.length > 0) setPinInput(prev => prev.slice(0, -1));
                    setPinError("");
                  }}
                  className="p-4 rounded-xl text-muted-foreground hover:bg-muted font-bold transition-colors flex items-center justify-center"
                >
                  <ChevronRight className="w-6 h-6 rotate-180" />
                </button>
              </div>

              <div className="mt-6">
                <button
                  disabled={pinInput.length !== 6}
                  onClick={() => {
                    const emp = employees.find(e => e.id === selectedEmp);
                    if (emp?.pin === pinInput) {
                      onEmployeeLogin(selectedEmp);
                    } else {
                      setPinError("PIN yang Anda masukkan salah.");
                      setPinInput("");
                    }
                  }}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  Konfirmasi PIN
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          Jam Masuk 09:00 · Toleransi Terlambat 15 menit · Jam Pulang 17:00
        </p>
      </div>
    </div>
  );
}
