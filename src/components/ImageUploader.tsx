import React, { useMemo, useRef, useState, useEffect } from "react"
import { useI18n } from "../i18n"

interface Props {
  files: File[]
  onChange: (files: File[]) => void
  maxFiles?: number
  accept?: string
}

function formatSize(bytes: number): string {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function fileBadge(file: File): { label: string; color: string; bg: string; icon: string } {
  if (file.type.startsWith("image/")) {
    return {
      label: "PHOTO",
      color: "#93C5FD",
      bg: "rgba(37,99,235,0.18)",
      icon: "",
    }
  }
  if (file.type === "application/pdf") {
    return {
      label: "PDF",
      color: "#F87171",
      bg: "rgba(239,68,68,0.16)",
      icon: "📄",
    }
  }
  return {
    label: "DOC",
    color: "#FBBF24",
    bg: "rgba(245,158,11,0.16)",
    icon: "🗎",
  }
}

export default function ImageUploader({
  files,
  onChange,
  maxFiles = 6,
  accept = "image/*,application/pdf",
}: Props) {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const previewUrls = useMemo(() => {
    const urls = new Map<File, string>()
    for (const f of files) {
      if (f.type.startsWith("image/")) {
        urls.set(f, URL.createObjectURL(f))
      }
    }
    return urls
  }, [files])

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [previewUrls])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  const MAX_FILE_SIZE = 10 * 1024 * 1024

  const openFilePicker = () => inputRef.current?.click()

  const isAccepted = (file: File) =>
    file.type.startsWith("image/") || file.type === "application/pdf"

  const handleFiles = (selected: FileList | null) => {
    if (!selected) return
    const valid = Array.from(selected)
      .filter(isAccepted)
      .filter((file) => file.size > 0 && file.size <= MAX_FILE_SIZE)
      .slice(0, maxFiles - files.length)
    if (valid.length === 0) {
      alert(t("Fichier refusé. Formats autorisés : JPG, PNG, PDF — max 10 Mo par fichier."))
      return
    }
    onChange([...files, ...valid])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setShowCamera(true)
    } catch (err) {
      console.error("Camera access denied", err)
      alert(t("Impossible d'accéder à la caméra. Vérifiez les permissions."))
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setShowCamera(false)
  }

  const capturePhoto = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `photo_${Date.now()}.jpg`, {
          type: "image/jpeg",
        })
        onChange([...files, file])
        stopCamera()
      },
      "image/jpeg",
      0.9,
    )
  }

  const removeFile = (index: number) => {
    const copy = files.slice()
    copy.splice(index, 1)
    onChange(copy)
  }

  const atMax = files.length >= maxFiles

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div className="flex flex-wrap gap-3">
        {files.map((f, i) => {
          const badge = fileBadge(f)
          return (
            <div
              key={i}
              className="group relative h-32 w-32 overflow-hidden rounded-2xl"
              style={{
                background: "#1E2A42",
                border: "1px solid rgba(37,99,235,0.25)",
              }}
            >
              {f.type.startsWith("image/") ? (
                <img src={previewUrls.get(f)} alt={f.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-2">
                  <span className="text-3xl">{badge.icon}</span>
                  <span
                    className="line-clamp-2 text-center text-[10px] leading-tight"
                    style={{ color: "#94A3B8" }}
                  >
                    {f.name}
                  </span>
                </div>
              )}

              <span
                className="absolute left-2 top-2 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide"
                style={{ background: badge.bg, color: badge.color }}
              >
                {badge.label}
              </span>

              <button
                onClick={() => removeFile(i)}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-xs text-white"
                style={{
                  background: "rgba(0,0,0,0.55)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  backdropFilter: "blur(4px)",
                }}
                aria-label={t("Supprimer le fichier")}
              >
                ✕
              </button>

              <div
                className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 px-2 py-1"
                style={{
                  background: "rgba(0,0,0,0.6)",
                  backdropFilter: "blur(4px)",
                }}
              >
                <span className="truncate text-[10px] font-medium text-white">{f.name}</span>
                <span className="flex-shrink-0 text-[9px]" style={{ color: "#94A3B8" }}>
                  {formatSize(f.size)}
                </span>
              </div>
            </div>
          )
        })}

        {!atMax && (
          <>
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className="flex h-32 w-32 flex-col items-center justify-center gap-2 rounded-2xl"
              style={{
                background: "#1A2236",
                border: dragOver
                  ? "2px dashed rgba(59,130,246,0.7)"
                  : "2px dashed rgba(255,255,255,0.12)",
                transition: "all 150ms",
              }}
            >
              <button
                type="button"
                onClick={openFilePicker}
                className="flex flex-col items-center gap-2"
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ background: "rgba(37,99,235,0.15)" }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#93C5FD"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </span>
                <span className="text-xs font-medium" style={{ color: "#94A3B8" }}>
                  {t("Ajouter une image")}
                </span>
              </button>
            </div>
            <div
              className="flex h-32 w-32 flex-col items-center justify-center gap-2 rounded-2xl"
              style={{
                background: "#1A2236",
                border: "2px dashed rgba(255,255,255,0.12)",
                transition: "all 150ms",
                cursor: "pointer",
              }}
            >
              <button
                type="button"
                onClick={startCamera}
                className="flex flex-col items-center gap-2"
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ background: "rgba(5,150,105,0.15)" }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6EE7B7"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </span>
                <span className="text-xs font-medium" style={{ color: "#94A3B8" }}>
                  {t("Prendre une photo")}
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      {showCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#071127] rounded-2xl p-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-[min(320px,calc(100vw-32px))] h-56 bg-black rounded-md"
            />
            <div className="flex items-center gap-2 mt-3 justify-center">
              <button onClick={capturePhoto} className="px-4 py-2 rounded bg-[#059669] text-white">
                {t("Capturer")}
              </button>
              <button
                onClick={stopCamera}
                className="px-4 py-2 rounded bg-[#1E2A42] text-[#94A3B8]"
              >
                {t("Annuler")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
