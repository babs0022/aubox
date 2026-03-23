"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type AuthFormProps = {
  mode: "signup" | "signin";
  allowModeSwitch?: boolean;
};

export default function AuthForm({ mode, allowModeSwitch = false }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [action, setAction] = useState<"signup" | "signin">(mode);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usernameCheckLoading, setUsernameCheckLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameCheckError, setUsernameCheckError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Debounced username availability check
  useEffect(() => {
    if (action !== "signup" || !username) {
      setUsernameAvailable(null);
      setUsernameCheckError(null);
      return;
    }

    // Validate pattern first
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameCheckError("Letters, numbers, and underscores only");
      setUsernameAvailable(null);
      return;
    }

    if (username.length < 3 || username.length > 24) {
      setUsernameCheckError("3-24 characters required");
      setUsernameAvailable(null);
      return;
    }

    setUsernameCheckError(null);
    setUsernameCheckLoading(true);

    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/auth/check-username", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          const message = typeof errBody.error === "string" ? errBody.error : "Check failed";
          setUsernameCheckError(message);
          setUsernameAvailable(null);
          return;
        }

        const data = await response.json();
        setUsernameAvailable(data.available);
        if (!data.available) {
          setUsernameCheckError("Already taken");
        } else {
          setUsernameCheckError(null);
        }
      } catch (err) {
        setUsernameCheckError("Error checking availability");
        setUsernameAvailable(null);
      } finally {
        setUsernameCheckLoading(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [username, action]);

  const passwordRequirements = {
    minLength: password.length >= 8,
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    // Validate username availability for signup
    if (action === "signup") {
      if (!usernameAvailable) {
        setError(usernameCheckError || "Username is not available");
        setLoading(false);
        return;
      }
    }

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          username: action === "signup" ? username : undefined,
          name: action === "signup" ? name : undefined,
          action,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const message = typeof errBody.error === "string" ? errBody.error : `Auth failed: ${response.status}`;
        throw new Error(message);
      }

      const data = await response.json();
      setMessage(data.message);
      setEmail("");
      setPassword("");
      setUsername("");
      setName("");

      if (action === "signin") {
        router.push("/dashboard");
        return;
      }

      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleAuth}
      className="mx-auto w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6"
    >
      <h3 className="mb-4 text-xl font-bold">
        {action === "signup" ? "Create Account" : "Sign In"}
      </h3>

      {allowModeSwitch ? (
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setAction("signin")}
            className={`flex-1 rounded-lg px-3 py-2 font-semibold ${
              action === "signin"
                ? "bg-[var(--accent)] text-white"
                : "border border-[var(--line)] bg-white"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setAction("signup")}
            className={`flex-1 rounded-lg px-3 py-2 font-semibold ${
              action === "signup"
                ? "bg-[var(--accent)] text-white"
                : "border border-[var(--line)] bg-white"
            }`}
          >
            Sign Up
          </button>
        </div>
      ) : null}

      <div className="mb-4 flex flex-col gap-3">
        {action === "signup" && (
          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Username (letters, numbers, _)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                pattern="^[a-zA-Z0-9_]+$"
                minLength={3}
                maxLength={24}
                className="flex-1 rounded-lg border border-[var(--line)] bg-white px-3 py-2"
              />
              {usernameCheckLoading && (
                <span className="text-xs text-[var(--muted)]">Checking...</span>
              )}
              {!usernameCheckLoading && usernameAvailable === true && (
                <span className="text-xs font-semibold text-green-600">✓ Available</span>
              )}
              {!usernameCheckLoading && usernameAvailable === false && (
                <span className="text-xs font-semibold text-red-600">✗ Taken</span>
              )}
            </div>
            {usernameCheckError && usernameAvailable !== true && (
              <p className="mt-1 text-xs text-red-600">{usernameCheckError}</p>
            )}
          </div>
        )}
        {action === "signup" && (
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="rounded-lg border border-[var(--line)] bg-white px-3 py-2"
          />
        )}
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2"
        />
        <div>
          <div className="flex items-center gap-2">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password (min 8 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="flex-1 rounded-lg border border-[var(--line)] bg-white px-3 py-2"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[var(--muted)] hover:bg-[var(--paper)]"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "👁️‍🗨️" : "👁️"}
            </button>
          </div>
          {action === "signup" && password && (
            <div className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
              <p className="text-xs font-semibold text-[var(--muted)]">Password requirements:</p>
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
        disabled={loading || (action === "signup" && (usernameAvailable !== true || usernameCheckLoading)) || !password.length}
        className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
      >
        {loading ? "Processing..." : action === "signup" ? "Create Account" : "Sign In"}
      </button>

      {message && <div className="mt-3 rounded-lg border border-green-300 bg-green-50 p-2 text-sm text-green-700">{message}</div>}
      {error && <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">{error}</div>}
    </form>
  );
}
