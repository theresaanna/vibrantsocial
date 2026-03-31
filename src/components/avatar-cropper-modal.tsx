"use client";

import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import Cropper from "react-easy-crop";
import { useModal } from "@/hooks/use-modal";
import type { Area } from "react-easy-crop";

interface AvatarCropperModalProps {
  file: File;
  onSave: (blob: Blob) => void;
  onCancel: () => void;
  uploading: boolean;
}

async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: Area
): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob failed"));
      },
      "image/jpeg",
      0.95
    );
  });
}

export function AvatarCropperModal({
  file,
  onSave,
  onCancel,
  uploading,
}: AvatarCropperModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useModal(true, onCancel, { enabled: !uploading });

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleSave = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      onSave(blob);
    } catch {
      // Fall back to uploading the original file as-is
      const blob = new Blob([await file.arrayBuffer()], { type: file.type });
      onSave(blob);
    }
  }, [imageSrc, croppedAreaPixels, onSave, file]);

  if (!imageSrc) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget && !uploading) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Crop Photo
          </h2>
          <button
            onClick={onCancel}
            disabled={uploading}
            className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Crop area */}
        <div className="relative mx-auto h-72 w-72 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Zoom slider */}
        <div className="mt-4 flex items-center gap-3 px-2">
          <svg className="h-4 w-4 shrink-0 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM13.5 10.5h-6" />
          </svg>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-fuchsia-500 dark:bg-zinc-700"
          />
          <svg className="h-4 w-4 shrink-0 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
          </svg>
        </div>

        {/* Actions */}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={uploading}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={uploading}
            className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-fuchsia-500 hover:to-blue-500 disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
