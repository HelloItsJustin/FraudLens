import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div style={{
      width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
      color: "#eee2cd", background: "#12110f", border: "3px solid #c5a66f", borderRadius: "50%",
      fontSize: 30, fontWeight: 700, letterSpacing: -2,
    }}>
      FL
    </div>,
    { ...size },
  );
}
