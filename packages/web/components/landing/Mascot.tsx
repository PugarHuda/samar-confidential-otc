// Masked-blob mascot — pure SVG shapes, no external images.
export default function Mascot({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label="Samar mascot wearing a privacy mask"
    >
      {/* body blob */}
      <path
        d="M60 8c26 0 46 18 46 44 0 30-22 60-46 60S14 82 14 52C14 26 34 8 60 8Z"
        fill="#7B6CF6"
        stroke="#1A1625"
        strokeWidth="4"
      />
      {/* cheeks */}
      <circle cx="34" cy="70" r="7" fill="#FF9D8A" />
      <circle cx="86" cy="70" r="7" fill="#FF9D8A" />
      {/* privacy mask band */}
      <path
        d="M20 46c14-8 66-8 80 0v16c-14 8-66 8-80 0V46Z"
        fill="#1A1625"
      />
      {/* eye slits */}
      <circle cx="44" cy="54" r="6" fill="#FFF7EC" />
      <circle cx="76" cy="54" r="6" fill="#FFF7EC" />
      <circle cx="45" cy="55" r="2.6" fill="#1A1625" />
      <circle cx="77" cy="55" r="2.6" fill="#1A1625" />
      {/* little smile */}
      <path
        d="M50 84c4 5 16 5 20 0"
        fill="none"
        stroke="#1A1625"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
