"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Matter from "matter-js";
import FanCursor from "./FanCursor";

const NUM_SLOTS = 10;
const BALL_R = 22;
const SPAWN_MS = 1400;
const GRAVITY = 1.2;
const WIND_MAX = 0.012;
const BALL_COLORS = ["#FF6B6B","#FF9F43","#FECA57","#48DBFB","#1DD1A1","#54A0FF","#5F27CD","#EE5A24","#009432","#C4E538"];

interface Ball {
  body: Matter.Body;
  digit: number;
  color: string;
}

interface Confetti {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  angle: number;
  spin: number;
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
  const [completed, setCompleted] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState<(number | null)[]>(Array(NUM_SLOTS).fill(null));

  const resetGame = useCallback(() => {
    if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
    if (engineRef.current) {
      Matter.World.clear(engineRef.current.world, false);
      Matter.Engine.clear(engineRef.current);
    }
    ballsRef.current = [];
    slotsRef.current = Array(NUM_SLOTS).fill(null);
    confettiRef.current = [];
    setCompleted(false);
    setPhoneNumber(Array(NUM_SLOTS).fill(null));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width = window.innerWidth;
    const H = canvas.height = window.innerHeight;

    const engine = Matter.Engine.create({ gravity: { y: GRAVITY } });
    engineRef.current = engine;
    const world = engine.world;

    const ground = Matter.Bodies.rectangle(W / 2, H + 25, W * 2, 50, { isStatic: true });
    const wallL = Matter.Bodies.rectangle(-25, H / 2, 50, H * 2, { isStatic: true });
    const wallR = Matter.Bodies.rectangle(W + 25, H / 2, 50, H * 2, { isStatic: true });
    Matter.World.add(world, [ground, wallL, wallR]);

    const slotW = Math.min(60, (W - 40) / NUM_SLOTS);
    const slotX = (W - slotW * NUM_SLOTS) / 2;
    const slotY = H - 60;

    for (let i = 0; i <= NUM_SLOTS; i++) {
      const sep = Matter.Bodies.rectangle(slotX + i * slotW, slotY, 4, 80, { isStatic: true });
      Matter.World.add(world, sep);
    }

    let spawnCount = 0;
    spawnTimerRef.current = setInterval(() => {
      if (spawnCount >= 50) {
        clearInterval(spawnTimerRef.current!);
        return;
      }
      const digit = Math.floor(Math.random() * 10);
      const color = BALL_COLORS[digit];
      const x = slotX + Math.random() * (slotW * NUM_SLOTS);
      const body = Matter.Bodies.circle(x, 60, BALL_R, {
        restitution: 0.4,
        friction: 0.1,
        frictionAir: 0.01,
        label: `ball-${digit}-${spawnCount}`,
      });
      Matter.World.add(world, body);
      ballsRef.current.push({ body, digit, color });
      spawnCount++;
    }, SPAWN_MS);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);

    Matter.Events.on(engine, "collisionStart", (event) => {
      event.pairs.forEach(pair => {
        const labels = [pair.bodyA.label, pair.bodyB.label];
        const ballLabel = labels.find(l => l.startsWith("ball-"));
        if (!ballLabel) return;
        const ball = ballsRef.current.find(b => b.body.label === ballLabel);
        if (!ball || ball.body.isStatic) return;

        const bx = ball.body.position.x;
        const slotIdx = Math.floor((bx - slotX) / slotW);
        if (slotIdx >= 0 && slotIdx < NUM_SLOTS && ball.body.position.y > H - 140) {
          if (slotsRef.current[slotIdx] === null) {
            slotsRef.current[slotIdx] = ball.digit;
            const newSlots = [...slotsRef.current] as (number | null)[];
            setPhoneNumber(newSlots);

            Matter.Body.setPosition(ball.body, {
              x: slotX + slotIdx * slotW + slotW / 2,
              y: slotY - BALL_R - 2,
            });
            Matter.Body.setVelocity(ball.body, { x: 0, y: 0 });
            Matter.Body.setAngularVelocity(ball.body, 0);
            Matter.Body.setStatic(ball.body, true);

            if (newSlots.every(s => s !== null)) {
              for (let i = 0; i < 200; i++) {
                confettiRef.current.push({
                  x: Math.random() * W,
                  y: Math.random() * H * 0.4,
                  vx: (Math.random() - 0.5) * 6,
                  vy: Math.random() * 3 + 1,
                  color: BALL_COLORS[Math.floor(Math.random() * BALL_COLORS.length)],
                  size: Math.random() * 8 + 4,
                  angle: Math.random() * Math.PI * 2,
                  spin: (Math.random() - 0.5) * 0.2,
                });
              }
              setCompleted(true);
            }
          }
        }
      });
    });

    Matter.Events.on(engine, "beforeUpdate", () => {
      ballsRef.current.forEach(ball => {
        if (ball.body.isStatic) return;
        const dx = ball.body.position.x - mouseRef.current.x;
        const dy = ball.body.position.y - mouseRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200 && dist > 0) {
          const force = WIND_MAX * (1 - dist / 200);
          Matter.Body.applyForce(ball.body, ball.body.position, {
            x: (dx / dist) * force,
            y: (dy / dist) * force,
          });
        }
      });
    });

    const loop = () => {
      Matter.Engine.update(engine, 1000 / 60);
      ctx.clearRect(0, 0, W, H);

      ctx.fillStyle = "#0d1117";
      ctx.fillRect(0, 0, W, H);

      for (let i = 0; i < NUM_SLOTS; i++) {
        const sx = slotX + i * slotW;
        ctx.strokeStyle = slotsRef.current[i] !== null ? "#48DBFB" : "#30363d";
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 2, slotY - BALL_R * 2 - 4, slotW - 4, BALL_R * 2 + 4);

        if (slotsRef.current[i] !== null) {
          ctx.fillStyle = BALL_COLORS[slotsRef.current[i]!];
          ctx.font = `bold ${BALL_R}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(slotsRef.current[i]), sx + slotW / 2, slotY - BALL_R);
        }

        ctx.fillStyle = "#8b949e";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(String(i + 1), sx + slotW / 2, slotY + 8);
      }

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

        ctx.restore();
      });

      confettiRef.current = confettiRef.current.filter(c => c.y < H + 20);
      confettiRef.current.forEach(c => {
        c.x += c.vx;
        c.y += c.vy;
        c.angle += c.spin;
        c.vy += 0.05;

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.angle);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size / 2);
        ctx.restore();
      });

      const displayY = 30;
      const digitW = 32;
      const totalW = NUM_SLOTS * digitW + (NUM_SLOTS - 1) * 4;
      const startX = (W - totalW) / 2;

      ctx.fillStyle = "#21262d";
      ctx.beginPath();
      ctx.roundRect(startX - 12, displayY - 8, totalW + 24, 44, 8);
      ctx.fill();

      for (let i = 0; i < NUM_SLOTS; i++) {
        const dx = startX + i * (digitW + 4);
        ctx.strokeStyle = slotsRef.current[i] !== null ? "#48DBFB" : "#30363d";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(dx, displayY, digitW, 28, 4);
        ctx.stroke();

        if (slotsRef.current[i] !== null) {
          ctx.fillStyle = BALL_COLORS[slotsRef.current[i]!];
          ctx.font = "bold 18px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(slotsRef.current[i]), dx + digitW / 2, displayY + 14);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
      window.removeEventListener("mousemove", handleMouseMove);
      Matter.World.clear(world, false);
      Matter.Engine.clear(engine);
    };
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0d1117]">
      <canvas ref={canvasRef} className="absolute inset-0" style={{ background: "#ffffff" }} />
      <FanCursor mouseRef={mouseRef} />
      {completed && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-8 text-center max-w-sm mx-4">
            <h2 className="text-3xl font-bold text-white mb-2">🎉 Number Complete!</h2>
            <p className="text-[#8b949e] mb-2">Your phone number is:</p>
            <p className="text-2xl font-mono text-[#48DBFB] mb-6 tracking-widest">
              {phoneNumber.map(d => d !== null ? String(d) : "·").join("")}
            </p>
            <button
              onClick={resetGame}
              className="bg-[#238636] hover:bg-[#2ea043] text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
