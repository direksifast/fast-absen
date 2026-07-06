import { useState, useEffect, useRef, useCallback } from "react";
import * as faceapi from "face-api.js";
import jsQR from "jsqr";
import { Camera, CameraOff, X, AlertTriangle, QrCode, Scan, ScanFace, Eye } from "lucide-react";
import { Employee, LocationData } from "../types";

export function BarcodeScanner({
  onScan,
  disabled,
  employees,
  targetEmployeeId,
  forceMode,
  title,
}: {
  onScan: (employeeId: string, photoData?: string, location?: LocationData) => void;
  disabled?: boolean;
  employees: Employee[];
  targetEmployeeId?: string;
  forceMode?: "qr" | "face";
  title?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectingRef = useRef(false);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMode, setScanMode] = useState<"qr" | "face">(forceMode || "qr");
  const [faceStatus, setFaceStatus] = useState<"idle" | "red" | "green">("idle");
  const [faceBox, setFaceBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const faceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);

  const capturePhoto = useCallback((): string | undefined => {
    if (!videoRef.current) return undefined;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return undefined;
      
      if (scanMode === "face") {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.5);
    } catch (e) {
      return undefined;
    }
  }, [scanMode]);

  const stopCamera = useCallback(() => {
    detectingRef.current = false;
    if (faceTimeoutRef.current) clearTimeout(faceTimeoutRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setScanning(false);
    setFaceStatus("idle");
    setFaceBox(null);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      // Wajibkan GPS
      let pos: GeolocationPosition;
      try {
        pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("Browser tidak mendukung GPS."));
          } else {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            });
          }
        });
      } catch (geoErr: any) {
        throw new Error("Akses lokasi (GPS) wajib diaktifkan untuk absen.");
      }
      
      const locData: LocationData = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCurrentLocation(locData);

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: scanMode === "qr" ? "environment" : "user" },
        });
      } catch (fallbackErr) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      detectingRef.current = true;
      setScanning(true);

      if (scanMode === "qr") {
        const loop = () => {
          if (!detectingRef.current || !videoRef.current) return;
          try {
            const video = videoRef.current;
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
              const cropSize = Math.min(video.videoWidth, video.videoHeight) * 0.6;
              const cropX = (video.videoWidth - cropSize) / 2;
              const cropY = (video.videoHeight - cropSize) / 2;
              
              const canvas = document.createElement("canvas");
              canvas.width = cropSize;
              canvas.height = cropSize;
              const ctx = canvas.getContext("2d", { willReadFrequently: true });
              if (ctx) {
                // Hanya menggambar bagian tengah video ke canvas
                ctx.drawImage(video, cropX, cropY, cropSize, cropSize, 0, 0, cropSize, cropSize);
                const imageData = ctx.getImageData(0, 0, cropSize, cropSize);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                  inversionAttempts: "dontInvert",
                });
                
                if (code) {
                  const val = code.data;
                  if (employees.find((e) => e.id === val)) {
                    if (targetEmployeeId && val !== targetEmployeeId) {
                      setError(`QR Code tidak cocok! Scan QR Code milik Anda sendiri (${targetEmployeeId}).`);
                    } else {
                      setError("");
                      const photo = capturePhoto();
                      stopCamera();
                      onScan(val, photo, locData);
                      return;
                    }
                  }
                }
              }
            }
          } catch {}
          if (detectingRef.current) requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      } else {
        try {
          await faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights');
        } catch (err) {
          setError("Gagal memuat model pendeteksi wajah. Pastikan koneksi internet stabil.");
          return;
        }

        let consistentFrames = 0;
        let isScanned = false;
        
        const loop = async () => {
          if (!detectingRef.current || !videoRef.current || isScanned) return;
          try {
            const detection = await faceapi.detectSingleFace(
              videoRef.current, 
              new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
            );
            
            if (detection && videoRef.current.videoWidth > 0) {
              const displaySize = { width: videoRef.current.clientWidth, height: videoRef.current.clientHeight };
              const resized = faceapi.resizeResults(detection, displaySize);
              
              const mirroredX = displaySize.width - resized.box.x - resized.box.width;
              
              setFaceBox({ x: mirroredX, y: resized.box.y, width: resized.box.width, height: resized.box.height });
              
              consistentFrames++;
              if (consistentFrames > 3 && consistentFrames <= 7) {
                setFaceStatus("red");
              } else if (consistentFrames > 7) {
                setFaceStatus("green");
                if (consistentFrames === 12) {
                   isScanned = true;
                   detectingRef.current = false;
                   setScanning(false);
                   if (!targetEmployeeId) {
                     setError("Wajib pilih nama karyawan terlebih dahulu sebelum Face Scan!");
                     stopCamera();
                     return;
                   }
                   const resultId = targetEmployeeId;
                   const photo = capturePhoto();
                   setTimeout(() => {
                     stopCamera();
                     onScan(resultId, photo, locData);
                   }, 500);
                }
              }
            } else {
              consistentFrames = 0;
              setFaceBox(null);
              setFaceStatus("idle");
            }
          } catch (e) {}
          if (detectingRef.current && !isScanned) requestAnimationFrame(loop);
        };
        loop();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (e instanceof Error && e.name === "NotAllowedError") {
        setError("Akses kamera ditolak. Izinkan kamera di pengaturan browser.");
      } else if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Kamera diblokir oleh browser. Pastikan URL diawali dengan 'https://' bukan 'http://'.");
      } else {
        setError(`Gagal mengakses kamera: ${msg}`);
      }
    }
  }, [onScan, scanMode, capturePhoto, employees, targetEmployeeId, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (active) {
      stopCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanMode]);

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <div className="flex items-center gap-3">
          <Scan className="w-5 h-5 text-primary" />
          <span className="font-semibold text-foreground">{title || "Scanner Absensi"}</span>
          {scanning && (
            <span className="ml-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Scanning…
            </span>
          )}
        </div>
        
        {!forceMode && (
          <div className="flex bg-muted p-1 rounded-xl">
          <button
            onClick={() => setScanMode("qr")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${scanMode === "qr" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <QrCode className="w-4 h-4" /> QR Code
          </button>
          <button
            onClick={() => setScanMode("face")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${scanMode === "face" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <ScanFace className="w-4 h-4" /> Face Scan
          </button>
        </div>
        )}
      </div>

      <div className="p-6 flex flex-col gap-4">
        {/* Video */}
        <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${active ? "opacity-100" : "opacity-0"} ${scanMode === "face" ? "-scale-x-100" : ""}`}
          />
          {!active && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <CameraOff className="w-12 h-12" />
              <span className="text-sm font-medium">Kamera tidak aktif</span>
            </div>
          )}
          {scanning && scanMode === "qr" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative overflow-hidden w-48 h-48 border-2 border-emerald-400 rounded-xl shadow-lg shadow-emerald-500/30">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-400 animate-[scan_2s_ease-in-out_infinite]" style={{ animation: "scan 2s ease-in-out infinite" }} />
              </div>
            </div>
          )}
          {scanning && scanMode === "face" && faceBox && (
            <div 
              className={`absolute border-4 rounded-xl transition-all duration-300 ease-out flex flex-col items-center pointer-events-none ${faceStatus === "green" ? "border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]" : "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]"}`}
              style={{ left: faceBox.x, top: faceBox.y, width: faceBox.width, height: faceBox.height }}
            >
              <div className={`absolute -bottom-10 px-4 py-1.5 rounded-full text-xs font-bold text-white shadow-lg whitespace-nowrap transition-colors duration-300 ${faceStatus === "green" ? "bg-green-500" : "bg-red-500"}`}>
                {faceStatus === "green" ? "Wajah Cocok!" : "Mendeteksi Wajah..."}
              </div>
            </div>
          )}
        </div>

        <style>{`
          @keyframes scan {
            0%   { transform: translateY(0); }
            50%  { transform: translateY(190px); }
            100% { transform: translateY(0); }
          }
        `}</style>

        {error && (
          <div className="flex items-start gap-2 bg-amber-50 text-amber-700 rounded-xl p-3 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-2">
          {!active ? (
            <button
              onClick={startCamera}
              disabled={disabled}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Camera className="w-4 h-4" /> Aktifkan Kamera
            </button>
          ) : (
            <button
              onClick={stopCamera}
              className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-700 border border-red-200 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors"
            >
              <CameraOff className="w-4 h-4" /> Matikan Kamera
            </button>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {scanMode === "qr" ? "Arahkan barcode karyawan ke kamera. Scanner otomatis mendeteksi." : "Posisikan wajah Anda di tengah layar kamera. Scanner otomatis mendeteksi."}
        </p>
      </div>
    </div>
  );
}
