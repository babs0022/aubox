import { ImageResponse } from "next/og";

const imageOrigin = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://dashboard.aubox.app").replace(/\/$/, "");

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  const backgroundImage = `${imageOrigin}/ogimage.png`;
  const logoImage = `${imageOrigin}/aubox-logo-dark.png`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#f5f7fb",
        }}
      >
        <img
          src={backgroundImage}
          alt="Aubox Open Graph"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 24,
            bottom: 24,
            display: "flex",
            width: 96,
            height: 96,
            borderRadius: 16,
            background: "rgba(255, 255, 255, 0.92)",
            border: "1px solid rgba(15, 23, 42, 0.12)",
            boxShadow: "0 10px 24px rgba(15, 23, 42, 0.16)",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
          }}
        >
          <img
            src={logoImage}
            alt="Aubox"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
