"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Matter from "matter-js";
import FanCursor from "./FanCursor";

const NUM_SLOTS = 10;
const BALL_R = 22;
const SPAWN_MS = 110;
const GRAVITY = 0.432;
const WIND_MAX = 0.015;
const WIND_RADIUS = 200;
const WIND_MAX_MOBILE = 0.00625;
const WIND_RADIUS_MOBILE = 150;
const SUBSTEPS = 3;
const BALL_COLORS = ["#FF6B6B","#FF9F43","#FECA57","#48DBFB","#1DD1A1","#54A0FF","#5F27CD","#EE5A24","#009432","#C4E538"];

interface Ball {
  body: Matter.Body;
  digit: number;
  color: string;
}

interface Confetti {
  x: number; y: number; vx: number; vy: number;
  color: string; size: number; angle: number; spin: number;
}

export default function PhoneGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const ballsRef = useRef<Ball[]>([]);
  const slotsRef = useRef<(number | null)[]>(Array(NUM_SLOTS).fill(null));
  const confettiRef = useRef<Confetti[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);
  const spawnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spawnCountRef = useRef(0);
  const selectedBallRef = useRef<Ball | null>(null);

  // Detect mobile synchronously so first render is correct, then track orientation changes
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.innerWidth < 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
      : false
  );
  const [gameKey, setGameKey] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState<(number | null)[]>(Array(NUM_SLOTS).fill(null));

  useEffect(() => {
    const check = () =>
      setIsMobile(window.innerWidth < 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const resetGame = useCallback(() => {
    setCompleted(false);
    setPhoneNumber(Array(NUM_SLOTS).fill(null));
    setGameKey(k => k + 1);
  }, []);

  useEffect(() => {
    ballsRef.current = [];
    slotsRef.current = Array(NUM_SLOTS).fill(null);
    selectedBallRef.current = null;
    confettiRef.current = [];
    spawnCountRef.current = 0;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width = window.innerWidth;
    const H = canvas.height = window.innerHeight;

    const engine = Matter.Engine.create({ gravity: { y: GRAVITY } });
    engineRef.current = engine;
    const world = engine.world;

    // Ground — placed lower on mobile so spawned balls don't overlap it
    const groundY = isMobile ? H + 10 : H + 25;
    const ground = Matter.Bodies.rectangle(W / 2, groundY, W * 2, 50, { isStatic: true });
    const wallL = Matter.Bodies.rectangle(-25, H / 2, 50, H * 2, { isStatic: true });
    const wallR = Matter.Bodies.rectangle(W + 25, H / 2, 50, H * 2, { isStatic: true });
    Matter.World.add(world, [ground, wallL, wallR]);

    const slotW = Math.min(60, (W - 40) / NUM_SLOTS);
    const slotX = (W - slotW * NUM_SLOTS) / 2;
    // Desktop: boxes near bottom (open at top). Mobile: boxes near top (open at bottom).
    const slotY = isMobile ? 20 : H - 405;

    // Separators only on desktop — on mobile slotW < ball diameter so they block entry
    if (!isMobile) {
      for (let i = 0; i <= NUM_SLOTS; i++) {
        const sep = Matter.Bodies.rectangle(slotX + i * slotW, slotY, 4, 80, { isStatic: true });
        Matter.World.add(world, sep);
      }
    }

    // Desktop-only barrier: floor below boxes to stop balls tunnelling through bottom
    if (!isMobile) {
      const slotBarrier = Matter.Bodies.rectangle(
        slotX + (slotW * NUM_SLOTS) / 2,
        slotY + 4,
        slotW * NUM_SLOTS - 16,
        8,
        { isStatic: true, label: "slot-floor" }
      );
      Matter.World.add(world, slotBarrier);
    }

    const capture = (ball: Ball, slotIdx: number) => {
      if (ball.body.isStatic) return;
      if (slotsRef.current[slotIdx] !== null) return;
      if (selectedBallRef.current !== null && ball !== selectedBallRef.current) return;

      slotsRef.current[slotIdx] = ball.digit;
      const newSlots = [...slotsRef.current] as (number | null)[];
      setPhoneNumber(newSlots);

      Matter.Body.setPosition(ball.body, {
        x: slotX + slotIdx * slotW + slotW / 2,
        y: isMobile ? slotY + BALL_R + 2 : slotY - BALL_R - 2,
      });
      Matter.Body.setVelocity(ball.body, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(ball.body, 0);
      Matter.Body.setStatic(ball.body, true);
      if (selectedBallRef.current === ball) selectedBallRef.current = null;

      if (newSlots.every(s => s !== null)) {
        for (let i = 0; i < 200; i++) {
          confettiRef.current.push({
            x: Math.random() * W,
            y: isMobile ? H * 0.6 + Math.random() * H * 0.4 : Math.random() * H * 0.4,
            vx: (Math.random() - 0.5) * 6,
            vy: isMobile ? -(Math.random() * 3 + 1) : Math.random() * 3 + 1,
            color: BALL_COLORS[Math.floor(Math.random() * BALL_COLORS.length)],
            size: Math.random() * 8 + 4,
            angle: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 0.2,
          });
        }
        setCompleted(true);
      }
    };

    spawnTimerRef.current = setInterval(() => {
      const digit = Math.floor(Math.random() * 10);
      const slotAreaRight = slotX + slotW * NUM_SLOTS;
      const fromLeft = Math.random() < 0.5;

      const x = fromLeft
        ? BALL_R + Math.random() * (slotX * 0.4)
        : W - BALL_R - Math.random() * ((W - slotAreaRight) * 0.4);
      // Mobile: spawn just above the screen bottom, moving up. Desktop: spawn above screen, moving down.
      const y = isMobile ? H - BALL_R * 2 : -BALL_R;
      const vx = (Math.random() - 0.5) * 4;
      const vy = isMobile ? -(Math.random() * 3 + 2) : Math.random() * 3 + 2;

      const body = Matter.Bodies.circle(x, y, BALL_R, {
        restitution: 0.4,
        friction: 0.1,
        frictionAir: 0.018,
        label: `ball-${digit}-${spawnCountRef.current}`,
      });
      Matter.World.add(world, body);
      Matter.Body.setVelocity(body, { x: vx, y: vy });
      ballsRef.current.push({ body, digit, color: BALL_COLORS[digit] });
      spawnCountRef.current++;
    }, isMobile ? SPAWN_MS * 5.75 : SPAWN_MS);

    // Input: mouse on desktop, touch on mobile
    let removeInputListeners = () => {};
    if (isMobile) {
      let touchStartX = 0, touchStartY = 0;
      const handleTouchStart = (e: TouchEvent) => {
        e.preventDefault();
        if (e.touches.length > 0) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
          mouseRef.current = { x: touchStartX, y: touchStartY };
        }
      };
      const handleTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        if (e.touches.length > 0) {
          mouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
      };
      const handleTouchEnd = (e: TouchEvent) => {
        if (e.changedTouches.length > 0) {
          const ddx = e.changedTouches[0].clientX - touchStartX;
          const ddy = e.changedTouches[0].clientY - touchStartY;
          if (Math.sqrt(ddx * ddx + ddy * ddy) < 10) {
            const mx = e.changedTouches[0].clientX, my = e.changedTouches[0].clientY;
            const tapped = ballsRef.current.find(b => {
              if (b.body.isStatic) return false;
              const bx = b.body.position.x - mx, by = b.body.position.y - my;
              return Math.sqrt(bx * bx + by * by) < BALL_R + 8;
            }) ?? null;
            selectedBallRef.current = tapped && tapped !== selectedBallRef.current ? tapped : null;
          }
        }
      };
      canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
      canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
      canvas.addEventListener("touchend", handleTouchEnd);
      removeInputListeners = () => {
        canvas.removeEventListener("touchstart", handleTouchStart);
        canvas.removeEventListener("touchmove", handleTouchMove);
        canvas.removeEventListener("touchend", handleTouchEnd);
      };
    } else {
      const handleMouseMove = (e: MouseEvent) => {
        mouseRef.current = { x: e.clientX, y: e.clientY };
      };
      const handleClick = (e: MouseEvent) => {
        const mx = e.clientX, my = e.clientY;
        const clicked = ballsRef.current.find(b => {
          if (b.body.isStatic) return false;
          const bx = b.body.position.x - mx, by = b.body.position.y - my;
          return Math.sqrt(bx * bx + by * by) < BALL_R + 8;
        }) ?? null;
        selectedBallRef.current = clicked && clicked !== selectedBallRef.current ? clicked : null;
      };
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("click", handleClick);
      removeInputListeners = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("click", handleClick);
      };
    }

    // Collision-based capture (primary path)
    Matter.Events.on(engine, "collisionStart", (event) => {
      event.pairs.forEach(pair => {
        const labels = [pair.bodyA.label, pair.bodyB.label];
        const ballLabel = labels.find(l => l.startsWith("ball-"));
        if (!ballLabel) return;
        const ball = ballsRef.current.find(b => b.body.label === ballLabel);
        if (!ball || ball.body.isStatic) return;
        const bx = ball.body.position.x;
        const by = ball.body.position.y;
        const slotIdx = Math.floor((bx - slotX) / slotW);
        const inZone = isMobile
          ? by > slotY - BALL_R && by < slotY + 60 && ball.body.velocity.y < 0
          : by > slotY - 60 && by < slotY + BALL_R && ball.body.velocity.y > 0;
        if (slotIdx >= 0 && slotIdx < NUM_SLOTS && inZone) capture(ball, slotIdx);
      });
    });

    Matter.Events.on(engine, "beforeUpdate", () => {
      const windRadius = isMobile ? WIND_RADIUS_MOBILE : WIND_RADIUS;
      const windMax = isMobile ? WIND_MAX_MOBILE : WIND_MAX;
      ballsRef.current.forEach(ball => {
        if (ball.body.isStatic) return;
        const dx = ball.body.position.x - mouseRef.current.x;
        const dy = ball.body.position.y - mouseRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < windRadius && dist > 0) {
          const force = windMax * (1 - dist / windRadius);
          Matter.Body.applyForce(ball.body, ball.body.position,
            { x: (dx / dist) * force, y: (dy / dist) * force }
          );
        }
      });
    });

    const underline9 = (cx: number, cy: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx - BALL_R * 0.42, cy + BALL_R * 0.72);
      ctx.lineTo(cx + BALL_R * 0.42, cy + BALL_R * 0.72);
      ctx.stroke();
    };

    const loop = () => {
      for (let s = 0; s < SUBSTEPS; s++) {
        Matter.Engine.update(engine, 1000 / 60 / SUBSTEPS);
      }

      // Per-frame zone check — fallback for balls that slip past collision events
      ballsRef.current.forEach(ball => {
        if (ball.body.isStatic) return;
        const bx = ball.body.position.x;
        const by = ball.body.position.y;
        const slotIdx = Math.floor((bx - slotX) / slotW);
        const inZone = isMobile
          ? by > slotY - BALL_R && by < slotY + 60 && ball.body.velocity.y < 0
          : by > slotY - 60 && by < slotY + BALL_R && ball.body.velocity.y > 0;
        if (slotIdx >= 0 && slotIdx < NUM_SLOTS && inZone) capture(ball, slotIdx);
      });

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#0d1117";
      ctx.fillRect(0, 0, W, H);

      // Title — top on desktop, bottom on mobile (away from boxes)
      const titleY = isMobile ? H / 2 - 30 : 28;
      const subtitleY = isMobile ? H / 2 + 20 : 92;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#ffffff";
      ctx.font = isMobile ? "bold 28px sans-serif" : "bold 52px sans-serif";
      ctx.fillText("מלאו את מספר הטלפון שלכם", W / 2, titleY);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.font = isMobile ? "16px sans-serif" : "24px sans-serif";
      ctx.fillText("אם תצליחו..", W / 2, subtitleY);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = isMobile ? "13px sans-serif" : "16px sans-serif";
      ctx.fillText(isMobile ? "tap a number for easy mode" : "click a number for easy mode", W / 2, subtitleY + (isMobile ? 34 : 30));

      // Slots
      for (let i = 0; i < NUM_SLOTS; i++) {
        const sx = slotX + i * slotW;

        ctx.strokeStyle = slotsRef.current[i] !== null ? "#48DBFB" : "#30363d";
        ctx.lineWidth = 2;
        // Desktop: box above slotY (opens up). Mobile: box below slotY (opens down).
        const boxTop = isMobile ? slotY : slotY - BALL_R * 2 - 4;
        ctx.strokeRect(sx + 2, boxTop, slotW - 4, BALL_R * 2 + 4);

        if (slotsRef.current[i] !== null) {
          const d = slotsRef.current[i]!;
          const digitY = isMobile ? slotY + BALL_R + 2 : slotY - BALL_R;
          ctx.fillStyle = BALL_COLORS[d];
          ctx.font = `bold ${BALL_R}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(d), sx + slotW / 2, digitY);
          if (d === 9) underline9(sx + slotW / 2, digitY, BALL_COLORS[d]);
        }

        ctx.fillStyle = "#8b949e";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        if (isMobile) {
          ctx.textBaseline = "bottom";
          ctx.fillText(String(i + 1), sx + slotW / 2, slotY - 6);
        } else {
          ctx.textBaseline = "top";
          ctx.fillText(String(i + 1), sx + slotW / 2, slotY + 8);
        }
      }

      // Balls
      ballsRef.current.forEach(ball => {
        if (ball.body.isStatic) return;
        const { x, y } = ball.body.position;
        const angle = ball.body.angle;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        ctx.beginPath();
        ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
        ctx.fillStyle = ball.color;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#fff";
        ctx.font = `bold ${BALL_R}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(ball.digit), 0, 0);

        if (ball.digit === 9) {
          ctx.save();
          ctx.rotate(-angle);
          underline9(0, 0, "#ffffff");
          ctx.restore();
        }

        if (ball === selectedBallRef.current) {
          const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 250);
          ctx.beginPath();
          ctx.arc(0, 0, BALL_R + 7, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,255,255,${pulse})`;
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        ctx.restore();
      });

      // Confetti
      confettiRef.current = confettiRef.current.filter(c => isMobile ? c.y > -20 : c.y < H + 20);
      confettiRef.current.forEach(c => {
        c.x += c.vx;
        c.y += c.vy;
        c.angle += c.spin;
        c.vy += isMobile ? -0.05 : 0.05;

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.angle);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size / 2);
        ctx.restore();
      });

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
      removeInputListeners();
      Matter.World.clear(world, false);
      Matter.Engine.clear(engine);
    };
  }, [gameKey, isMobile]);

  // Restart button: below boxes on desktop, below boxes on mobile (boxes are at top on mobile)
  const btnStyle = isMobile
    ? { top: `${80 + BALL_R * 2 + 24}px`, left: "50%", transform: "translateX(-50%)" }
    : { bottom: "360px", left: "50%", transform: "translateX(-50%)" };

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0d1117]" style={{ touchAction: "none" }}>
      <canvas ref={canvasRef} className="absolute inset-0" />
      <FanCursor mouseRef={mouseRef} isMobile={isMobile} />
      {!isMobile && !completed && (
        <button
          onClick={resetGame}
          style={btnStyle}
          className="absolute bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors z-10 whitespace-nowrap"
        >
          🔄 התחל מחדש
        </button>
      )}
      {completed && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-8 text-center max-w-sm mx-4">
            <h2 className="text-3xl font-bold text-white mb-2">!🎉 המספר הושלם</h2>
            <p className="text-[#8b949e] mb-2">:מספר הטלפון שלך</p>
            <p className="text-2xl font-mono text-[#48DBFB] mb-6 tracking-widest">
              {phoneNumber.map(d => d !== null ? String(d) : "·").join("")}
            </p>
            <button
              onClick={resetGame}
              className="bg-[#238636] hover:bg-[#2ea043] text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              שחק שוב
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
