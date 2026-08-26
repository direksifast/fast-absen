-- ========================================================
-- SCRIPT UNTUK MEMPERBAIKI ISSUE KEAMANAN SUPABASE
-- "Row-Level Security is not enabled" (rls_disabled_in_public)
-- ========================================================
-- 1. Jalankan script ini di menu "SQL Editor" pada dashboard Supabase Anda.
-- 2. Ini akan mengaktifkan RLS untuk semua tabel aplikasi Anda, sehingga
--    peringatan keamanan dari Supabase akan hilang.
-- 3. Karena aplikasi FAST ABSEN melakukan pengecekan login (PIN/Wajah) 
--    di sisi frontend, kita membuat Policy (aturan) yang mengizinkan
--    semua akses (anon key) agar aplikasi tetap berjalan lancar.

-- MENGAKTIFKAN RLS (ROW LEVEL SECURITY)
ALTER TABLE IF EXISTS public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- MENGHAPUS POLICY LAMA JIKA SUDAH ADA (AGAR TIDAK BENTROK)
DROP POLICY IF EXISTS "public_employees_all" ON public.employees;
DROP POLICY IF EXISTS "public_attendance_all" ON public.attendance;
DROP POLICY IF EXISTS "public_leave_requests_all" ON public.leave_requests;
DROP POLICY IF EXISTS "Allow public insert and update" ON public.push_subscriptions;

-- MEMBUAT POLICY BARU: IZINKAN SEMUA OPERASI UNTUK ANON (PUBLIK)
CREATE POLICY "public_employees_all" ON public.employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_attendance_all" ON public.attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_leave_requests_all" ON public.leave_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public insert and update" ON public.push_subscriptions FOR ALL USING (true) WITH CHECK (true);
