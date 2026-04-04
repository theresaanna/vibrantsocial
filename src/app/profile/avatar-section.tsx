"use client";

import { useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { removeAvatar } from "./actions";
import { FrameSelector } from "@/components/frame-selector";
import { PremiumCrown } from "@/components/premium-crown";
import { FramedAvatar } from "@/components/framed-avatar";
import { AvatarCropperModal } from "@/components/avatar-cropper-modal";

interface AvatarSectionProps {
  currentAvatar: string | null;
  oauthImage: string | null;
  initialFrameId: string | null;
  displayName: string;
  isPremium: boolean;
  userEmail: string | null;
  onFrameChange: (frameId: string | null) => void;
}

export function AvatarSection({
  currentAvatar,
  oauthImage,
  initialFrameId,
  displayName,
  isPremium,
  userEmail,
  onFrameChange,
}: AvatarSectionProps) {
  const { update } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(currentAvatar);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [frameId, setFrameId] = useState<string | null>(initialFrameId);
  const [showFrameSelector, setShowFrameSelector] = useState(false);

  const displayedAvatar = avatarPreview || oauthImage;
  const initial = displayName[0]?.toUpperCase() ?? "?";

  const handleAvatarUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setAvatarError("File must be JPEG, PNG, GIF, or WebP");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setAvatarError("File must be under 10MB");
      return;
    }

    setCropFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleCroppedAvatar = useCallback(async (blob: Blob) => {
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const formData = new FormData();
      formData.append("file", blob, "avatar.jpg");
      const res = await fetch("/api/avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setAvatarError(data.error || "Upload failed");
        return;
      }
      setAvatarPreview(data.url);
      await update({ user: { avatar: data.url } });
    } catch {
      setAvatarError("Upload failed. Please try again.");
    } finally {
      setAvatarUploading(false);
      setCropFile(null);
    }
  }, [update]);

  const handleRemoveAvatar = useCallback(async () => {
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      await removeAvatar();
      setAvatarPreview(null);
      await update({ user: { avatar: null } });
    } catch {
      setAvatarError("Failed to remove avatar");
    } finally {
      setAvatarUploading(false);
    }
  }, [update]);

  const handleFrameSelect = useCallback((id: string | null) => {
    setFrameId(id);
    onFrameChange(id);
  }, [onFrameChange]);

  return (
    <>
      <div className="flex items-center gap-4">
        <FramedAvatar
          src={displayedAvatar}
          initial={initial}
          size={80}
          frameId={frameId}
          referrerPolicy="no-referrer"
        />

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={`cursor-pointer rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 ${
                avatarUploading ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {avatarUploading ? "Uploading..." : "Upload Photo"}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={avatarUploading}
              />
            </label>

            {avatarPreview && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={avatarUploading}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                Remove
              </button>
            )}
            <span className="relative">
              <button
                type="button"
                onClick={() => setShowFrameSelector(true)}
                disabled={!isPremium}
                className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                data-testid="choose-frame-button"
              >
                {frameId ? "Change Frame" : "Add Frame"}
              </button>
              <PremiumCrown href="/premium" />
            </span>
          </div>

          {avatarError && (
            <p className="text-xs text-red-600">{avatarError}</p>
          )}
          <p className="text-xs text-zinc-400">JPEG, PNG, GIF, or WebP. Max 10MB.</p>
        </div>
      </div>

      {showFrameSelector && (
        <FrameSelector
          currentFrameId={frameId}
          avatarSrc={displayedAvatar}
          initial={initial}
          isPremium={isPremium}
          userEmail={userEmail}
          onSelect={(id) => { handleFrameSelect(id); }}
          onClose={() => setShowFrameSelector(false)}
        />
      )}

      {cropFile && (
        <AvatarCropperModal
          file={cropFile}
          onSave={handleCroppedAvatar}
          onCancel={() => setCropFile(null)}
          uploading={avatarUploading}
        />
      )}
    </>
  );
}
