"use client";

import { useEffect, useRef, RefObject } from "react";

interface Props {
  mouseRef: RefObject<{ x: number; y: number }>;
}

export default function FanCursor({ mouseRef }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const bladeRef = useRef<SVGGElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const svg = svgRef.current;
    const bladeGroup = bladeRef.current;
    if (!svg || !bladeGroup) return;

    const SIZE = 52;
    let bladeAngle = 0;

    const loop = () => {
      const { x, y } = mouseRef.current ?? { x: 0, y: 0 };
      const W = window.innerWidth;

      svg.style.left = `${x - SIZE / 2}px`;
      svg.style.top = `${y - SIZE / 2}px`;

      const facingAngle = x < W / 2 ? 0 : 180;
      svg.style.transform = `rotate(${facingAngle}deg)`;

      bladeAngle = (bladeAngle + 8) % 360;
      bladeGroup.setAttribute("transform", `rotate(${bladeAngle}, 26, 26)`);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mouseRef]);

  return (
    <svg
      ref={svgRef}
      width="52"
      height="52"
      viewBox="0 0 52 52"
      style={{ position: "fixed", pointerEvents: "none", zIndex: 50, transition: "transform 0.15s ease" }}
    >
      <circle cx="26" cy="26" r="22" fill="white" stroke="#D1D5DB" strokeWidth="1.5" />
      <g ref={bladeRef}>
        {[0, 90, 180, 270].map((rot) => (
          <ellipse key={rot} cx="26" cy="18" rx="5" ry="10" fill="#6366F1" opacity="0.85" transform={`rotate(${rot}, 26, 26)`} />
        ))}
        <circle cx="26" cy="26" r="4" fill="#4338CA" />
      </g>
      {[0, -6, 6].map((offset, i) => (
        <line key={i} x1="48" y1={26 + offset} x2={38 + (i === 0 ? 4 : 0)} y2={26 + offset} stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round" opacity={0.5 + i * 0.1} />
      ))}
    </svg>
  );
}
