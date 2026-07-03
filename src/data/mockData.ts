import { Employee, AttendanceRecord, LeaveRequest, AttendanceStatus } from "../types";

export const COLORS = ["#1B3E7A", "#0D8A6F", "#7C3AED", "#C8200E", "#D97706", "#0369A1", "#BE185D", "#065F46"];

export const INITIAL_EMPLOYEES: Employee[] = [
  { id: "EMP001", name: "Kenzo", department: "Engineering", position: "Backend Developer", initials: "BS", color: COLORS[0] },
  { id: "EMP002", name: "Siti Rahayu", department: "Marketing", position: "Marketing Manager", initials: "SR", color: COLORS[1] },
  { id: "EMP003", name: "Ahmad Fauzi", department: "Finance", position: "Finance Analyst", initials: "AF", color: COLORS[2] },
  { id: "EMP004", name: "Dewi Kusuma", department: "HR", position: "HR Specialist", initials: "DK", color: COLORS[3] },
  { id: "EMP005", name: "Reza Pratama", department: "Engineering", position: "Frontend Developer", initials: "RP", color: COLORS[4] },
  { id: "EMP006", name: "Nina Wulandari", department: "Marketing", position: "Content Creator", initials: "NW", color: COLORS[5] },
  { id: "EMP007", name: "Dian Pratiwi", department: "Operations", position: "Operations Lead", initials: "DP", color: COLORS[6] },
  { id: "EMP008", name: "Hendra Gunawan", department: "Finance", position: "Accountant", initials: "HG", color: COLORS[7] },
];

export const SEED_LEAVE_REQUESTS: LeaveRequest[] = [
  { id: "LR001", employeeId: "EMP003", type: "sakit", startDate: "2025-06-20", endDate: "2025-06-21", reason: "Demam dan batuk, sudah ke dokter", status: "approved", submittedAt: "2025-06-20T07:30:00" },
  { id: "LR002", employeeId: "EMP006", type: "cuti", startDate: "2025-06-25", endDate: "2025-06-27", reason: "Liburan keluarga ke Yogyakarta", status: "pending", submittedAt: "2025-06-18T09:15:00" },
  { id: "LR003", employeeId: "EMP002", type: "izin", startDate: "2025-06-24", endDate: "2025-06-24", reason: "Ada keperluan keluarga mendadak", status: "pending", submittedAt: "2025-06-23T08:00:00" },
  { id: "LR004", employeeId: "EMP007", type: "sakit", startDate: "2025-06-19", endDate: "2025-06-19", reason: "Migrain akut", status: "rejected", submittedAt: "2025-06-19T10:00:00" },
];

export function generateSeedAttendance(employees: Employee[]): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const today = new Date();

  for (let d = 13; d >= 1; d--) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    const dateStr = date.toISOString().split("T")[0];

    employees.forEach((emp, i) => {
      const rng = ((i * 7 + d * 13) % 100) / 100;
      let status: AttendanceStatus;
      let checkIn: string | undefined;
      let checkOut: string | undefined;

      if (rng < 0.05) {
        status = "izin";
      } else if (rng < 0.12) {
        status = "absen";
      } else if (rng < 0.28) {
        status = "terlambat";
        const late = 16 + ((i * d) % 50);
        const totalMins = 9 * 60 + late;
        checkIn = `${String(Math.floor(totalMins / 60)).padStart(2, "0")}:${String(totalMins % 60).padStart(2, "0")}`;
        checkOut = `${17 + (i % 2)}:${String((d * 3) % 60).padStart(2, "0")}`;
      } else {
        status = "hadir";
        const early = (i * 3 + d) % 15;
        const totalMins = 9 * 60 - early;
        checkIn = `${String(Math.floor(totalMins / 60)).padStart(2, "0")}:${String(totalMins % 60).padStart(2, "0")}`;
        checkOut = `${17 + (d % 2)}:${String((i * 7) % 60).padStart(2, "0")}`;
      }

      records.push({ id: `${dateStr}-${emp.id}`, employeeId: emp.id, date: dateStr, checkIn, checkOut, status });
    });
  }
  return records;
}
