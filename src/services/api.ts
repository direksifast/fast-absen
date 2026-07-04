import { AttendanceRecord, Employee, LeaveRequest } from "../types";
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

  // --- Employees ---
  getEmployees: async (): Promise<Employee[]> => {
    const { data, error } = await supabase.from('employees').select('*');
    if (error) { console.error("Error getEmployees:", error); return []; }
    return toCamel(data);
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
    let query = supabase.from('attendance').select('*');
    const filter = monthPrefix || new Date().toISOString().substring(0, 7);
    query = query.like('date', `${filter}%`);
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
      
      const [header, base64] = base64Data.split(',');
      if (!base64) return base64Data;
      
      const byteString = atob(base64);
      const mimeString = header.split(':')[1].split(';')[0];
      
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });

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
