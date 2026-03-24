"use client";

import { useState } from "react";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    setResetToken(null);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const errorMsg = typeof errBody.error === "string" ? errBody.error : "Request failed";
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setMessage(data.message);
      setResetToken(data.resetToken || null);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request password reset");
    } finally {
      setLoading(false);
    }
  };

  if (resetToken) {
    return (
      <div className="w-full rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-[0_6px_22px_rgba(0,0,0,0.05)]">
        <div className="rounded-md border border-green-300 bg-green-50 p-4">
          <p className="text-sm font-semibold text-green-700">Reset link generated!</p>
          <p className="mt-2 text-xs text-green-600">
            In development mode, use this token:
          </p>
          <code className="mt-2 block break-all rounded-lg bg-green-100 p-2 font-mono text-xs text-green-700">
            {resetToken}
          </code>
          <p className="mt-3 text-xs text-green-600">
            Copy this token and visit: <code className="font-mono">/reset-password/[token]</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full"
    >
      <h3 className="mb-4 text-2xl font-semibold text-[#121521]">Request password reset</h3>

      <div className="mb-4">
        <input
          type="email"
          placeholder="Username or email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-md border border-[#d9dde5] bg-[#f5f7fa] px-3 py-2.5 text-sm text-[#111827] outline-none focus:border-[#a5afc0]"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !email}
        className="w-full rounded-full bg-[var(--accent)] px-4 py-2.5 font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
      >
        {loading ? "Sending..." : "Send Reset Link"}
      </button>

      {message && <div className="mt-3 rounded-md border border-green-300 bg-green-50 p-2 text-sm text-green-700">{message}</div>}
      {error && <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">{error}</div>}
    </form>
  );
}
