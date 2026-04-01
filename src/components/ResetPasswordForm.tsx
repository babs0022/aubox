"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ResetPasswordFormProps = {
  token: string;
};

export default function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const passwordRequirements = {
    minLength: password.length >= 8,
  };

  const passwordMatch = password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (!passwordMatch) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const errorMsg = typeof errBody.error === "string" ? errBody.error : "Reset failed";
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setMessage(data.message);
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full"
    >
      <h3 className="mb-4 text-2xl font-semibold text-[var(--ink)]">Create new password</h3>

      <div className="mb-4 flex flex-col gap-3">
        <div>
          <div className="flex items-center gap-2">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="dash-frame-soft flex-1 px-3 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="dash-frame-soft px-3 py-2 text-[var(--muted)] hover:bg-[var(--panel)]"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {password && (
            <div className="dash-frame-soft mt-2 p-3">
              <p className="text-xs font-semibold text-[var(--muted)]">Password requirements:</p>
              <div className="mt-2 space-y-1">
                <p className={`text-xs ${passwordRequirements.minLength ? "text-green-600" : "text-red-600"}`}>
                  {passwordRequirements.minLength ? "✓" : "✗"} Minimum 8 characters
                </p>
              </div>
            </div>
          )}
        </div>

        <div>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            className="dash-frame-soft w-full px-3 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
          />
          {confirmPassword && (
            <p className={`mt-1 text-xs font-semibold ${passwordMatch ? "text-green-600" : "text-red-600"}`}>
              {passwordMatch ? "✓ Passwords match" : "✗ Passwords do not match"}
            </p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !password || !passwordMatch || !passwordRequirements.minLength}
        className="w-full border border-[var(--accent-strong)] bg-[var(--accent)] px-4 py-2.5 font-semibold uppercase tracking-[0.08em] text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
      >
        {loading ? "Resetting..." : "Reset Password"}
      </button>

      {message && (
        <div className="mt-3 border border-green-300 bg-green-50 p-2 text-sm text-green-700">
          {message}
          <p className="mt-1 text-xs">Redirecting to dashboard...</p>
        </div>
      )}
      {error && <div className="mt-3 border border-red-300 bg-red-50 p-2 text-sm text-red-700">{error}</div>}
    </form>
  );
}
