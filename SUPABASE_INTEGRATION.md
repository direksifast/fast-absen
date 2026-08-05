# Panduan Integrasi Supabase

Dokumen ini berisi panduan dan referensi struktur *database* yang dibutuhkan untuk menghubungkan aplikasi FAST ABSEN dengan Supabase.
Saat ini, aplikasi sudah direstrukturisasi ke dalam folder `src/services`, `src/features`, dan `src/types` sehingga integrasi hanya perlu mengganti logika di `src/services/api.ts`.

## 1. Persiapan Project Supabase
1. Buat project baru di [Supabase](https://supabase.com/).
2. Dapatkan **URL** dan **Anon Key** dari menu `Settings > API`.
3. Instal *Supabase Client* di aplikasi ini:
   ```bash
   npm install @supabase/supabase-js
   ```
4. Buat file `.env.local` di root project dan masukkan kodenya:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

## 2. Struktur Tabel Database (SQL)

Jalankan perintah SQL berikut di menu `SQL Editor` pada *dashboard* Supabase Anda.

### Tabel `employees`
```sql
CREATE TABLE public.employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    position TEXT NOT NULL,
    initials TEXT NOT NULL,
    color TEXT NOT NULL,
    pin TEXT,
    face_descriptor JSONB,
    face_photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Jalankan baris ini jika tabel employees sudah ada sebelumnya:
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS face_descriptor JSONB;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS face_photo_url TEXT;
```

### Tabel `attendance`
```sql
CREATE TABLE public.attendance (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES public.employees(id),
    date DATE NOT NULL,
    check_in TIME WITHOUT TIME ZONE,
    check_out TIME WITHOUT TIME ZONE,
    lembur_in TIME WITHOUT TIME ZONE,
    lembur_out TIME WITHOUT TIME ZONE,
    photo_check_in TEXT,
    photo_check_out TEXT,
    photo_lembur_in TEXT,
    photo_lembur_out TEXT,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Tabel `leave_requests`
```sql
CREATE TABLE public.leave_requests (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES public.employees(id),
    type TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Tabel `push_subscriptions` (Untuk Notifikasi HP Background)
```sql
CREATE TABLE public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Atur RLS / Izin Akses Publik jika diperlukan
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert and update" ON public.push_subscriptions
    FOR ALL USING (true) WITH CHECK (true);
```


## 3. Storage untuk Foto Absen
1. Buka menu **Storage** di Supabase.
2. Buat bucket baru bernama `attendance_photos`.
3. Set *Bucket* tersebut menjadi **Public** agar URL fotonya bisa langsung ditampilkan di aplikasi.
4. (Opsional) Buat *Security Policy* untuk mengizinkan insert dan select.

## 4. Mengubah `src/services/api.ts`
Setelah database siap, modifikasi file `src/services/api.ts` agar tidak lagi menggunakan `localStorage`, melainkan menggunakan Supabase Client.

Contoh inisialisasi:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseKey);
```

Contoh Upload Foto:
```typescript
uploadPhoto: async (base64Data: string, path: string): Promise<string> => {
  const res = await fetch(base64Data);
  const blob = await res.blob();
  
  const { data, error } = await supabase.storage
    .from('attendance_photos')
    .upload(path, blob, { upsert: true });

  if (error) throw error;
  
  const { data: publicUrlData } = supabase.storage
    .from('attendance_photos')
    .getPublicUrl(path);

  return publicUrlData.publicUrl;
}
```

## 5. Autentikasi Admin (Opsional)
Saat ini admin login masih *hardcoded* (`admin123`). Untuk keamanan ekstra, Anda bisa mengaktifkan *Email Auth* di Supabase dan membuat user khusus admin, lalu menghubungkannya di halaman `AdminLogin.tsx`.
