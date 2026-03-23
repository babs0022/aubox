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
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6">
        <div className="rounded-lg border border-green-300 bg-green-50 p-4">
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
      className="mx-auto w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6"
    >
      <h3 className="mb-4 text-xl font-bold">Request Password Reset</h3>

      <div className="mb-4">
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !email}
        className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
      >
        {loading ? "Sending..." : "Send Reset Link"}
      </button>

      {message && <div className="mt-3 rounded-lg border border-green-300 bg-green-50 p-2 text-sm text-green-700">{message}</div>}
      {error && <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">{error}</div>}
    </form>
  );
}
