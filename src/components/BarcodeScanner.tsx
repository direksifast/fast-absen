import { useState, useEffect, useRef, useCallback } from "react";
import * as faceapi from "face-api.js";
import jsQR from "jsqr";
import { Camera, CameraOff, X, AlertTriangle, QrCode, Scan, ScanFace, Eye, Upload } from "lucide-react";
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
  const [locating, setLocating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadScanData, setUploadScanData] = useState<{ imageSrc: string, val: string, photo: string, locData: LocationData | null } | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        
        // Resize to prevent jsQR from crashing on huge images
        let width = img.width;
        let height = img.height;
        const maxDim = 1000;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = (height / width) * maxDim;
            width = maxDim;
          } else {
            width = (width / height) * maxDim;
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code) {
          const val = code.data;
          if (employees.find((emp) => emp.id === val)) {
            if (targetEmployeeId && val !== targetEmployeeId) {
              setError(`QR Code tidak cocok! Scan QR Code milik Anda sendiri (${targetEmployeeId}).`);
            } else {
              setError("");
              setLocating(true);
              let locData = currentLocation;
              
              if (!locData) {
                try {
                  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                      enableHighAccuracy: true,
                      timeout: 10000,
                      maximumAge: 0
                    });
                  });
                  locData = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                  setCurrentLocation(locData);
                } catch (geoErr) {
                  setError("Gagal mendapatkan lokasi GPS. Pastikan akses lokasi diizinkan.");
                  setLocating(false);
                  return;
                }
              }
              
              setLocating(false);
              const photo = e.target?.result as string;
              
              setUploadScanData({ imageSrc: photo, val, photo, locData });
              setTimeout(() => {
                setUploadScanData(null);
                onScan(val, photo, locData);
              }, 3000);
            }
          } else {
            setError("QR Code tidak valid atau karyawan tidak ditemukan.");
          }
        } else {
          setError("Gagal membaca QR Code dari gambar. Pastikan gambar jelas dan tidak blur.");
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
    setLocating(true);
    try {
      // Wajibkan GPS dengan akurasi tinggi
      let pos: GeolocationPosition;
      try {
        pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("Browser tidak mendukung GPS."));
            return;
          }

          let bestPos: GeolocationPosition | null = null;
          let watchId: number;

          const timeoutId = setTimeout(() => {
            if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
            if (bestPos) {
              resolve(bestPos);
            } else {
              reject(new Error("Waktu tunggu GPS habis."));
            }
          }, 30000); // Tunggu maksimal 30 detik

          watchId = navigator.geolocation.watchPosition(
            (position) => {
              if (!bestPos || position.coords.accuracy < bestPos.coords.accuracy) {
                bestPos = position;
              }
              // Jika akurasi cukup baik (<= 25 meter), langsung gunakan
              if (position.coords.accuracy <= 25) {
                clearTimeout(timeoutId);
                navigator.geolocation.clearWatch(watchId);
                resolve(position);
              }
            },
            (error) => {
              if (!bestPos) {
                clearTimeout(timeoutId);
                if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
                reject(error);
              }
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            }
          );
        });
      } catch (geoErr: any) {
        throw new Error("Gagal mendapatkan lokasi GPS akurat. Pastikan akses lokasi diizinkan dan Anda berada di area terbuka.");
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
        setError(`${msg}`);
      }
    } finally {
      setLocating(false);
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
          {/* Face scan animation overlay when searching but no face found yet */}
          {scanning && scanMode === "face" && !faceBox && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
              <div className="w-[60%] aspect-[3/4] max-w-sm rounded-[100px] border border-emerald-500/30 shadow-[inset_0_0_50px_rgba(16,185,129,0.2)] flex items-center justify-center relative overflow-hidden">
                {/* Laser Scanner */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_20px_2px_rgba(52,211,153,0.8)] animate-[scan-vertical_2s_linear_infinite]" />
                <div className="absolute inset-0 border-2 border-dashed border-emerald-500/20 rounded-[100px] animate-[spin_10s_linear_infinite]" />
                <div className="text-emerald-500/50 flex flex-col items-center gap-2">
                   <ScanFace className="w-12 h-12 opacity-50 animate-pulse" />
                   <span className="text-xs font-bold tracking-widest uppercase opacity-70">Arahkan Wajah</span>
                </div>
              </div>
            </div>
          )}

          {scanning && scanMode === "face" && faceBox && (
            <div 
              className={`absolute transition-all duration-300 ease-out flex flex-col items-center pointer-events-none`}
              style={{ left: faceBox.x, top: faceBox.y, width: faceBox.width, height: faceBox.height }}
            >
              {/* Corner brackets */}
              <div className={`absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 rounded-tl-xl transition-colors duration-300 ${faceStatus === "green" ? "border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]" : "border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"}`} />
              <div className={`absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 rounded-tr-xl transition-colors duration-300 ${faceStatus === "green" ? "border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]" : "border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"}`} />
              <div className={`absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 rounded-bl-xl transition-colors duration-300 ${faceStatus === "green" ? "border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]" : "border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"}`} />
              <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 rounded-br-xl transition-colors duration-300 ${faceStatus === "green" ? "border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]" : "border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"}`} />
              
              {/* Grid Overlay */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:10px_10px] pointer-events-none rounded-xl overflow-hidden" />

              {/* Scanning Laser inside box */}
              {faceStatus !== "green" && (
                <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                  <div className={`absolute top-0 left-0 right-0 h-1 shadow-[0_0_20px_5px_rgba(16,185,129,0.8)] animate-[scan-vertical_1.5s_linear_infinite] pointer-events-none bg-emerald-400`}>
                     <div className={`absolute top-0 left-0 right-0 h-16 bg-gradient-to-t to-transparent -translate-y-full from-emerald-500/30`} />
                  </div>
                </div>
              )}

              {/* Target Reticle (Center) */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8">
                 <div className={`absolute inset-0 border-2 rounded-full animate-ping ${faceStatus === "green" ? "border-green-500/80" : "border-emerald-500/80"}`} />
                 <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${faceStatus === "green" ? "bg-green-500" : "bg-emerald-500"}`} />
              </div>

              {/* Box Border Background */}
              <div className={`absolute inset-0 border border-white/20 transition-colors duration-300 rounded-xl ${faceStatus === "green" ? "border-green-500/50 bg-green-500/10" : "border-emerald-500/50 bg-emerald-500/5"}`} />

              {/* Status Badge */}
              <div className={`absolute -bottom-12 px-5 py-2 rounded-full text-sm font-bold text-white shadow-[0_0_20px_rgba(0,0,0,0.5)] whitespace-nowrap transition-all duration-300 flex items-center gap-2 ${faceStatus === "green" ? "bg-green-500 scale-110 shadow-[0_0_20px_rgba(34,197,94,0.6)]" : "bg-black/80 border border-emerald-500/50 text-emerald-400 backdrop-blur-md"}`}>
                {faceStatus === "green" ? (
                  <>
                    <ScanFace className="w-4 h-4" /> Wajah Cocok!
                  </>
                ) : (
                  <>
                    <Scan className="w-4 h-4 animate-spin" /> Menganalisis...
                  </>
                )}
              </div>
            </div>
          )}

          {uploadScanData && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
              <div className="relative w-[80%] aspect-square max-w-sm flex items-center justify-center p-3 animate-in zoom-in duration-500">
                {/* 4 Corner brackets */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-lg shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                
                {/* Image & Scanner */}
                <div className="relative w-full h-full rounded-xl overflow-hidden bg-black shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                  <img src={uploadScanData.imageSrc} alt="Uploaded QR" className="w-full h-full object-cover opacity-70 scale-105" />
                  
                  {/* Grid Overlay for cyber feel */}
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.15)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
                  
                  {/* Laser Scanner */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_20px_5px_rgba(52,211,153,1)] animate-[scan-vertical_2s_linear_infinite] pointer-events-none">
                     <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-t from-emerald-500/50 to-transparent -translate-y-full" />
                  </div>
                </div>

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 text-emerald-400 border border-emerald-500/50 px-6 py-3 rounded-full text-sm font-bold backdrop-blur-md whitespace-nowrap flex items-center gap-3 shadow-[0_0_30px_rgba(52,211,153,0.4)]">
                  <Scan className="w-5 h-5 animate-pulse" />
                  Menganalisis QR...
                </div>
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
          @keyframes scan-vertical {
            0%   { top: 0%; opacity: 0; }
            5%   { opacity: 1; }
            95%  { top: 100%; opacity: 1; }
            100% { top: 100%; opacity: 0; }
          }
        `}</style>

        {error && (
          <div className="flex items-start gap-2 bg-amber-50 text-amber-700 rounded-xl p-3 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          {!active ? (
            <>
              <button
                onClick={startCamera}
                disabled={disabled || locating}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {locating ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Mencari Lokasi GPS...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" /> Kamera
                  </>
                )}
              </button>
              
              {scanMode === "qr" && (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled || locating}
                    className="w-full flex items-center justify-center gap-2 bg-muted text-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-muted/80 disabled:opacity-50 transition-colors border border-border"
                  >
                    <Upload className="w-4 h-4" /> Upload QR
                  </button>
                </>
              )}
            </>
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
