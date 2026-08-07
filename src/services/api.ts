import { AttendanceRecord, Employee, LeaveRequest, AppSettings } from "../types";
import { supabase } from "./supabase";

// ─── UTILS: KONVERSI FORMAT DATA ───
const toCamel = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(v => toCamel(v));
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = key.replace(/([-_][a-z])/ig, ($1) => $1.toUpperCase().replace('-', '').replace('_', ''));
      result[camelKey] = toCamel(obj[key]);
      return result;
    }, {} as any);
  }
  return obj;
};

const toSnake = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(v => toSnake(v));
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((result, key) => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      result[snakeKey] = toSnake(obj[key]);
      return result;
    }, {} as any);
  }
  return obj;
};

// ─── API SUPABASE ───
export const api = {
  // --- Admin Auth ---
  adminLogin: async (email: string, password: string): Promise<void> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  // --- App Settings (Metode Absen QR / Face) ---
  // --- App Settings (Metode Absen QR / Face) ---
  getSettings: async (): Promise<AppSettings> => {
    // 1. Coba baca dari tabel app_settings (jika ada)
    try {
      const { data, error } = await supabase.from('app_settings').select('*').eq('id', 'default').single();
      if (!error && data) {
        return {
          allowQrScan: data.allow_qr_scan ?? true,
          allowFaceScan: data.allow_face_scan ?? true,
        };
      }
    } catch (e) {}

    // 2. Coba baca dari record sistem di tabel employees (__APP_SETTINGS__)
    try {
      const { data, error } = await supabase.from('employees').select('pin').eq('id', '__APP_SETTINGS__').single();
      if (!error && data && data.pin) {
        const parsed = JSON.parse(data.pin);
        return {
          allowQrScan: parsed.allowQrScan ?? true,
          allowFaceScan: parsed.allowFaceScan ?? true,
        };
      }
    } catch (e) {}

    // 3. Fallback localStorage
    const saved = localStorage.getItem('fast-absen-app-settings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return { allowQrScan: true, allowFaceScan: true };
  },

  saveSettings: async (settings: AppSettings): Promise<void> => {
    localStorage.setItem('fast-absen-app-settings', JSON.stringify(settings));

    // 1. Simpan ke record sistem di tabel employees (__APP_SETTINGS__) untuk sinkronisasi seluruh perangkat
    try {
      await supabase.from('employees').upsert({
        id: '__APP_SETTINGS__',
        name: 'System Settings',
        department: 'System',
        position: 'Config',
        initials: 'SYS',
        color: '#000000',
        pin: JSON.stringify(settings),
      });
    } catch (e) {
      console.warn("Supabase saveSettings (employees fallback) warning:", e);
    }

    // 2. Coba simpan ke tabel app_settings
    try {
      await supabase.from('app_settings').upsert({
        id: 'default',
        allow_qr_scan: settings.allowQrScan,
        allow_face_scan: settings.allowFaceScan,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {}
  },

  // --- Employees ---
  getEmployees: async (): Promise<Employee[]> => {
    const { data, error } = await supabase.from('employees').select('*').order('id', { ascending: true });
    if (error) { console.error("Error getEmployees:", error); return []; }
    const emps = toCamel(data) as Employee[];
    return emps.filter(e => e.id !== '__APP_SETTINGS__');
  },
  
  saveEmployee: async (emp: Employee): Promise<void> => {
    const { error } = await supabase.from('employees').upsert(toSnake(emp));
    if (error) { console.error("Error saveEmployee:", error); throw error; }
  },

  deleteEmployee: async (id: string): Promise<void> => {
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) { console.error("Error deleteEmployee:", error); throw error; }
  },

  // --- Attendance ---
  getAttendance: async (monthPrefix?: string): Promise<AttendanceRecord[]> => {
    let query = supabase.from('attendance').select('*').order('date', { ascending: false });
    
    if (monthPrefix && monthPrefix !== "all") {
      const startDate = `${monthPrefix}-01`;
      const [yearStr, monthStr] = monthPrefix.split('-');
      let nextYear = parseInt(yearStr);
      let nextMonthNum = parseInt(monthStr) + 1;
      if (nextMonthNum > 12) {
        nextMonthNum = 1;
        nextYear += 1;
      }
      const nextMonthStr = `${nextYear}-${String(nextMonthNum).padStart(2, '0')}-01`;
      query = query.gte('date', startDate).lt('date', nextMonthStr);
    }
    
    const { data, error } = await query;
    if (error) { console.error("Error getAttendance:", error); return []; }
    return toCamel(data);
  },

  saveAttendanceRecord: async (record: AttendanceRecord): Promise<void> => {
    const { error } = await supabase.from('attendance').upsert(toSnake(record));
    if (error) { console.error("Error saveAttendanceRecord:", error); throw error; }
  },

  // --- Leave Requests ---
  getLeaveRequests: async (): Promise<LeaveRequest[]> => {
    const { data, error } = await supabase.from('leave_requests').select('*');
    if (error) { console.error("Error getLeaveRequests:", error); return []; }
    return toCamel(data);
  },

  saveLeaveRequest: async (req: LeaveRequest): Promise<void> => {
    const { error } = await supabase.from('leave_requests').upsert(toSnake(req));
    if (error) { console.error("Error saveLeaveRequest:", error); throw error; }
  },

  // --- Storage ---
  uploadPhoto: async (base64Data: string, path: string): Promise<string> => {
    try {
      if (!base64Data.startsWith('data:image')) {
        return base64Data; // Already a URL or raw string
      }
      
      const response = await fetch(base64Data);
      const blob = await response.blob();
      const mimeString = blob.type;

      const { data, error } = await supabase.storage
        .from('attendance-photos')
        .upload(path, blob, {
          contentType: mimeString,
          upsert: true
        });

      if (error) {
        console.error("Error upload photo:", error);
        return base64Data;
      }

      const { data: urlData } = supabase.storage
        .from('attendance-photos')
        .getPublicUrl(path);
        
      return urlData.publicUrl;
    } catch (e) {
      console.error("Upload exception:", e);
      return base64Data;
    }
  }
};
