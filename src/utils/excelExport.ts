import * as XLSX from "xlsx";
import { AttendanceRecord, Employee, LeaveRequest } from "../types";
import { calculateDurationMins, calculateWorkDurationMins, formatMinutesToDecimal } from "./index";

const MONTH_NAMES_ID: Record<string, string> = {
  "01": "Januari",
  "02": "Februari",
  "03": "Maret",
  "04": "April",
  "05": "Mei",
  "06": "Juni",
  "07": "Juli",
  "08": "Agustus",
  "09": "September",
  "10": "Oktober",
  "11": "November",
  "12": "Desember"
};

function formatMonthLabel(recapMonth: string): string {
  const [year, month] = recapMonth.split("-");
  const monthName = MONTH_NAMES_ID[month] || month;
  return `${monthName} ${year}`;
}

function getDayNameIndonesian(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  return days[d.getDay()] || "";
}

export function exportProfessionalExcel({
  recapMonth,
  employees,
  attendance,
  leaveRequests,
  recapData
}: {
  recapMonth: string;
  employees: Employee[];
  attendance: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  recapData: Array<{
    emp: Employee;
    totalWorkHours: string;
    totalOvertimeHours: string;
    countHadir: number;
    countTelat: number;
    countIzin: number;
    countAbsen: number;
  }>;
}) {
  const workbook = XLSX.utils.book_new();
  const monthFormatted = formatMonthLabel(recapMonth);
  const printTimestamp = new Date().toLocaleString("id-ID", {
    dateStyle: "full",
    timeStyle: "medium"
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 1: RINGKASAN EKSEKUTIF BULANAN
  // ═══════════════════════════════════════════════════════════════════════════
  let totalAllHadir = 0;
  let totalAllTelat = 0;
  let totalAllIzin = 0;
  let totalAllAbsen = 0;
  let totalAllWorkMins = 0;
  let totalAllOvertimeMins = 0;

  recapData.forEach(r => {
    totalAllHadir += r.countHadir;
    totalAllTelat += r.countTelat;
    totalAllIzin += r.countIzin;
    totalAllAbsen += r.countAbsen;
    totalAllWorkMins += parseFloat(r.totalWorkHours || "0") * 60;
    totalAllOvertimeMins += parseFloat(r.totalOvertimeHours || "0") * 60;
  });

  const totalAllWorkHours = formatMinutesToDecimal(totalAllWorkMins);
  const totalAllOvertimeHours = formatMinutesToDecimal(totalAllOvertimeMins);

  const sheet1Data: any[][] = [
    ["LAPORAN REKAPITULASI ABSENSI & KINERJA KARYAWAN"],
    [`PERIODE BULAN: ${monthFormatted.toUpperCase()} | SISTEM FAST ABSEN`],
    [`Tanggal Cetak: ${printTimestamp} | Status: Dokumen Resmi Eksekutif`],
    [],
    ["📊 RINGKASAN EKSEKUTIF PERIODE INI"],
    ["Total Karyawan", "Total Kehadiran", "Total Terlambat", "Total Izin/Sakit", "Total Jam Kerja", "Total Jam Lembur"],
    [
      employees.length,
      `${totalAllHadir} Hari`,
      `${totalAllTelat} Hari`,
      `${totalAllIzin} Hari`,
      `${totalAllWorkHours} Jam`,
      `${totalAllOvertimeHours} Jam`
    ],
    [],
    ["📋 RINCIAN REKAPITULASI PER KARYAWAN"],
    [
      "No",
      "ID Karyawan",
      "Nama Karyawan",
      "Departemen",
      "Jabatan / Posisi",
      "Hadir (Hari)",
      "Terlambat (Hari)",
      "Izin / Sakit (Hari)",
      "Tanpa Keterangan",
      "Total Jam Kerja (Jam)",
      "Total Jam Lembur (Jam)",
      "Persentase Kehadiran",
      "Evaluasi Kinerja"
    ]
  ];

  recapData.forEach((r, idx) => {
    const totalWorkingDays = r.countHadir + r.countTelat + r.countIzin + r.countAbsen;
    const activeDays = r.countHadir + r.countTelat;
    const attendancePct = totalWorkingDays > 0 ? ((activeDays / totalWorkingDays) * 100).toFixed(1) + "%" : "100%";
    
    let evaluation = "Sangat Baik 🌟";
    const pctVal = parseFloat(attendancePct);
    if (pctVal < 85) evaluation = "Perlu Evaluasi ⚠️";
    else if (pctVal < 95 || r.countTelat > 3) evaluation = "Cukup / Perhatian ⚠️";

    sheet1Data.push([
      idx + 1,
      r.emp.id,
      r.emp.name,
      r.emp.department || "Umum",
      r.emp.position,
      r.countHadir,
      r.countTelat,
      r.countIzin,
      r.countAbsen,
      Number(r.totalWorkHours),
      Number(r.totalOvertimeHours),
      attendancePct,
      evaluation
    ]);
  });

  // Summary Row
  sheet1Data.push([
    "TOTAL",
    "-",
    `Total ${employees.length} Karyawan`,
    "-",
    "-",
    totalAllHadir,
    totalAllTelat,
    totalAllIzin,
    totalAllAbsen,
    Number(totalAllWorkHours),
    Number(totalAllOvertimeHours),
    "-",
    "-"
  ]);

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  ws1["!cols"] = [
    { wch: 6 },  // No
    { wch: 15 }, // ID
    { wch: 25 }, // Nama
    { wch: 18 }, // Dept
    { wch: 22 }, // Jabatan
    { wch: 14 }, // Hadir
    { wch: 16 }, // Terlambat
    { wch: 18 }, // Izin
    { wch: 18 }, // Absen
    { wch: 22 }, // Jam Kerja
    { wch: 22 }, // Jam Lembur
    { wch: 20 }, // Pct
    { wch: 22 }  // Evaluasi
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 2: RINCIAN ABSENSI HARIAN (GRANULAR LOG)
  // ═══════════════════════════════════════════════════════════════════════════
  const monthRecords = attendance
    .filter(r => r.date.startsWith(recapMonth))
    .sort((a, b) => a.date.localeCompare(b.date) || a.employeeId.localeCompare(b.employeeId));

  const sheet2Data: any[][] = [
    ["LOG RINCIAN ABSENSI HARIAN KARYAWAN"],
    [`PERIODE: ${monthFormatted.toUpperCase()} | FAST ABSEN SYSTEM`],
    [`Tanggal Cetak: ${printTimestamp}`],
    [],
    [
      "No",
      "Tanggal",
      "Hari",
      "ID Karyawan",
      "Nama Karyawan",
      "Jabatan",
      "Jam Masuk",
      "Status Masuk",
      "Lokasi Masuk (GPS / Alamat)",
      "Jam Pulang",
      "Status Pulang",
      "Lokasi Pulang (GPS / Alamat)",
      "Durasi Kerja (Jam)",
      "Lembur Masuk",
      "Lembur Selesai",
      "Durasi Lembur (Jam)",
      "Catatan / Pulang Cepat"
    ]
  ];

  monthRecords.forEach((r, idx) => {
    const emp = employees.find(e => e.id === r.employeeId);
    const empName = emp ? emp.name : r.employeeId;
    const empPos = emp ? emp.position : "-";
    const dayName = getDayNameIndonesian(r.date);

    let statusMasukText = "Hadir Tepat Waktu";
    if (r.status === "terlambat") statusMasukText = "Terlambat";
    else if (r.status === "izin") statusMasukText = "Izin / Cuti";
    else if (r.status === "absen") statusMasukText = "Tanpa Keterangan";

    let statusPulangText = "Normal";
    if (r.isPulangCepat) statusPulangText = "Pulang Cepat";
    else if (!r.checkOut && (r.status === "hadir" || r.status === "terlambat")) statusPulangText = "Belum Check-out";

    const workMins = r.checkIn && r.checkOut ? calculateWorkDurationMins(r.checkIn, r.checkOut, r.date) : 0;
    const overtimeMins = r.lemburIn && r.lemburOut ? calculateDurationMins(r.lemburIn, r.lemburOut) : 0;

    const locIn = r.locationCheckIn?.address || (r.locationCheckIn ? `${r.locationCheckIn.lat.toFixed(5)}, ${r.locationCheckIn.lng.toFixed(5)}` : "-");
    const locOut = r.locationCheckOut?.address || (r.locationCheckOut ? `${r.locationCheckOut.lat.toFixed(5)}, ${r.locationCheckOut.lng.toFixed(5)}` : "-");

    sheet2Data.push([
      idx + 1,
      r.date,
      dayName,
      r.employeeId,
      empName,
      empPos,
      r.checkIn || "-",
      statusMasukText,
      locIn,
      r.checkOut || "-",
      statusPulangText,
      locOut,
      Number(formatMinutesToDecimal(workMins)),
      r.lemburIn || "-",
      r.lemburOut || "-",
      Number(formatMinutesToDecimal(overtimeMins)),
      r.pulangCepatReason ? `Pulang Cepat: ${r.pulangCepatReason}` : "-"
    ]);
  });

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
  ws2["!cols"] = [
    { wch: 6 },  // No
    { wch: 14 }, // Tanggal
    { wch: 10 }, // Hari
    { wch: 14 }, // ID
    { wch: 24 }, // Nama
    { wch: 20 }, // Jabatan
    { wch: 12 }, // Jam Masuk
    { wch: 18 }, // Status Masuk
    { wch: 35 }, // Lokasi Masuk
    { wch: 12 }, // Jam Pulang
    { wch: 16 }, // Status Pulang
    { wch: 35 }, // Lokasi Pulang
    { wch: 18 }, // Durasi Kerja
    { wch: 14 }, // Lembur Masuk
    { wch: 14 }, // Lembur Out
    { wch: 18 }, // Durasi Lembur
    { wch: 30 }  // Catatan
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 3: REKAP DAFTAR IZIN & CUTI
  // ═══════════════════════════════════════════════════════════════════════════
  const monthLeaves = leaveRequests.filter(l => {
    return l.startDate.startsWith(recapMonth) || l.endDate.startsWith(recapMonth);
  });

  const sheet3Data: any[][] = [
    ["LAPORAN DAFTAR PENGAJUAN IZIN, SAKIT & CUTI"],
    [`PERIODE: ${monthFormatted.toUpperCase()} | FAST ABSEN SYSTEM`],
    [`Tanggal Cetak: ${printTimestamp}`],
    [],
    [
      "No",
      "ID Karyawan",
      "Nama Karyawan",
      "Departemen",
      "Jenis Pengajuan",
      "Tanggal Mulai",
      "Tanggal Selesai",
      "Durasi Hari",
      "Alasan / Keterangan",
      "Status Persetujuan",
      "Tanggal Pengajuan"
    ]
  ];

  monthLeaves.forEach((l, idx) => {
    const emp = employees.find(e => e.id === l.employeeId);
    const start = new Date(l.startDate);
    const end = new Date(l.endDate);
    const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    let statusText = "Menunggu Persetujuan";
    if (l.status === "approved") statusText = "Disetujui (Approved)";
    else if (l.status === "rejected") statusText = "Ditolak (Rejected)";

    sheet3Data.push([
      idx + 1,
      l.employeeId,
      emp ? emp.name : l.employeeId,
      emp ? emp.department || "Umum" : "-",
      l.type.toUpperCase(),
      l.startDate,
      l.endDate,
      `${diffDays} Hari`,
      l.reason || "-",
      statusText,
      new Date(l.submittedAt).toLocaleDateString("id-ID")
    ]);
  });

  const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);
  ws3["!cols"] = [
    { wch: 6 },  // No
    { wch: 14 }, // ID
    { wch: 24 }, // Nama
    { wch: 18 }, // Dept
    { wch: 16 }, // Jenis
    { wch: 14 }, // Start
    { wch: 14 }, // End
    { wch: 14 }, // Durasi
    { wch: 35 }, // Alasan
    { wch: 24 }, // Status
    { wch: 16 }  // Submitted
  ];

  // Append sheets to workbook
  XLSX.utils.book_append_sheet(workbook, ws1, "📊 Ringkasan Rekap");
  XLSX.utils.book_append_sheet(workbook, ws2, "📅 Rincian Absensi Harian");
  XLSX.utils.book_append_sheet(workbook, ws3, "📝 Daftar Izin & Cuti");

  // Save workbook
  const filename = `Rekap_Eksekutif_Absensi_${recapMonth}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
