export function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

// Simulasi Server Time
export function getServerTime() {
  return new Date();
}

export function getNowTime() {
  const now = getServerTime();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function getCheckInStatus(timeStr: string): "hadir" | "terlambat" {
  const [h, m] = timeStr.split(":").map(Number);
  const totalMins = h * 60 + m;
  const limit = 9 * 60 + 15;
  return totalMins <= limit ? "hadir" : "terlambat";
}

export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 24) {
    return `${String(h % 24).padStart(2, "0")}:${String(m).padStart(2, "0")} (Besok)`;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function calculateDurationMins(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 0;
  const startMins = timeToMinutes(startStr);
  let endMins = timeToMinutes(endStr);
  if (endMins < startMins) {
    // cross midnight
    endMins += 24 * 60;
  }
  return endMins - startMins;
}

export function formatMinutesToDecimal(mins: number): string {
  // Return formatted with 2 decimal places max, e.g. 8.5 or 8.25
  return (mins / 60).toFixed(2).replace(/\.00$/, "");
}

export function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export async function fetchAddressFromCoordinates(lat: number, lng: number): Promise<string | undefined> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
    if (!res.ok) return undefined;
    const data = await res.json();
    if (data && data.address) {
      const { road, village, suburb, city_district, town, city, county, state } = data.address;
      // Compose a readable address
      const parts = [
        road,
        village || suburb,
        city_district || town || city || county,
        state
      ].filter(Boolean);
      if (parts.length > 0) {
        return parts.join(", ");
      }
      return data.display_name;
    }
  } catch (error) {
    console.error("Failed to fetch address:", error);
  }
  return undefined;
}
