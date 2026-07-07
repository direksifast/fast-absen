import { useState } from "react";
import { ClipboardList, UserCheck, BarChart3, FileText, Users, LogOut, Clock, AlertCircle, Coffee, UserX, AlertTriangle, Check, X, Camera, MapPin, Download, Trash2, Edit, KeyRound } from "lucide-react";
import { AttendanceRecord, LeaveRequest, Employee, AttendanceStatus } from "../../types";
import { StatusBadge, LEAVE_CONFIG, LEAVE_STATUS_CONFIG } from "../../components/StatusBadge";
import { getTodayStr, formatDate, formatDateTime, calculateDurationMins, calculateWorkDurationMins, formatMinutesToDecimal } from "../../utils";
import * as XLSX from "xlsx";

export function AdminView({
  attendance,
  leaveRequests,
  employees,
  onApprove,
  onReject,
  onLogout,
  onAddEmployee,
  onEditEmployee,
  onDeleteEmployee,
}: {
  attendance: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  employees: Employee[];
  onApprove: (id: string, newType?: import("../../types").LeaveType) => void;
  onReject: (id: string) => void;
  onLogout: () => void;
  onAddEmployee: (emp: Employee) => void;
  onEditEmployee: (emp: Employee) => void;
  onDeleteEmployee: (id: string) => void;
}) {
  const [tab, setTab] = useState<"today" | "all" | "leave" | "employees" | "recap" | "recap_leave">("today");
  const [filterDate, setFilterDate] = useState(getTodayStr());
  const [filterStatus, setFilterStatus] = useState<AttendanceStatus | "all">("all");
  const [selectedPhoto, setSelectedPhoto] = useState<{ src: string, label: string } | null>(null);

  const [newEmpId, setNewEmpId] = useState("");
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpRole, setNewEmpRole] = useState("");

  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [editEmpName, setEditEmpName] = useState("");
  const [editEmpRole, setEditEmpRole] = useState("");
  const [editEmpDept, setEditEmpDept] = useState("");

  const [recapMonth, setRecapMonth] = useState(getTodayStr().substring(0, 7)); // YYYY-MM
  const [leaveOverrides, setLeaveOverrides] = useState<Record<string, import("../../types").LeaveType>>({});

  const todayStr = getTodayStr();
  const todayRecords = attendance.filter((r) => r.date === todayStr);

  const todayGrid = employees.map((emp) => {
    const rec = todayRecords.find((r) => r.employeeId === emp.id);
    return { emp, rec };
  });

  const getDerivedStatus = (rec?: AttendanceRecord): AttendanceStatus => {
    if (!rec) return "absen";
    if ((rec.status === "hadir" || rec.status === "terlambat") && !rec.checkOut) {
      return "belum_pulang";
    }
    return rec.status;
  };

  const stats = {
    hadir:     todayGrid.filter((x) => getDerivedStatus(x.rec) === "hadir").length,
    terlambat: todayGrid.filter((x) => getDerivedStatus(x.rec) === "terlambat").length,
    izin:      todayGrid.filter((x) => getDerivedStatus(x.rec) === "izin").length,
    absen:     todayGrid.filter((x) => getDerivedStatus(x.rec) === "absen").length,
    belum_pulang: todayGrid.filter((x) => getDerivedStatus(x.rec) === "belum_pulang").length,
    lembur:    todayGrid.filter((x) => x.rec?.lemburIn).length,
  };

  const pendingLeave = leaveRequests.filter((l) => l.status === "pending");

  const filtered = attendance
    .filter((r) => r.date === filterDate)
    .filter((r) => filterStatus === "all" || getDerivedStatus(r) === filterStatus)
    .sort((a, b) => a.employeeId.localeCompare(b.employeeId));

  const getEmp = (id: string) => employees.find((e) => e.id === id)!;

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpId || !newEmpName || !newEmpRole) return;
    const initials = newEmpName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
    const color = "#1B3E7A"; // Placeholder color
    onAddEmployee({ id: newEmpId, name: newEmpName, department: "Umum", position: newEmpRole, initials, color });
    setNewEmpId(""); setNewEmpName(""); setNewEmpRole("");
  };

  const handleEditEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp) return;
    const initials = editEmpName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
    onEditEmployee({
      ...editingEmp,
      name: editEmpName,
      department: editEmpDept,
      position: editEmpRole,
      initials
    });
    setEditingEmp(null);
  };

  // Kalkulasi Rekapitulasi per Karyawan
  const recapData = employees.map((emp) => {
    const records = attendance.filter((r) => r.employeeId === emp.id && r.date.startsWith(recapMonth));
    let totalWorkMins = 0;
    let totalOvertimeMins = 0;
    let countHadir = 0;
    let countTelat = 0;
    let countIzin = 0;
    let countAbsen = 0; // if status === absen

    records.forEach(r => {
      const s = getDerivedStatus(r);
      if (s === "hadir") countHadir++;
      if (s === "terlambat") countTelat++;
      if (s === "izin") countIzin++;
      if (s === "absen") countAbsen++;

      if (r.checkIn && r.checkOut) {
        totalWorkMins += calculateWorkDurationMins(r.checkIn, r.checkOut, r.date);
      }
      if (r.lemburIn && r.lemburOut) {
        totalOvertimeMins += calculateDurationMins(r.lemburIn, r.lemburOut);
      }
    });

    return {
      emp,
      totalWorkHours: formatMinutesToDecimal(totalWorkMins),
      totalOvertimeHours: formatMinutesToDecimal(totalOvertimeMins),
      countHadir,
      countTelat,
      countIzin,
      countAbsen,
    };
  });

  // Kalkulasi Rekapitulasi Izin/Cuti
  const recapLeaveData = employees.map((emp) => {
    const approvedLeaves = leaveRequests.filter(
      (l) => l.employeeId === emp.id && l.status === "approved"
    );
    let countIzin = 0;
    let countSakit = 0;
    let countCuti = 0;

    approvedLeaves.forEach((l) => {
      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      if (l.type === "izin") countIzin += diffDays;
      if (l.type === "sakit") countSakit += diffDays;
      if (l.type === "cuti") countCuti += diffDays;
    });

    return {
      emp,
      countIzin,
      countSakit,
      countCuti,
      total: countIzin + countSakit + countCuti,
    };
  });

  const handleDownloadExcel = () => {
    const headers = ["ID", "Nama Karyawan", "Posisi", "Hadir", "Terlambat", "Izin", "Absen", "Total Jam Kerja", "Total Jam Lembur"];
    const rows = recapData.map(r => ({
      "ID": r.emp.id,
      "Nama Karyawan": r.emp.name,
      "Posisi": r.emp.position,
      "Hadir": r.countHadir,
      "Terlambat": r.countTelat,
      "Izin": r.countIzin,
      "Absen": r.countAbsen,
      "Total Jam Kerja": Number(r.totalWorkHours),
      "Total Jam Lembur": Number(r.totalOvertimeHours)
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Absen");
    XLSX.writeFile(workbook, `Rekap_Absen_${recapMonth}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Sidebar + Main Layout */}
      <div className="flex flex-1 max-w-7xl mx-auto w-full">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-64 bg-primary min-h-screen shrink-0">
          <div className="px-6 py-6">
            <div className="flex items-center gap-3 mb-1">
              <ClipboardList className="w-6 h-6 text-white/80" />
              <span className="font-bold text-white text-lg">FAST ABSEN</span>
            </div>
            <p className="text-xs text-white/50 pl-9">Panel Admin</p>
          </div>
          <nav className="flex-1 px-3 pb-4 space-y-1">
            {([
              { key: "today", label: "Absensi Hari Ini", Icon: UserCheck },
              { key: "all",   label: "Semua Data",        Icon: BarChart3 },
              { key: "leave", label: `Pengajuan ${pendingLeave.length > 0 ? `(${pendingLeave.length})` : ""}`, Icon: FileText },
              { key: "recap", label: "Rekap Absen", Icon: Download },
              { key: "recap_leave", label: "Rekap Izin/Cuti", Icon: FileText },
              { key: "employees", label: "Karyawan", Icon: Users },
            ] as const).map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === key ? "bg-card text-primary" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </nav>
          <div className="px-3 pb-6">
            <div className="border-t border-white/10 pt-4">
              <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white transition-all">
                <LogOut className="w-4 h-4" /> Keluar
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile header */}
        <div className="md:hidden w-full">
          <header className="bg-primary text-white px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              <span className="font-bold">FAST ABSEN Admin</span>
            </div>
            <button onClick={onLogout} className="p-2 rounded-xl hover:bg-white/10"><LogOut className="w-4 h-4" /></button>
          </header>
          <div className="flex gap-1 bg-muted p-1 mx-4 mt-4 rounded-xl overflow-x-auto">
            {(["today","all","leave","recap","recap_leave"] as const).map((t) => {
              const labels = { today: "Hari Ini", all: "Semua", leave: `Pengajuan${pendingLeave.length > 0 ? ` (${pendingLeave.length})` : ""}`, recap: "Rekap", recap_leave: "Izin/Cuti" };
              return (
                <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>
                  {labels[t]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main */}
        <main className="flex-1 overflow-auto">
          <div className="p-6 max-w-5xl mx-auto space-y-6">
            {/* ── Today Tab ── */}
            {tab === "today" && (
              <>
                <div>
                  <h1 className="text-xl font-bold text-foreground">Absensi Hari Ini</h1>
                  <p className="text-sm text-muted-foreground">{formatDate(todayStr)}</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                  {[
                    { key: "hadir",     label: "Hadir",     icon: <UserCheck className="w-5 h-5" />, color: "text-emerald-600 bg-emerald-100", val: stats.hadir },
                    { key: "belum_pulang", label: "Blm Pulang", icon: <Clock className="w-5 h-5" />, color: "text-slate-600 bg-slate-100", val: stats.belum_pulang },
                    { key: "lembur",    label: "Lembur",    icon: <Clock className="w-5 h-5" />, color: "text-orange-600 bg-orange-100", val: stats.lembur },
                    { key: "terlambat", label: "Terlambat", icon: <AlertCircle className="w-5 h-5" />, color: "text-amber-600 bg-amber-100", val: stats.terlambat },
                    { key: "izin",      label: "Izin/Sakit",icon: <Coffee className="w-5 h-5" />, color: "text-blue-600 bg-blue-100", val: stats.izin },
                    { key: "absen",     label: "Absen",     icon: <UserX className="w-5 h-5" />, color: "text-red-600 bg-red-100", val: stats.absen },
                  ].map((s) => (
                    <div key={s.key} className="bg-card rounded-2xl border border-border shadow-sm p-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
                        {s.icon}
                      </div>
                      <p className="text-2xl font-bold text-foreground">{s.val}</p>
                      <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Employee Grid */}
                <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-foreground">Daftar Karyawan</span>
                  </div>
                  <div className="divide-y divide-border">
                    {todayGrid.map(({ emp, rec }) => {
                      const status: AttendanceStatus = getDerivedStatus(rec);
                      return (
                        <div key={emp.id} className="px-6 py-3.5 flex items-center gap-4">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: emp.color }}>
                            {emp.initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{emp.name}</p>
                            <p className="text-xs text-muted-foreground">{emp.position} · {emp.department}</p>
                          </div>
                          <div className="hidden sm:flex flex-col items-end justify-center mr-4 space-y-3">
                            {rec?.checkIn ? (
                              <div className="flex flex-col items-end gap-1.5 max-w-[200px]">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono font-semibold text-foreground">↑ {rec.checkIn}</span>
                                  {rec.photoCheckIn && (
                                    <button onClick={() => setSelectedPhoto({ src: rec.photoCheckIn!, label: `Absen Masuk - ${emp.name}` })} className="hover:opacity-80 transition-opacity">
                                      <img src={rec.photoCheckIn} alt="Masuk" className="w-8 h-8 object-cover rounded-md border border-border" />
                                    </button>
                                  )}
                                </div>
                                {rec.locationCheckIn && (
                                  <a href={`https://maps.google.com/?q=${rec.locationCheckIn.lat},${rec.locationCheckIn.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded-md hover:bg-blue-100 transition-colors w-full">
                                    <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <span className="whitespace-normal leading-tight text-left">{rec.locationCheckIn.address || "Lokasi Masuk"}</span>
                                  </a>
                                )}
                              </div>
                            ) : <span className="text-xs font-mono text-muted-foreground">Masuk: –</span>}
                            
                            {rec?.checkOut && (
                              <div className="flex flex-col items-end gap-1.5 max-w-[200px] mt-2 pt-2 border-t border-border">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono font-semibold text-foreground">↓ {rec.checkOut}</span>
                                  {rec.photoCheckOut && (
                                    <button onClick={() => setSelectedPhoto({ src: rec.photoCheckOut!, label: `Absen Pulang - ${emp.name}` })} className="hover:opacity-80 transition-opacity">
                                      <img src={rec.photoCheckOut} alt="Pulang" className="w-8 h-8 object-cover rounded-md border border-border" />
                                    </button>
                                  )}
                                </div>
                                {rec.locationCheckOut && (
                                  <a href={`https://maps.google.com/?q=${rec.locationCheckOut.lat},${rec.locationCheckOut.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md hover:bg-emerald-100 transition-colors w-full">
                                    <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <span className="whitespace-normal leading-tight text-left">{rec.locationCheckOut.address || "Lokasi Pulang"}</span>
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                          <StatusBadge status={status} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* ── All Data Tab ── */}
            {tab === "all" && (
              <>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h1 className="text-xl font-bold text-foreground">Semua Data Absensi</h1>
                    <p className="text-sm text-muted-foreground">Filter berdasarkan tanggal dan status</p>
                  </div>
                </div>

                {/* Filters */}
                <div className="flex gap-3 flex-wrap">
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as AttendanceStatus | "all")}
                    className="px-3 py-2 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                  >
                    <option value="all">Semua Status</option>
                    <option value="hadir">Hadir</option>
                    <option value="belum_pulang">Belum Pulang</option>
                    <option value="terlambat">Terlambat</option>
                    <option value="absen">Absen</option>
                    <option value="izin">Izin</option>
                  </select>
                </div>

                <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-foreground">
                      {formatDate(filterDate)} — {filtered.length} catatan
                    </span>
                  </div>
                  {filtered.length === 0 ? (
                    <p className="p-10 text-center text-sm text-muted-foreground">Tidak ada data untuk filter ini</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted">
                            <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Karyawan</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Departemen</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Masuk</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pulang</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lembur Masuk</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lembur Keluar</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {filtered.map((rec) => {
                            const emp = getEmp(rec.employeeId);
                            return (
                              <tr key={rec.id} className="hover:bg-muted/40 transition-colors">
                                <td className="px-6 py-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: emp.color }}>
                                      {emp.initials}
                                    </div>
                                    <span className="font-medium text-foreground">{emp.name}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">{emp.department}</td>
                                <td className="px-4 py-3 align-top min-w-[160px]">
                                  {rec.checkIn ? (
                                    <div className="flex flex-col items-start gap-1.5">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-semibold">{rec.checkIn}</span>
                                        {rec.photoCheckIn && (
                                          <button onClick={() => setSelectedPhoto({ src: rec.photoCheckIn!, label: `Masuk - ${emp.name}` })} className="hover:opacity-80 transition-opacity shrink-0">
                                            <img src={rec.photoCheckIn} alt="Masuk" className="w-8 h-8 object-cover rounded-md border border-border" />
                                          </button>
                                        )}
                                      </div>
                                      {rec.locationCheckIn && (
                                        <a href={`https://maps.google.com/?q=${rec.locationCheckIn.lat},${rec.locationCheckIn.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 transition-colors w-full">
                                          <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                                          <span className="whitespace-normal leading-tight text-left">{rec.locationCheckIn.address || "Lokasi Masuk"}</span>
                                        </a>
                                      )}
                                    </div>
                                  ) : <span className="font-mono text-xs text-muted-foreground text-center block">{"–"}</span>}
                                </td>
                                <td className="px-4 py-3 align-top min-w-[160px]">
                                  {rec.checkOut ? (
                                    <div className="flex flex-col items-start gap-1.5">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-semibold">{rec.checkOut}</span>
                                        {rec.photoCheckOut && (
                                          <button onClick={() => setSelectedPhoto({ src: rec.photoCheckOut!, label: `Pulang - ${emp.name}` })} className="hover:opacity-80 transition-opacity shrink-0">
                                            <img src={rec.photoCheckOut} alt="Pulang" className="w-8 h-8 object-cover rounded-md border border-border" />
                                          </button>
                                        )}
                                      </div>
                                      {rec.isPulangCepat && (
                                        <div className="p-1.5 bg-amber-100 text-amber-800 rounded-md text-[10px] border border-amber-200 w-full">
                                          <span className="font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Pulang Cepat</span>
                                          <span className="italic block mt-0.5 whitespace-normal opacity-80">{rec.pulangCepatReason}</span>
                                        </div>
                                      )}
                                      {rec.locationCheckOut && (
                                        <a href={`https://maps.google.com/?q=${rec.locationCheckOut.lat},${rec.locationCheckOut.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded hover:bg-emerald-100 transition-colors w-full">
                                          <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                                          <span className="whitespace-normal leading-tight text-left">{rec.locationCheckOut.address || "Lokasi Pulang"}</span>
                                        </a>
                                      )}
                                    </div>
                                  ) : <span className="font-mono text-xs text-muted-foreground text-center block">{"–"}</span>}
                                </td>
                                <td className="px-4 py-3 align-top">
                                  {rec.lemburIn ? (
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-xs font-semibold">{rec.lemburIn}</span>
                                      {rec.photoLemburIn && (
                                        <button onClick={() => setSelectedPhoto({ src: rec.photoLemburIn!, label: `Mulai Lembur - ${emp.name}` })} className="hover:opacity-80 transition-opacity shrink-0">
                                          <img src={rec.photoLemburIn} alt="Lembur" className="w-8 h-8 object-cover rounded-md border border-border" />
                                        </button>
                                      )}
                                    </div>
                                  ) : <span className="font-mono text-xs text-muted-foreground text-center block">{"–"}</span>}
                                </td>
                                <td className="px-4 py-3 align-top">
                                  {rec.lemburOut ? (
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-xs font-semibold">{rec.lemburOut}</span>
                                      {rec.photoLemburOut && (
                                        <button onClick={() => setSelectedPhoto({ src: rec.photoLemburOut!, label: `Selesai Lembur - ${emp.name}` })} className="hover:opacity-80 transition-opacity shrink-0">
                                          <img src={rec.photoLemburOut} alt="Lembur" className="w-8 h-8 object-cover rounded-md border border-border" />
                                        </button>
                                      )}
                                    </div>
                                  ) : <span className="font-mono text-xs text-muted-foreground text-center block">{"–"}</span>}
                                </td>
                                <td className="px-4 py-3 text-center"><StatusBadge status={getDerivedStatus(rec)} /></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Leave Tab ── */}
            {tab === "leave" && (
              <>
                <div>
                  <h1 className="text-xl font-bold text-foreground">Pengajuan Izin & Cuti</h1>
                  <p className="text-sm text-muted-foreground">{pendingLeave.length} menunggu persetujuan</p>
                </div>

                {/* Pending */}
                {pendingLeave.length > 0 && (
                  <div className="bg-card rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-amber-100 bg-amber-50 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="font-semibold text-amber-800 text-sm">Menunggu Persetujuan</span>
                    </div>
                    <div className="divide-y divide-border">
                      {pendingLeave.map((lr) => {
                        const emp = getEmp(lr.employeeId);
                        const ltc = LEAVE_CONFIG[lr.type];
                        return (
                          <div key={lr.id} className="px-6 py-4 flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: emp.color }}>
                              {emp.initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-semibold text-sm text-foreground">{emp.name}</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ltc.color}`}>{ltc.label}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mb-1">{emp.position} · {lr.startDate} s/d {lr.endDate}</p>
                              <p className="text-sm text-foreground bg-muted rounded-lg px-3 py-2">{lr.reason}</p>
                              <p className="text-xs text-muted-foreground mt-1">Dikirim {formatDateTime(lr.submittedAt)}</p>
                            </div>
                            <div className="flex flex-col gap-2 shrink-0 w-32">
                              <select 
                                className="px-2 py-1.5 text-xs bg-muted text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                                value={leaveOverrides[lr.id] || lr.type}
                                onChange={(e) => setLeaveOverrides(prev => ({...prev, [lr.id]: e.target.value as import("../../types").LeaveType}))}
                              >
                                <option value="izin">Izin</option>
                                <option value="sakit">Sakit</option>
                                <option value="cuti">Cuti</option>
                              </select>
                              <button
                                onClick={() => onApprove(lr.id, leaveOverrides[lr.id] || lr.type)}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" /> Setuju
                              </button>
                              <button
                                onClick={() => onReject(lr.id)}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold hover:bg-red-100 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" /> Tolak
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* All requests */}
                <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-foreground">Semua Pengajuan</span>
                  </div>
                  {leaveRequests.length === 0 ? (
                    <p className="p-10 text-center text-sm text-muted-foreground">Belum ada pengajuan</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {leaveRequests
                        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
                        .map((lr) => {
                          const emp = getEmp(lr.employeeId);
                          const ltc = LEAVE_CONFIG[lr.type];
                          const lsc = LEAVE_STATUS_CONFIG[lr.status];
                          return (
                            <div key={lr.id} className="px-6 py-3.5 flex items-center gap-4">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: emp.color }}>
                                {emp.initials}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm text-foreground">{emp.name}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ltc.color}`}>{ltc.label}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">{lr.startDate} s/d {lr.endDate} · {lr.reason}</p>
                              </div>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${lsc.color}`}>
                                {lsc.icon}{lsc.label}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === "recap" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-bold text-foreground">Rekap Absen bulanan</h1>
                    <p className="text-sm text-muted-foreground">Laporan jam kerja karyawan untuk bulan terpilih.</p>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <input 
                      type="month" 
                      value={recapMonth} 
                      onChange={(e) => setRecapMonth(e.target.value)}
                      className="bg-muted border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 flex-1 sm:flex-none"
                    />
                    <button 
                      onClick={handleDownloadExcel}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shrink-0"
                    >
                      <Download className="w-4 h-4" /> Download Excel
                    </button>
                  </div>
                </div>

                <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border">
                          <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Karyawan</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hadir</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Telat</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Izin</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Absen</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Jam Kerja</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Jam Lembur</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {recapData.map((row) => (
                          <tr key={row.emp.id} className="hover:bg-muted/40 transition-colors">
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: row.emp.color }}>
                                  {row.emp.initials}
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-medium text-foreground text-sm">{row.emp.name}</span>
                                  <span className="text-xs text-muted-foreground">{row.emp.position}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-sm font-medium">{row.countHadir}</td>
                            <td className="px-4 py-3 text-center text-sm font-medium text-amber-600">{row.countTelat}</td>
                            <td className="px-4 py-3 text-center text-sm font-medium text-blue-600">{row.countIzin}</td>
                            <td className="px-4 py-3 text-center text-sm font-medium text-red-600">{row.countAbsen}</td>
                            <td className="px-4 py-3 text-center font-mono text-sm">{row.totalWorkHours} j</td>
                            <td className="px-4 py-3 text-center font-mono text-sm">{row.totalOvertimeHours} j</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── Rekap Izin / Cuti Tab ── */}
            {tab === "recap_leave" && (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h1 className="text-xl font-bold text-foreground">Rekap Izin, Sakit & Cuti</h1>
                    <p className="text-sm text-muted-foreground">Menampilkan total hari berdasarkan pengajuan yang telah disetujui</p>
                  </div>
                </div>

                <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-foreground">
                      Data Rekap Izin / Cuti
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted">
                          <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Karyawan</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Izin (Hari)</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sakit (Hari)</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cuti (Hari)</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {recapLeaveData.map((row) => (
                          <tr key={row.emp.id} className="hover:bg-muted/40 transition-colors">
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: row.emp.color }}>
                                  {row.emp.initials}
                                </div>
                                <div>
                                  <span className="font-medium text-foreground block">{row.emp.name}</span>
                                  <span className="text-xs text-muted-foreground">{row.emp.id}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-sm font-medium text-amber-600">{row.countIzin}</td>
                            <td className="px-4 py-3 text-center text-sm font-medium text-red-600">{row.countSakit}</td>
                            <td className="px-4 py-3 text-center text-sm font-medium text-emerald-600">{row.countCuti}</td>
                            <td className="px-4 py-3 text-center font-mono text-sm font-bold">{row.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {tab === "employees" && (
              <div className="space-y-6">
                <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-border">
                    <h3 className="font-semibold text-foreground flex items-center gap-2"><UserCheck className="w-5 h-5 text-primary" /> Tambah Karyawan Baru</h3>
                  </div>
                  <div className="p-6">
                    <form onSubmit={handleAddEmployee} className="grid gap-4 md:grid-cols-4 items-end">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">ID Karyawan</label>
                        <input value={newEmpId} onChange={e => setNewEmpId(e.target.value)} required placeholder="EMP009" className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Nama Lengkap</label>
                        <input value={newEmpName} onChange={e => setNewEmpName(e.target.value)} required placeholder="Joko Widodo" className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Jabatan</label>
                        <input value={newEmpRole} onChange={e => setNewEmpRole(e.target.value)} required placeholder="Staff" className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <button type="submit" className="bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-xl text-sm hover:bg-primary/90 transition-colors h-[38px]">
                        Tambah
                      </button>
                    </form>
                  </div>
                </div>

                <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-border">
                    <h3 className="font-semibold text-foreground flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Daftar Karyawan</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {employees.map((emp) => (
                      <div key={emp.id} className="px-6 py-3 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: emp.color }}>
                          {emp.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm text-foreground truncate">{emp.name}</h4>
                          <p className="text-xs text-muted-foreground truncate">{emp.position} · {emp.id}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingEmp(emp);
                              setEditEmpName(emp.name);
                              setEditEmpRole(emp.position);
                              setEditEmpDept(emp.department);
                            }}
                            className="p-2 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                            title="Edit Karyawan"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Yakin ingin mereset PIN untuk ${emp.name}? Karyawan akan diminta membuat PIN baru saat login.`)) {
                                onEditEmployee({ ...emp, pin: "" });
                              }
                            }}
                            className="p-2 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
                            title="Reset PIN"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Yakin ingin menghapus ${emp.name}? Data absen terkait tidak akan terhapus namun profil tidak bisa login lagi.`)) {
                                onDeleteEmployee(emp.id);
                              }
                            }}
                            className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            title="Hapus Karyawan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedPhoto(null)}>
          <div className="bg-card rounded-2xl overflow-hidden shadow-2xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b flex justify-between items-center bg-muted/50">
              <span className="font-semibold text-sm">{selectedPhoto.label}</span>
              <button onClick={() => setSelectedPhoto(null)} className="p-1 hover:bg-black/5 rounded-full"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 bg-black">
              <img src={selectedPhoto.src} alt="Bukti Absen" className="w-full rounded-lg" />
            </div>
          </div>
        </div>
      )}

      {editingEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setEditingEmp(null)}>
          <div className="bg-card rounded-2xl overflow-hidden shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30">
              <span className="font-bold text-foreground">Edit Karyawan: {editingEmp.id}</span>
              <button onClick={() => setEditingEmp(null)} className="p-1 hover:bg-black/5 rounded-full"><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="p-6">
              <form onSubmit={handleEditEmployeeSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Nama Lengkap</label>
                  <input value={editEmpName} onChange={e => setEditEmpName(e.target.value)} required className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Departemen</label>
                  <input value={editEmpDept} onChange={e => setEditEmpDept(e.target.value)} required className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Jabatan / Posisi</label>
                  <input value={editEmpRole} onChange={e => setEditEmpRole(e.target.value)} required className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setEditingEmp(null)} className="flex-1 bg-muted text-muted-foreground font-semibold px-4 py-3 rounded-xl text-sm hover:bg-muted/80 transition-colors">Batal</button>
                  <button type="submit" className="flex-1 bg-primary text-primary-foreground font-semibold px-4 py-3 rounded-xl text-sm hover:bg-primary/90 transition-colors">Simpan Perubahan</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
