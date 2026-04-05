"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

interface UserProfile {
  id: string;
  email: string;
  username?: string;
  name?: string;
  profileIcon?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [profileIcon, setProfileIcon] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch("/api/profile/user");
        if (!response.ok) {
          throw new Error("Failed to load profile");
        }
        const data = await response.json();
        setProfile(data);
        setName(data.name || "");
        setProfileIcon(data.profileIcon || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("Only JPG, PNG, and WebP images are allowed");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be 5MB or less");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/onboarding/upload-profile-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to upload image");
      }

      const data = await response.json();
      setProfileIcon(data.profileImageUrl);
      setMessage("Image uploaded successfully! Click Save Profile to apply changes.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/profile/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, profileIcon }),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      const data = await response.json();
      setProfile(data);
      setMessage("Profile updated successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--line)] border-t-[var(--accent)]"></div>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link
          href="/guide"
          className="dash-frame-soft mb-4 inline-block px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] hover:border-[var(--accent)]"
        >
          Open Guide
        </Link>
        <h1 className="mb-8 text-3xl font-bold">Profile</h1>

        <div className="dash-frame p-8">
          {/* Avatar Section */}
          <div className="mb-8 text-center">
        {profileIcon ? (
              <Image
                src={profileIcon}
                alt="Profile"
                width={128}
                height={128}
                unoptimized
                className="mx-auto mb-4 h-32 w-32 rounded-full border-4 border-[var(--accent)]"
              />
            ) : (
              <div className="mx-auto mb-4 flex h-32 w-32 items-center justify-center rounded-full border-4 border-[var(--accent)] bg-[var(--accent)] text-3xl font-bold text-white">
                {profile && (profile.name || profile.email || "U")
                  ? (profile.name || profile.email || "U")
                      .toString()
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase()
                  : "U"}
              </div>
            )}
            <p className="text-sm text-[var(--text-secondary)]">Profile Picture</p>
          </div>

          {/* File Upload */}
          <div className="mb-8 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
              aria-label="Upload profile picture"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-block rounded-lg border border-[var(--accent)] bg-[var(--paper)] px-4 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload Photo"}
            </button>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">JPG, PNG, or WebP • Max 5MB</p>
          </div>

          {/* Avatar Color Presets */}
          <div className="mb-8 space-y-2">
            <p className="text-sm font-semibold">Quick Avatar Colors:</p>
            <div className="flex flex-wrap gap-2">
              {["#0a6e5d", "#2563eb", "#dc2626", "#9333ea", "#f59e0b", "#10b981"].map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    if (!profile) return;
                    const initials = (profile.name || profile.email || "U")
                      .toString()
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase();
                    const bgColor = color.replace("#", "");
                    const avatarUrl = `https://ui-avatars.com/api/?name=${initials}&background=${bgColor}&color=fff&bold=true&size=128`;
                    setProfileIcon(avatarUrl);
                  }}
                  className="h-10 w-10 rounded-full border-2 border-[var(--line)] hover:border-[var(--accent)]"
                  style={{ backgroundColor: color }}
                  title="Click to generate avatar with this color"
                />
              ))}
            </div>
          </div>

          {/* Profile Form */}
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold mb-2">Email</label>
              <input
                type="email"
                value={profile?.email || ""}
                disabled
                className="w-full rounded-lg border border-[var(--line)] bg-white px-4 py-2 text-[var(--text-secondary)] cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-[var(--text-secondary)]">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full rounded-lg border border-[var(--line)] bg-white px-4 py-2 focus:border-[var(--accent)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Avatar (Optional - Upload or URL)</label>
              <input
                type="url"
                value={profileIcon}
                onChange={(e) => setProfileIcon(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="w-full rounded-lg border border-[var(--line)] bg-white px-4 py-2 focus:border-[var(--accent)] focus:outline-none"
              />
              <p className="mt-1 text-xs text-[var(--text-secondary)]">Or paste a direct image URL, or use the color buttons below</p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="flex-1 rounded-lg border border-[var(--line)] px-4 py-2 font-semibold hover:bg-[var(--paper-hover)]"
              >
                Back
              </button>
            </div>
          </form>

          {message && (
            <div className="mt-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-700">
              ✓ {message}
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              ✗ {error}
            </div>
          )}
        </div>

        {/* Account Info */}
        <div className="dash-frame mt-8 p-6">
          <h2 className="mb-4 text-lg font-semibold">Account Information</h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-[var(--text-secondary)]">Account ID:</span>
              <span className="ml-2 font-mono">{profile?.id}</span>
            </div>
            <div>
              <span className="text-[var(--text-secondary)]">Email:</span>
              <span className="ml-2">{profile?.email}</span>
            </div>
            <div>
              <span className="text-[var(--text-secondary)]">Username:</span>
              <span className="ml-2">@{profile?.username || "(not set)"}</span>
            </div>
            <div>
              <span className="text-[var(--text-secondary)]">Name:</span>
              <span className="ml-2">{profile?.name || "(not set)"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
