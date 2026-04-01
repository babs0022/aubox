"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type AuthFormProps = {
  mode: "signup" | "signin";
  allowModeSwitch?: boolean;
  showTitle?: boolean;
  withCard?: boolean;
};

export default function AuthForm({
  mode,
  allowModeSwitch = false,
  showTitle = true,
  withCard = true,
}: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [action, setAction] = useState<"signup" | "signin">(mode);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const passwordRequirements = {
    minLength: password.length >= 8,
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: action === "signup" ? name : undefined,
          action,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        if (response.status === 403 && errBody.requiresAccessCode) {
          router.push("/onboarding/access-code");
          return;
        }
        const message = typeof errBody.error === "string" ? errBody.error : `Auth failed: ${response.status}`;
        throw new Error(message);
      }

      const data = await response.json();
      setMessage(data.message);
      setEmail("");
      setPassword("");
      setName("");

      if (action === "signin") {
        router.push("/");
        return;
      }

      router.push("/onboarding/access-code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const formBody = (
    <>
      {showTitle ? (
        <h3 className="mb-4 text-2xl font-semibold text-[#121521]">
          {action === "signup" ? "Sign up" : "Log in"}
        </h3>
      ) : null}

      {allowModeSwitch ? (
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setAction("signin")}
            className={`flex-1 px-3 py-2 font-semibold ${
              action === "signin"
                ? "bg-[var(--accent)] text-white"
                : "dash-frame-soft"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setAction("signup")}
            className={`flex-1 px-3 py-2 font-semibold ${
              action === "signup"
                ? "bg-[var(--accent)] text-white"
                : "dash-frame-soft"
            }`}
          >
            Sign Up
          </button>
        </div>
      ) : null}

      <div className="mb-4 flex flex-col gap-3">
        {action === "signup" && (
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
              className="dash-frame-soft px-3 py-2.5 text-sm text-[#111827] outline-none focus:border-[#a5afc0]"
          />
        )}
        <input
          type="email"
            placeholder="Username or email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
            className="dash-frame-soft px-3 py-2.5 text-sm text-[#111827] outline-none focus:border-[#a5afc0]"
        />
        <div>
          <div className="flex items-center gap-2">
            <input
              type={showPassword ? "text" : "password"}
                placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
                className="dash-frame-soft flex-1 px-3 py-2.5 text-sm text-[#111827] outline-none focus:border-[#a5afc0]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
                className="dash-frame-soft px-3 py-2 text-[#6b7280] hover:bg-[#f3f4f6]"
              title={showPassword ? "Hide password" : "Show password"}
            >
                {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {action === "signup" && password && (
              <div className="dash-frame-soft mt-2 p-3">
                <p className="text-xs font-semibold text-[#6b7280]">Password requirements:</p>
              <div className="mt-2 space-y-1">
                <p className={`text-xs ${passwordRequirements.minLength ? "text-green-600" : "text-red-600"}`}>
                  {passwordRequirements.minLength ? "✓" : "✗"} Minimum 8 characters
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !password.length}
        className="w-full border border-[var(--accent-strong)] bg-[var(--accent)] px-4 py-2.5 font-semibold uppercase tracking-[0.08em] text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
      >
        {loading ? "Processing..." : action === "signup" ? "Sign up" : "Log in"}
      </button>

      {message && <div className="mt-3 border border-green-300 bg-green-50 p-2 text-sm text-green-700">{message}</div>}
      {error && <div className="mt-3 border border-red-300 bg-red-50 p-2 text-sm text-red-700">{error}</div>}
    </>
  );

  return (
    <form
      onSubmit={handleAuth}
      className={withCard ? "dash-frame w-full p-6 shadow-[0_6px_22px_rgba(0,0,0,0.05)]" : "w-full"}
    >
      {formBody}
    </form>
  );
}
