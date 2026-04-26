// Ported from oak-and-fire.github.io (faster + smoother than scroll-sized canvas)

// Setup canvas
const canvas = document.getElementById("bg-canvas");
const ctx = canvas.getContext("2d");
const dpr = window.devicePixelRatio || 1;
canvas.style.position = "fixed";
canvas.style.top = 0;
canvas.style.left = 0;
canvas.style.zIndex = "-1";
canvas.style.pointerEvents = "none";

// Canvas size in CSS pixels (we draw in CSS px).
let viewW = window.innerWidth;
let viewH = window.innerHeight;

// Section to avoid
const avoidSection = document.getElementById("about");
let cachedAvoidBox = null;
let avoidBoxRaf = 0;

function resizeCanvas() {
  // Keep the canvas locked to the viewport to avoid scroll jank.
  const width = window.innerWidth;
  const height = window.innerHeight;
  viewW = width;
  viewH = height;

  canvas.style.width = width + "px";
  canvas.style.height = height + "px";

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);

  // Draw in CSS pixels while backing store is DPR-scaled.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Create particles
let particles = [];
const particleColors = ["#14d8cc", "#c18211"];
const particleCount = Math.min(
  600,
  Math.max(220, Math.floor((window.innerWidth * window.innerHeight) / 4500))
);
for (let i = 0; i < particleCount; i++) {
  particles.push({
    x: Math.random() * viewW,
    y: Math.random() * viewH,
    radius: Math.random() * 2 + 1,
    dx: (Math.random() - 0.5) * 0.5,
    dy: (Math.random() - 0.5) * 0.5,
    color: particleColors[Math.floor(Math.random() * particleColors.length)],
  });
}

// Pointer interaction (mouse/touch) to "smack" particles around.
const pointer = { x: 0, y: 0, active: false };
const smackRadius = 140; // px
const smackStrength = 0.55; // impulse strength

window.addEventListener(
  "pointermove",
  (e) => {
    pointer.active = true;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  },
  { passive: true }
);
window.addEventListener("pointerdown", (e) => {
  pointer.active = true;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
});
window.addEventListener("pointerleave", () => {
  pointer.active = false;
});

// Get current position of the section to avoid
function getAvoidBox() {
  if (!avoidSection) return null;
  const rect = avoidSection.getBoundingClientRect();
  return {
    // Canvas coordinates are viewport coordinates (canvas is fixed).
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
  };
}

function scheduleAvoidBoxUpdate() {
  if (avoidBoxRaf) return;
  avoidBoxRaf = requestAnimationFrame(() => {
    cachedAvoidBox = getAvoidBox();
    avoidBoxRaf = 0;
  });
}

// Update avoid box during scroll without forcing layout every frame.
window.addEventListener("scroll", scheduleAvoidBoxUpdate, { passive: true });
window.addEventListener("resize", scheduleAvoidBoxUpdate);
scheduleAvoidBoxUpdate();

function animate() {
  // Frame pacing: reduce work while scrolling to keep the page responsive.
  const now = performance.now();
  if (!animate.lastTime) animate.lastTime = now;
  const targetFps = animate.isScrolling ? 24 : 60;
  const minFrameMs = 1000 / targetFps;
  if (now - animate.lastTime < minFrameMs) {
    requestAnimationFrame(animate);
    return;
  }
  animate.lastTime = now;

  // Clear in CSS pixels (we draw in CSS px after setTransform).
  const w = viewW;
  const h = viewH;
  ctx.clearRect(0, 0, w, h);
  const avoidBox = cachedAvoidBox;

  for (let p of particles) {
    // Smack away from pointer.
    if (pointer.active) {
      const vx = p.x - pointer.x;
      const vy = p.y - pointer.y;
      const dist2 = vx * vx + vy * vy;
      const r2 = smackRadius * smackRadius;
      if (dist2 > 0.0001 && dist2 < r2) {
        const dist = Math.sqrt(dist2);
        const falloff = (1 - dist / smackRadius) ** 2; // softer edge
        const nx = vx / dist;
        const ny = vy / dist;
        p.dx += nx * smackStrength * falloff;
        p.dy += ny * smackStrength * falloff;
      }
    }

    // Movement
    p.x += p.dx;
    p.y += p.dy;

    // Mild damping so particles settle after a smack.
    p.dx *= 0.994;
    p.dy *= 0.994;

    // Bounce on edge
    if (p.x < 0 || p.x > w) p.dx *= -1;
    if (p.y < 0 || p.y > h) p.dy *= -1;

    // Avoid section
    if (
      avoidBox &&
      p.x > avoidBox.left &&
      p.x < avoidBox.right &&
      p.y > avoidBox.top &&
      p.y < avoidBox.bottom
    ) {
      p.dx *= -1;
      p.dy *= -1;
      p.x += p.dx * 2;
      p.y += p.dy * 2;
    }

    // Draw
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  }

  requestAnimationFrame(animate);
}
animate();

// Lower animation cost during active scrolling.
animate.isScrolling = false;
animate.lastTime = 0;
let scrollStopTimer = 0;
window.addEventListener(
  "scroll",
  () => {
    animate.isScrolling = true;
    window.clearTimeout(scrollStopTimer);
    scrollStopTimer = window.setTimeout(() => {
      animate.isScrolling = false;
    }, 140);
  },
  { passive: true }
);

// Pause rendering when tab is hidden.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    animate.isScrolling = true;
  } else {
    animate.lastTime = 0;
    animate.isScrolling = false;
  }
});