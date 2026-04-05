"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

const X_POST_TEMPLATE =
  "Just unlocked @auboxapp and started my onchain investigation workspace. Built for investigators who want to move faster without losing control.";

const OTHER_OPTION = "__other__";

const howHeardOptions = [
  "X / Twitter",
  "Friend or colleague",
  "Discord",
  "YouTube",
  "Google search",
  "Newsletter",
  "Conference or event",
] as const;

const roleStatusOptions = [
  "Founder",
  "Analyst",
  "Trader",
  "Compliance",
  "Law enforcement",
  "Researcher",
  "Developer",
] as const;

const teamSizeOptions = ["Solo", "2-5", "6-10", "11-25", "26-100", "100+"] as const;

const regionOptions = [
  "North America",
  "Europe",
  "Asia",
  "Middle East",
  "Africa",
  "South America",
  "Oceania",
] as const;

const useCaseOptions = [
  "Fund flow tracing",
  "Wallet profiling",
  "Entity clustering",
  "Compliance investigations",
  "Incident response",
  "Reporting and evidence packs",
] as const;

type StepId =
  | "username"
  | "profileImage"
  | "howHeard"
  | "roleStatus"
  | "teamSize"
  | "region"
  | "useCase";

const onboardingSteps: Array<{ id: StepId; label: string; optional: boolean }> = [
  { id: "username", label: "Choose your username", optional: false },
  { id: "profileImage", label: "Upload profile image", optional: false },
  { id: "howHeard", label: "How did you hear about us?", optional: false },
  { id: "roleStatus", label: "Role / status", optional: false },
  { id: "teamSize", label: "Team size", optional: true },
  { id: "region", label: "Jurisdiction / region", optional: true },
  { id: "useCase", label: "Primary use case", optional: true },
];

const resolveSelectValue = (selected: string, otherValue: string): string => {
  if (!selected) return "";
  if (selected === OTHER_OPTION) return otherValue.trim();
  return selected;
};

const normalizeUsernameInput = (value: string): string => value.trim().toLowerCase();

const isUsernameFormatValid = (value: string): boolean => {
  const normalized = normalizeUsernameInput(value);
  return normalized.length >= 3 && normalized.length <= 24 && /^[a-zA-Z0-9_]+$/.test(normalized);
};

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid" | "error";

const AUBOX_LINK = "https://aubox.app";

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = src;
  });

const drawDitheredOverlay = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  ctx.save();
  for (let i = 0; i < 3200; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const alpha = 0.03 + Math.random() * 0.05;
    const size = Math.random() > 0.75 ? 2 : 1;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
};

const clipRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) => {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const fitSingleLineText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  suffix = "..."
): string => {
  if (ctx.measureText(text).width <= maxWidth) return text;

  let trimmed = text;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}${suffix}`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}${suffix}`;
};

const wrapTextIntoLines = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      lines.push(fitSingleLineText(ctx, word, maxWidth));
      currentLine = "";
    }

    if (lines.length >= maxLines) {
      return lines;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  if (lines.length > maxLines) {
    lines.length = maxLines;
  }

  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    lines[maxLines - 1] = fitSingleLineText(ctx, lines[maxLines - 1], maxWidth);
  }

  return lines;
};

export default function WelcomeOnboardingPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [localImagePreviewUrl, setLocalImagePreviewUrl] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [lastCheckedUsername, setLastCheckedUsername] = useState("");
  const [howHeardSelection, setHowHeardSelection] = useState("");
  const [howHeardOther, setHowHeardOther] = useState("");
  const [roleStatusSelection, setRoleStatusSelection] = useState("");
  const [roleStatusOther, setRoleStatusOther] = useState("");
  const [teamSizeSelection, setTeamSizeSelection] = useState("");
  const [teamSizeOther, setTeamSizeOther] = useState("");
  const [useCaseSelection, setUseCaseSelection] = useState("");
  const [useCaseOther, setUseCaseOther] = useState("");
  const [regionSelection, setRegionSelection] = useState("");
  const [regionOther, setRegionOther] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardReady, setCardReady] = useState(false);
  const [userNumber, setUserNumber] = useState<number | null>(null);
  const [cardPreviewDataUrl, setCardPreviewDataUrl] = useState("");
  const [generatingCardPreview, setGeneratingCardPreview] = useState(false);
  const usernameRequestIdRef = useRef(0);

  useEffect(() => {
    const checkStatus = async () => {
      const response = await fetch("/api/onboarding/status");
      if (!response.ok) {
        router.push("/login");
        return;
      }

      const data = await response.json();
      if (!data.user.accessGranted) {
        router.push("/onboarding/access-code");
        return;
      }
      if (data.user.onboardingCompleted) {
        router.push("/cases");
      }
    };

    checkStatus();
  }, [router]);

  useEffect(() => {
    return () => {
      if (localImagePreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(localImagePreviewUrl);
      }
    };
  }, [localImagePreviewUrl]);

  const checkUsernameAvailabilityLive = async (candidate: string): Promise<boolean> => {
    const normalized = normalizeUsernameInput(candidate);

    if (!isUsernameFormatValid(normalized)) {
      setUsernameStatus("invalid");
      setUsernameSuggestions([]);
      setLastCheckedUsername("");
      return false;
    }

    const requestId = ++usernameRequestIdRef.current;
    setUsernameStatus("checking");
    setUsernameSuggestions([]);

    try {
      const response = await fetch("/api/auth/check-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: normalized }),
      });

      const data = await response.json();
      if (requestId !== usernameRequestIdRef.current) {
        return false;
      }

      if (!response.ok) {
        setUsernameStatus("error");
        setUsernameSuggestions([]);
        return false;
      }

      const available = Boolean(data.available);
      const suggestions = Array.isArray(data.suggestions)
        ? data.suggestions.filter((item: unknown): item is string => typeof item === "string")
        : [];

      setLastCheckedUsername(normalized);
      setUsernameStatus(available ? "available" : "taken");
      setUsernameSuggestions(available ? [] : suggestions);
      return available;
    } catch {
      if (requestId === usernameRequestIdRef.current) {
        setUsernameStatus("error");
        setUsernameSuggestions([]);
      }
      return false;
    }
  };

  useEffect(() => {
    const normalized = normalizeUsernameInput(username);

    if (!normalized) {
      setUsernameStatus("idle");
      setUsernameSuggestions([]);
      setLastCheckedUsername("");
      return;
    }

    if (!isUsernameFormatValid(normalized)) {
      setUsernameStatus("invalid");
      setUsernameSuggestions([]);
      setLastCheckedUsername("");
      return;
    }

    const timeout = setTimeout(() => {
      void checkUsernameAvailabilityLive(normalized);
    }, 350);

    return () => clearTimeout(timeout);
  }, [username]);

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (localImagePreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(localImagePreviewUrl);
    }
    setLocalImagePreviewUrl(URL.createObjectURL(file));

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/onboarding/upload-profile-image", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to upload image");
        return;
      }

      setProfileImageUrl(data.profileImageUrl);
    } catch {
      setError("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const howHeardAboutUs = resolveSelectValue(howHeardSelection, howHeardOther);
    const roleStatus = resolveSelectValue(roleStatusSelection, roleStatusOther);
    const teamSize = resolveSelectValue(teamSizeSelection, teamSizeOther);
    const useCase = resolveSelectValue(useCaseSelection, useCaseOther);
    const region = resolveSelectValue(regionSelection, regionOther);

    try {
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          profileIcon: profileImageUrl,
          howHeardAboutUs,
          roleStatus,
          teamSize: teamSize || undefined,
          useCase: useCase || undefined,
          region: region || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to complete onboarding");
        return;
      }

      setUserNumber(data.user.userSequenceNumber || null);
      setCardReady(true);
    } catch {
      setError("Failed to complete onboarding");
    } finally {
      setSubmitting(false);
    }
  };

  const currentStep = onboardingSteps[stepIndex];
  const isLastStep = stepIndex === onboardingSteps.length - 1;

  const isCurrentStepValid = () => {
    switch (currentStep.id) {
      case "username": {
        return isUsernameFormatValid(username) && usernameStatus === "available";
      }
      case "profileImage":
        return Boolean(profileImageUrl) && !uploading;
      case "howHeard":
        return resolveSelectValue(howHeardSelection, howHeardOther).length >= 2;
      case "roleStatus":
        return resolveSelectValue(roleStatusSelection, roleStatusOther).length >= 2;
      case "teamSize":
      case "region":
      case "useCase":
        return true;
      default:
        return true;
    }
  };

  const stepValidationMessage = () => {
    switch (currentStep.id) {
      case "username":
        if (!isUsernameFormatValid(username)) {
          return "Username must be 3-24 characters and only letters, numbers, or underscores.";
        }
        if (usernameStatus === "taken") {
          return "That username is already taken. Pick one of the suggestions or try another username.";
        }
        if (usernameStatus === "checking") {
          return "Checking username availability...";
        }
        return "Please choose an available username before continuing.";
      case "profileImage":
        return "Please upload your profile image before continuing.";
      case "howHeard":
        return "Please choose how you heard about us.";
      case "roleStatus":
        return "Please choose your role or status.";
      default:
        return "Please complete this step before continuing.";
    }
  };

  const goNext = async () => {
    if (currentStep.id === "username") {
      const normalized = normalizeUsernameInput(username);
      if (!isUsernameFormatValid(normalized)) {
        setError("Username must be 3-24 characters and only letters, numbers, or underscores.");
        return;
      }

      if (!(usernameStatus === "available" && lastCheckedUsername === normalized)) {
        const available = await checkUsernameAvailabilityLive(normalized);
        if (!available) {
          setError(stepValidationMessage());
          return;
        }
      }
    }

    if (!isCurrentStepValid()) {
      setError(stepValidationMessage());
      return;
    }

    setError(null);
    if (isLastStep) {
      const syntheticEvent = { preventDefault: () => undefined } as FormEvent;
      await handleSubmit(syntheticEvent);
      return;
    }

    setStepIndex((value) => Math.min(value + 1, onboardingSteps.length - 1));
  };

  const goPrevious = () => {
    setError(null);
    setStepIndex((value) => Math.max(value - 1, 0));
  };

  const skipOptionalStep = () => {
    if (!currentStep.optional || isLastStep) return;

    if (currentStep.id === "teamSize") {
      setTeamSizeSelection("");
      setTeamSizeOther("");
    }
    if (currentStep.id === "region") {
      setRegionSelection("");
      setRegionOther("");
    }
    if (currentStep.id === "useCase") {
      setUseCaseSelection("");
      setUseCaseOther("");
    }

    setError(null);
    setStepIndex((value) => Math.min(value + 1, onboardingSteps.length - 1));
  };

  const optionButtonClass = (isSelected: boolean) =>
    `border px-3 py-2 text-left text-sm transition ${
      isSelected
        ? "border-[var(--accent-strong)] bg-[var(--accent)] text-white"
        : "dash-frame-soft text-[var(--ink)] hover:border-[var(--accent)]"
    }`;

  const renderSelectStep = (
    title: string,
    helper: string,
    options: readonly string[],
    selected: string,
    setSelected: (value: string) => void,
    otherValue: string,
    setOtherValue: (value: string) => void,
    optional = false
  ) => {
    return (
      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--ink)]">
          {title}
          {optional ? " (optional)" : " *"}
        </label>
        <p className="mb-3 text-xs text-[var(--muted)]">{helper}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSelected(option)}
              className={optionButtonClass(selected === option)}
            >
              {option}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelected(OTHER_OPTION)}
            className={optionButtonClass(selected === OTHER_OPTION)}
          >
            Others
          </button>
        </div>
        {selected === OTHER_OPTION ? (
          <input
            type="text"
            value={otherValue}
            onChange={(event) => setOtherValue(event.target.value)}
            placeholder="Type your answer"
            className="dash-frame-soft mt-3 w-full px-3 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
          />
        ) : null}
      </div>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep.id) {
      case "username":
        return (
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--ink)]">Username *</label>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(normalizeUsernameInput(event.target.value))}
              placeholder="zachxbt"
              minLength={3}
              maxLength={24}
              className="dash-frame-soft w-full px-3 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
            <p className="mt-2 text-xs text-[var(--muted)]">Use 3-24 characters with letters, numbers, and underscores.</p>
            {usernameStatus === "checking" ? (
              <p className="mt-2 text-xs text-[var(--muted)]">Checking availability...</p>
            ) : null}
            {usernameStatus === "available" ? (
              <p className="mt-2 text-xs text-[var(--accent-strong)]">Username available.</p>
            ) : null}
            {usernameStatus === "taken" ? (
              <div className="mt-3">
                <p className="text-xs text-red-700">Username is taken. Try one of these:</p>
                {usernameSuggestions.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {usernameSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setUsername(suggestion)}
                        className="dash-frame-soft px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:border-[var(--accent)]"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {usernameStatus === "invalid" ? (
              <p className="mt-2 text-xs text-red-700">Invalid username format.</p>
            ) : null}
            {usernameStatus === "error" ? (
              <p className="mt-2 text-xs text-red-700">Could not verify username right now. Try again.</p>
            ) : null}
          </div>
        );
      case "profileImage":
        return (
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--ink)]">Profile image *</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageUpload}
              className="dash-frame-soft w-full px-3 py-2.5 text-sm text-[var(--ink)]"
            />
            <p className="mt-2 text-xs text-[var(--muted)]">JPG, PNG, or WebP. Max 5MB.</p>
            {uploading ? <p className="mt-2 text-xs text-[var(--muted)]">Uploading...</p> : null}
            {localImagePreviewUrl || profileImageUrl ? (
              <div className="mt-3 flex items-center gap-3">
                <Image
                  src={profileImageUrl || localImagePreviewUrl}
                  alt="Profile preview"
                  width={48}
                  height={48}
                  unoptimized
                  className="h-12 w-12 border border-[var(--line)] object-cover"
                />
                <p className="text-xs text-[var(--accent-strong)]">
                  {profileImageUrl ? "Upload complete" : "Preview ready, uploading..."}
                </p>
              </div>
            ) : null}
          </div>
        );
      case "howHeard":
        return renderSelectStep(
          "How did you hear about us?",
          "Pick one option. If not listed, choose Others.",
          howHeardOptions,
          howHeardSelection,
          setHowHeardSelection,
          howHeardOther,
          setHowHeardOther
        );
      case "roleStatus":
        return renderSelectStep(
          "Role / status",
          "Pick your closest role. Use Others if needed.",
          roleStatusOptions,
          roleStatusSelection,
          setRoleStatusSelection,
          roleStatusOther,
          setRoleStatusOther
        );
      case "teamSize":
        return renderSelectStep(
          "Team size",
          "Optional. You can skip this step.",
          teamSizeOptions,
          teamSizeSelection,
          setTeamSizeSelection,
          teamSizeOther,
          setTeamSizeOther,
          true
        );
      case "region":
        return renderSelectStep(
          "Jurisdiction / region",
          "Optional. Choose your primary region.",
          regionOptions,
          regionSelection,
          setRegionSelection,
          regionOther,
          setRegionOther,
          true
        );
      case "useCase":
        return renderSelectStep(
          "Primary use case",
          "Optional. Select what you will use Aubox for most.",
          useCaseOptions,
          useCaseSelection,
          setUseCaseSelection,
          useCaseOther,
          setUseCaseOther,
          true
        );
      default:
        return null;
    }
  };

  const generateCardDataUrl = async (): Promise<string | null> => {
    if (!cardReady || !userNumber) return null;

    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 900;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#f6f2e9";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const glowA = ctx.createRadialGradient(180, 120, 20, 180, 120, 320);
    glowA.addColorStop(0, "rgba(10, 110, 93, 0.24)");
    glowA.addColorStop(1, "rgba(10, 110, 93, 0)");
    ctx.fillStyle = glowA;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const glowB = ctx.createRadialGradient(1410, 760, 20, 1410, 760, 360);
    glowB.addColorStop(0, "rgba(191, 78, 30, 0.22)");
    glowB.addColorStop(1, "rgba(191, 78, 30, 0)");
    ctx.fillStyle = glowB;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawDitheredOverlay(ctx, canvas.width, canvas.height);

    const shellX = 46;
    const shellY = 40;
    const shellW = 1508;
    const shellH = 820;

    ctx.fillStyle = "#f8f5ee";
    ctx.fillRect(shellX, shellY, shellW, shellH);

    ctx.strokeStyle = "#334032";
    ctx.lineWidth = 2;
    ctx.strokeRect(shellX, shellY, shellW, shellH);

    ctx.fillStyle = "#01493d";
    ctx.fillRect(shellX, shellY, shellW, 14);

    ctx.strokeStyle = "rgba(21, 21, 21, 0.18)";
    ctx.lineWidth = 2;
    ctx.strokeRect(shellX + 22, shellY + 22, shellW - 44, shellH - 44);

    ctx.fillStyle = "#01493d";
    ctx.font = "600 24px 'JetBrains Mono', 'Segoe UI', monospace";
    ctx.fillText("AUBOX ONBOARDING CARD", 88, 106);

    const panelX = 88;
    const panelY = 150;
    const panelW = 980;
    const panelH = 620;

    const railX = 1092;
    const railY = 150;
    const railW = 420;
    const railH = 620;

    ctx.fillStyle = "#fffdf8";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "rgba(21, 21, 21, 0.18)";
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.fillStyle = "#fffdf8";
    ctx.fillRect(railX, railY, railW, railH);
    ctx.strokeRect(railX, railY, railW, railH);

    const profileSize = 168;
    const profileX = panelX + 56;
    const profileY = panelY + 56;

    ctx.fillStyle = "#f2eee5";
    ctx.fillRect(profileX, profileY, profileSize, profileSize);
    ctx.strokeStyle = "rgba(21, 21, 21, 0.18)";
    ctx.strokeRect(profileX, profileY, profileSize, profileSize);

    let profileDrawn = false;

    const profileSources = [localImagePreviewUrl, profileImageUrl].filter(Boolean);
    if (profileSources.length > 0) {
      for (const source of profileSources) {
        try {
          const profileImg = await loadImage(source);
          ctx.save();
          clipRoundedRect(ctx, profileX, profileY, profileSize, profileSize, 0);
          ctx.clip();
          ctx.drawImage(profileImg, profileX, profileY, profileSize, profileSize);
          ctx.restore();
          profileDrawn = true;
          break;
        } catch {
          // Try the next available source.
        }
      }
    }

    if (!profileDrawn) {
      const seed = (username || "investigator").slice(0, 2).toUpperCase();
      ctx.fillStyle = "#01493d";
      ctx.font = "700 56px 'Instrument Sans', 'Segoe UI', sans-serif";
      ctx.fillText(seed, profileX + 44, profileY + 102);
    }

    const usernameX = panelX + 262;
    const usernameY = panelY + 130;

    const safeUsername = `@${username || "investigator"}`;
    ctx.fillStyle = "#151515";
    ctx.font = "700 66px 'Instrument Sans', 'Segoe UI', sans-serif";
    const usernameMaxWidth = panelW - 310;
    ctx.fillText(fitSingleLineText(ctx, safeUsername, usernameMaxWidth), usernameX, usernameY);

    ctx.fillStyle = "#574f46";
    ctx.font = "600 40px 'Instrument Sans', 'Segoe UI', sans-serif";
    ctx.fillText(`User #${userNumber}`, usernameX, usernameY + 54);

    ctx.fillStyle = "#01493d";
    ctx.font = "600 20px 'JetBrains Mono', 'Segoe UI', monospace";
    ctx.fillText("INVESTIGATOR IDENTITY", panelX + 56, panelY + 280);

    ctx.fillStyle = "#151515";
    ctx.font = "600 58px 'Instrument Sans', 'Segoe UI', sans-serif";
    const headlineLines = wrapTextIntoLines(ctx, "Built for serious onchain investigators.", 852, 2);
    const headlineStartY = panelY + 370;
    for (let i = 0; i < headlineLines.length; i += 1) {
      ctx.fillText(headlineLines[i], panelX + 56, headlineStartY + i * 62);
    }

    ctx.fillStyle = "#574f46";
    ctx.font = "500 34px 'Instrument Sans', 'Segoe UI', sans-serif";
    const subheadY = headlineStartY + Math.max(0, headlineLines.length - 1) * 62 + 66;
    ctx.fillText("Move faster, keep full analytical control.", panelX + 56, subheadY);

    const qrSize = 244;
    const qrX = railX + 88;
    const qrY = railY + 188;

    ctx.fillStyle = "#01493d";
    ctx.font = "600 20px 'JetBrains Mono', 'Segoe UI', monospace";
    ctx.fillText("SCAN ACCESS", railX + 40, railY + 78);

    ctx.fillStyle = "#151515";
    ctx.font = "600 38px 'Instrument Sans', 'Segoe UI', sans-serif";
    ctx.fillText("Open Aubox", railX + 40, railY + 132);

    ctx.fillStyle = "#fffdf8";
    ctx.fillRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32);
    ctx.strokeStyle = "rgba(21, 21, 21, 0.18)";
    ctx.lineWidth = 2;
    ctx.strokeRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32);

    try {
      const qrImage = await loadImage(`/api/qr?size=${qrSize}&data=${encodeURIComponent(AUBOX_LINK)}`);
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
    } catch {
      ctx.fillStyle = "#151515";
      ctx.font = "600 20px 'Instrument Sans', 'Segoe UI', sans-serif";
      ctx.fillText("QR unavailable", qrX + 44, qrY + 140);
    }

    ctx.fillStyle = "#151515";
    ctx.font = "600 32px 'Instrument Sans', 'Segoe UI', sans-serif";
    ctx.fillText("Scan to open Aubox", railX + 40, railY + 510);
    ctx.fillStyle = "#574f46";
    ctx.font = "500 28px 'Instrument Sans', 'Segoe UI', sans-serif";
    ctx.fillText("aubox.app", railX + 40, railY + 556);

    ctx.fillStyle = "#01493d";
    ctx.font = "600 18px 'JetBrains Mono', 'Segoe UI', monospace";
    ctx.fillText("Aubox Case Intelligence", railX + 40, railY + 598);

    return canvas.toDataURL("image/png", 1);
  };

  useEffect(() => {
    if (!cardReady) return;

    let isCancelled = false;
    setGeneratingCardPreview(true);

    void generateCardDataUrl()
      .then((dataUrl) => {
        if (isCancelled || !dataUrl) return;
        setCardPreviewDataUrl(dataUrl);
      })
      .finally(() => {
        if (!isCancelled) {
          setGeneratingCardPreview(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [cardReady, userNumber, username, profileImageUrl, localImagePreviewUrl]);

  const downloadCard = async () => {
    const dataUrl = cardPreviewDataUrl || (await generateCardDataUrl());
    if (!dataUrl) return;

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `aubox-user-card-${username || "investigator"}.png`;
    link.click();
  };

  const shareOnX = () => {
    const text = `${X_POST_TEMPLATE} User #${userNumber || ""}`.trim();
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent("https://aubox.app")}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  if (cardReady) {
    return (
      <main className="min-h-screen bg-[var(--background)]">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <div className="dash-frame p-8">
            <p className="dash-kicker">Your onboarding card</p>
            <h1 className="mt-4 text-3xl font-semibold text-[var(--ink)]">You are in as User #{userNumber}</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Download your card, share it if you want, then continue to your dashboard.</p>

            <div className="mt-6 dash-frame-soft p-5 text-[var(--ink)]">
              <div className="flex items-start gap-5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent-strong)]">Live card preview</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">This is the exact image that will be downloaded.</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-semibold">@{username}</p>
                  <p className="text-sm text-[var(--muted)]">User #{userNumber}</p>
                </div>
              </div>

              <div className="mt-4 overflow-hidden border border-[var(--line-strong)] bg-[var(--panel)]">
                {cardPreviewDataUrl ? (
                  <Image
                    src={cardPreviewDataUrl}
                    alt="Generated onboarding card preview"
                    width={1600}
                    height={900}
                    unoptimized
                    className="h-auto w-full object-cover"
                  />
                ) : (
                  <div className="flex h-[260px] items-center justify-center text-sm text-[var(--muted)]">
                    {generatingCardPreview ? "Rendering your card preview..." : "Card preview unavailable"}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={downloadCard}
                className="border border-[var(--accent-strong)] bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-white hover:bg-[var(--accent-strong)]"
              >
                Download Card
              </button>
              <button
                type="button"
                onClick={shareOnX}
                className="dash-frame-soft px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink)]"
              >
                Share on X
              </button>
              <button
                type="button"
                onClick={() => router.push("/cases")}
                className="dash-frame-soft px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink)]"
              >
                Continue to Dashboard
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void goNext();
          }}
          className="dash-frame p-8"
        >
          <p className="dash-kicker">Complete onboarding</p>
          <h1 className="mt-4 text-3xl font-semibold text-[var(--ink)]">Set up your investigator identity</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">After this, we generate your Aubox card and unlock the dashboard.</p>

          <div className="mt-6 flex items-center justify-between text-xs text-[var(--muted)]">
            <p>
              Step {stepIndex + 1} of {onboardingSteps.length}
            </p>
            {currentStep.optional ? <p>Optional step</p> : <p>Required step</p>}
          </div>

          <div className="mt-4 dash-frame-soft p-5">{renderCurrentStep()}</div>

          {error ? (
            <div className="mt-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={goPrevious}
              disabled={stepIndex === 0 || submitting || uploading}
              className="dash-frame-soft px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink)] disabled:opacity-50"
            >
              Previous
            </button>

            <div className="flex items-center gap-2">
              {currentStep.optional && !isLastStep ? (
                <button
                  type="button"
                  onClick={skipOptionalStep}
                  disabled={submitting || uploading}
                  className="dash-frame-soft px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)] disabled:opacity-50"
                >
                  Skip
                </button>
              ) : null}
              <button
                type="submit"
                disabled={submitting || uploading}
                className="border border-[var(--accent-strong)] bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
              >
                {submitting ? "Saving..." : isLastStep ? "Generate My Card" : "Next"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
