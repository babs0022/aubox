const FOUNDER_FULL_NAME = process.env.FOUNDER_FULL_NAME || "Elijah Babatunde";
const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "elijah@aubox.app";
const WELCOME_SENDER = process.env.WELCOME_EMAIL_FROM || `${FOUNDER_FULL_NAME} <${FOUNDER_EMAIL}>`;
const WELCOME_REPLY_TO = process.env.WELCOME_EMAIL_REPLY_TO || FOUNDER_EMAIL;
const ACCESS_APPROVAL_SENDER = process.env.ACCESS_APPROVAL_EMAIL_FROM || `Elijah <elijah@aubox.app>`;
const ACCESS_APPROVAL_REPLY_TO = process.env.ACCESS_APPROVAL_EMAIL_REPLY_TO || "elijah@aubox.app";
const PASSWORD_RESET_SENDER = process.env.PASSWORD_RESET_EMAIL_FROM || "Do Not Reply <noreply@aubox.app>";
const PASSWORD_RESET_REPLY_TO = process.env.PASSWORD_RESET_EMAIL_REPLY_TO || "noreply@aubox.app";
const CALENDLY_LINK = process.env.FOUNDER_CALENDLY_URL || "https://calendly.com/babseli933/30min";

type WelcomeEmailInput = {
  toEmail: string;
  recipientName?: string;
};

type AccessApprovalEmailInput = {
  toEmail: string;
  recipientName?: string;
  accessCode: string;
};

type PasswordResetEmailInput = {
  toEmail: string;
  recipientName?: string;
  resetToken: string;
};

const getBaseUrl = (): string => {
  const explicitEmailBase = process.env.WELCOME_EMAIL_BASE_URL;
  const configured = explicitEmailBase || process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;

  if (configured) {
    const trimmed = configured.replace(/\/$/, "");
    const isLocal = /localhost|127\.0\.0\.1/i.test(trimmed);
    if (!isLocal) {
      return trimmed;
    }
  }

  // Never send localhost links in emails.
  return "https://dashboard.aubox.app";
};

const isWelcomeEmailEnabled = (): boolean => {
  const flag = process.env.WELCOME_EMAIL_ENABLED;
  if (!flag) return true;
  return flag.toLowerCase() !== "false";
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const buildWelcomeEmailHtml = (name: string): string => {
  const appUrl = getBaseUrl();
  const safeName = escapeHtml(name);
  return `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; background:#f4f0e8; padding:24px; color:#0f1a16;">
    <div style="max-width:640px; margin:0 auto; border:1px solid #15362f; background:#ffffff;">
      <div style="padding:24px; background:linear-gradient(135deg,#0a6e5d 0%,#01493d 100%); color:#f5f2eb;">
        <p style="margin:0; font-size:12px; letter-spacing:2px; text-transform:uppercase; font-weight:700;">Welcome to Aubox</p>
        <h1 style="margin:12px 0 0; font-size:30px; line-height:1.2;">Great to have you here, ${safeName}.</h1>
      </div>

      <div style="padding:24px; border-top:1px solid #15362f;">
        <p style="margin:0 0 12px; font-size:15px; line-height:1.7;">I am ${escapeHtml(FOUNDER_FULL_NAME)}, founder of Aubox. Thanks for joining us.</p>
        <p style="margin:0 0 12px; font-size:15px; line-height:1.7;">Aubox helps investigators move faster on wallet profiling, tracing, and reporting without losing analytical control.</p>

        <p style="margin:20px 0 8px; font-size:13px; letter-spacing:1px; text-transform:uppercase; font-weight:700; color:#01493d;">Helpful links</p>
        <ul style="margin:0 0 16px; padding-left:18px; line-height:1.9; font-size:14px;">
          <li><a href="${appUrl}/guide" style="color:#0a6e5d;">Complete guide</a></li>
          <li><a href="${appUrl}/dashboard/resources" style="color:#0a6e5d;">Resources and references</a></li>
          <li><a href="${appUrl}/dashboard/support" style="color:#0a6e5d;">Support channel</a></li>
          <li><a href="${appUrl}/cases" style="color:#0a6e5d;">Open your investigation workspace</a></li>
        </ul>

        <p style="margin:0 0 12px; font-size:15px; line-height:1.7;">If you have questions or want to have a direct conversation with me, you can book time here:</p>
        <p style="margin:0 0 20px;"><a href="${CALENDLY_LINK}" style="display:inline-block; border:1px solid #01493d; background:#0a6e5d; color:#ffffff; text-decoration:none; font-weight:700; font-size:13px; letter-spacing:0.5px; text-transform:uppercase; padding:10px 14px;">Book 30 min with ${escapeHtml(FOUNDER_FULL_NAME.split(" ")[0] || FOUNDER_FULL_NAME)}</a></p>

        <p style="margin:0; font-size:15px; line-height:1.7;">Welcome again, and looking forward to what you build with Aubox.</p>
        <p style="margin:14px 0 0; font-size:15px; line-height:1.7;">${escapeHtml(FOUNDER_FULL_NAME)}<br/>Founder, Aubox</p>
      </div>
    </div>
  </div>`;
};

export const sendWelcomeEmail = async ({ toEmail, recipientName }: WelcomeEmailInput): Promise<void> => {
  if (!isWelcomeEmailEnabled()) {
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return;
  }

  const safeRecipient = (recipientName || "there").trim() || "there";
  const html = buildWelcomeEmailHtml(safeRecipient);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: WELCOME_SENDER,
      to: [toEmail],
      reply_to: WELCOME_REPLY_TO,
      subject: "Welcome to Aubox",
      html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Welcome email failed: ${response.status} ${detail}`.trim());
  }
};

const buildAccessApprovalEmail = (name: string, accessCode: string): { html: string; text: string } => {
  const appUrl = getBaseUrl();
  const safeName = escapeHtml(name);
  const safeCode = escapeHtml(accessCode);
  const signupUrl = `${appUrl}/signup`;
  const requestAccessUrl = `${appUrl}/request-access`;

  const text = [
    `Hi ${name},`,
    "",
    "Your Aubox access request has been approved.",
    "",
    `Your access code: ${accessCode}`,
    "",
    "How to get started:",
    `1) Open signup: ${signupUrl}`,
    "2) Create your account.",
    "3) Enter your access code when prompted.",
    "4) Complete onboarding and start in your dashboard.",
    "",
    "Important: this code can be used only once.",
    "If you delete your account later, request access again and wait for review:",
    requestAccessUrl,
    "",
    "Need support? Book a call:",
    CALENDLY_LINK,
    "",
    "Elijah",
    "Aubox",
  ].join("\n");

  const html = `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; background:#f7f4ec; padding:20px; color:#13201a;">
    <div style="max-width:640px; margin:0 auto; border:1px solid #17443a; background:#ffffff;">
      <div style="padding:18px 20px; background:#0a6e5d; color:#f5f2eb;">
        <p style="margin:0; font-size:12px; letter-spacing:1.4px; text-transform:uppercase; font-weight:700;">Aubox Access Approval</p>
        <p style="margin:8px 0 0; font-size:20px; font-weight:700;">You are in, ${safeName}.</p>
      </div>
      <div style="padding:20px; border-top:1px solid #17443a;">
        <p style="margin:0 0 12px; font-size:14px; line-height:1.7;">Your access request has been approved.</p>
        <p style="margin:0 0 14px; font-size:14px; line-height:1.7;">Access code: <strong style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">${safeCode}</strong></p>

        <p style="margin:0 0 8px; font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#01493d;">Next steps</p>
        <ol style="margin:0 0 14px; padding-left:18px; font-size:14px; line-height:1.8;">
          <li>Open signup: <a href="${signupUrl}" style="color:#0a6e5d;">${signupUrl}</a></li>
          <li>Create your account.</li>
          <li>Enter your access code when prompted.</li>
          <li>Complete onboarding and start using Aubox.</li>
        </ol>

        <p style="margin:0 0 12px; padding:10px 12px; border:1px solid #d6b08a; background:#fff5ea; font-size:13px; line-height:1.6;">
          <strong>Important:</strong> this code can only be used once. If you delete your account, submit a new request and wait for review again.
          <br/>Request access: <a href="${requestAccessUrl}" style="color:#0a6e5d;">${requestAccessUrl}</a>
        </p>

        <p style="margin:0 0 12px; font-size:14px; line-height:1.7;">Need help? Book a support call here:</p>
        <p style="margin:0 0 16px;">
          <a href="${CALENDLY_LINK}" style="display:inline-block; border:1px solid #01493d; background:#0a6e5d; color:#ffffff; text-decoration:none; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; padding:10px 14px;">Book 30 min support call</a>
        </p>

        <p style="margin:0; font-size:14px; line-height:1.7;">Elijah<br/>Aubox</p>
      </div>
    </div>
  </div>`;

  return { html, text };
};

export const sendAccessApprovalEmail = async ({
  toEmail,
  recipientName,
  accessCode,
}: AccessApprovalEmailInput): Promise<void> => {
  if (!isWelcomeEmailEnabled()) {
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const safeRecipient = (recipientName || "there").trim() || "there";
  const content = buildAccessApprovalEmail(safeRecipient, accessCode);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: ACCESS_APPROVAL_SENDER,
      to: [toEmail],
      reply_to: ACCESS_APPROVAL_REPLY_TO,
      subject: "Your Aubox access request is approved",
      html: content.html,
      text: content.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Access approval email failed: ${response.status} ${detail}`.trim());
  }
};

const buildPasswordResetEmail = (name: string, resetToken: string): { html: string; text: string } => {
  const appUrl = getBaseUrl();
  const resetLink = `${appUrl}/reset-password/${encodeURIComponent(resetToken)}`;
  const safeName = escapeHtml(name);

  const html = `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; background:#f4f0e8; padding:24px; color:#0f1a16;">
    <div style="max-width:640px; margin:0 auto; border:1px solid #15362f; background:#ffffff;">
      <div style="padding:24px; background:linear-gradient(135deg,#0a6e5d 0%,#01493d 100%); color:#f5f2eb;">
        <p style="margin:0; font-size:12px; letter-spacing:2px; text-transform:uppercase; font-weight:700;">Password Reset</p>
        <h1 style="margin:12px 0 0; font-size:30px; line-height:1.2;">Reset your password</h1>
      </div>

      <div style="padding:24px; border-top:1px solid #15362f;">
        <p style="margin:0 0 12px; font-size:15px; line-height:1.7;">Hi ${safeName},</p>
        <p style="margin:0 0 12px; font-size:15px; line-height:1.7;">We received a request to reset your password. Click the button below to set a new password.</p>
        <p style="margin:0 0 20px;"><a href="${resetLink}" style="display:inline-block; border:1px solid #01493d; background:#0a6e5d; color:#ffffff; text-decoration:none; font-weight:700; font-size:13px; letter-spacing:0.5px; text-transform:uppercase; padding:10px 14px;">Reset Password</a></p>

        <p style="margin:0 0 12px; font-size:13px; line-height:1.7; color:#5a6b67;">Or paste this link in your browser:<br/><a href="${resetLink}" style="color:#0a6e5d; word-break:break-all;">${resetLink}</a></p>

        <p style="margin:20px 0 12px; font-size:13px; line-height:1.7; color:#5a6b67;">This link will expire in 24 hours. If you didn't request a password reset, you can safely ignore this email.</p>

        <p style="margin:0; font-size:12px; line-height:1.6; color:#7a8b87;">— Aubox Security Team</p>
      </div>
    </div>
  </div>`;

  const text = `Password Reset

Hi ${name},

We received a request to reset your password. Click the link below to set a new password:

${resetLink}

This link will expire in 24 hours. If you didn't request a password reset, you can safely ignore this email.

— Aubox Security Team`;

  return { html, text };
};

export const sendPasswordResetEmail = async ({
  toEmail,
  recipientName,
  resetToken,
}: PasswordResetEmailInput): Promise<void> => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const safeRecipient = (recipientName || "there").trim() || "there";
  const content = buildPasswordResetEmail(safeRecipient, resetToken);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: PASSWORD_RESET_SENDER,
      to: [toEmail],
      reply_to: PASSWORD_RESET_REPLY_TO,
      subject: "Reset your Aubox password",
      html: content.html,
      text: content.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Password reset email failed: ${response.status} ${detail}`.trim());
  }
};
