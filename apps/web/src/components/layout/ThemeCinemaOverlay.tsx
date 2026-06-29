import { useEffect, useRef, useState } from "react";

export function ThemeCinemaOverlay({
  active,
  toTheme,
  onMidpoint,
  onComplete,
}: {
  active: boolean;
  toTheme: "light" | "dark";
  onMidpoint: (theme: "light" | "dark") => void;
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "fade-in" | "morph" | "fade-out">("idle");
  const [iconState, setIconState] = useState<"light" | "dark">(toTheme === "dark" ? "light" : "dark");

  const onMidpointRef = useRef(onMidpoint);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onMidpointRef.current = onMidpoint;
    onCompleteRef.current = onComplete;
  }, [onMidpoint, onComplete]);

  useEffect(() => {
    if (!active) {
      setPhase("idle");
      return;
    }

    setPhase("fade-in");
    setIconState(toTheme === "dark" ? "light" : "dark");

    const t1 = setTimeout(() => {
      setPhase("morph");
      setIconState(toTheme);
      onMidpointRef.current(toTheme);
    }, 200);

    const t2 = setTimeout(() => {
      setPhase("fade-out");
    }, 700);

    const t3 = setTimeout(() => {
      onCompleteRef.current();
    }, 1000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [active, toTheme]);

  if (!active) return null;

  const bg = toTheme === "dark" ? "#18191B" : "#F7F9FA";
  const brand = "#00D9C5";
  const opacity = phase === "idle" || phase === "fade-out" ? 0 : 1;
  const isDarkIcon = iconState === "dark";
  const easeCurve = "cubic-bezier(0.4, 0, 0.2, 1)";

  return (
    <div
      className="fixed inset-0 z-[999999] pointer-events-none flex items-center justify-center transition-opacity duration-200"
      style={{ backgroundColor: bg, opacity }}
    >
      <div
        className="transition-all duration-300"
        style={{
          transform: phase === "fade-out" ? "scale(2.5) blur(12px)" : "scale(1) blur(0px)",
          opacity: phase === "fade-out" ? 0 : 1,
          filter: `drop-shadow(0 0 50px ${brand}80)`,
        }}
      >
        <svg
          width="100"
          height="100"
          viewBox="0 0 24 24"
          fill="none"
          stroke={brand}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: isDarkIcon ? "rotate(-90deg)" : "rotate(0deg)",
            transition: `transform 0.4s ${easeCurve}`,
          }}
        >
          <mask id="moon-mask-cinema">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <circle
              cx={isDarkIcon ? "16" : "28"}
              cy={isDarkIcon ? "8" : "-4"}
              r="9"
              fill="black"
              style={{ transition: `cx 0.4s ${easeCurve}, cy 0.4s ${easeCurve}` }}
            />
          </mask>
          <circle
            cx="12"
            cy="12"
            r={isDarkIcon ? "9" : "5"}
            fill={isDarkIcon ? brand : "none"}
            mask="url(#moon-mask-cinema)"
            style={{ transition: `r 0.4s ${easeCurve}, fill 0.4s ease` }}
          />
          <g
            style={{
              opacity: isDarkIcon ? 0 : 1,
              transform: isDarkIcon ? "scale(0.3) rotate(45deg)" : "scale(1) rotate(0deg)",
              transformOrigin: "center",
              transition: `opacity 0.2s ease, transform 0.4s ${easeCurve}`,
            }}
          >
            <line x1="12" y1="2" x2="12" y2="4" />
            <line x1="12" y1="20" x2="12" y2="22" />
            <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
            <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
            <line x1="2" y1="12" x2="4" y2="12" />
            <line x1="20" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
            <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
          </g>
        </svg>
      </div>
    </div>
  );
}
