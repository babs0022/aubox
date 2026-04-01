const FOUNDER_FULL_NAME = process.env.FOUNDER_FULL_NAME || "Elijah Babatunde";
const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "elijah@aubox.app";
const WELCOME_SENDER = process.env.WELCOME_EMAIL_FROM || `${FOUNDER_FULL_NAME} <${FOUNDER_EMAIL}>`;
const WELCOME_REPLY_TO = process.env.WELCOME_EMAIL_REPLY_TO || FOUNDER_EMAIL;
const CALENDLY_LINK = process.env.FOUNDER_CALENDLY_URL || "https://calendly.com/babseli933/30min";

type WelcomeEmailInput = {
  toEmail: string;
  recipientName?: string;
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
