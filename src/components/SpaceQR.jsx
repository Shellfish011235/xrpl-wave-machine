import React, { useMemo } from "react";

/** SVG QR for space posters — encodes the timed check-in URL. */
export function SpaceQR({ url, size = 200, label }) {
  const src = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(url)}`,
    [url, size]
  );

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="rounded-xl border-2 border-cyan-400/50 bg-white p-2 shadow-[0_0_24px_rgba(34,211,238,0.25)]"
        style={{ width: size + 16, height: size + 16 }}
      >
        <img src={src} alt={label || "Space check-in QR code"} width={size} height={size} className="block" />
      </div>
      {label && (
        <span className="text-[10px] font-mono tracking-widest text-cyan-300/80 uppercase text-center max-w-[220px]">
          {label}
        </span>
      )}
    </div>
  );
}

export default SpaceQR;
