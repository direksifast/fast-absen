export type AppView = "login" | "employee" | "admin";
export type AttendanceStatus = "hadir" | "terlambat" | "absen" | "izin";
export type LeaveType = "izin" | "sakit" | "cuti";
export type LeaveStatus = "pending" | "approved" | "rejected";

export interface Employee {
  id: string;
  name: string;
  department: string;
  position: string;
  initials: string;
  color: string;
}

export interface LocationData {
  lat: number;
  lng: number;
  address?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  lemburIn?: string;
  lemburOut?: string;
  photoCheckIn?: string;
  photoCheckOut?: string;
  photoLemburIn?: string;
  photoLemburOut?: string;
  locationCheckIn?: LocationData;
  locationCheckOut?: LocationData;
  locationLemburIn?: LocationData;
  locationLemburOut?: LocationData;
  status: AttendanceStatus;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  submittedAt: string;
}
