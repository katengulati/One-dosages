(() => {
  const hero = document.querySelector('.oa-vial');
  if (!hero) return;
  const canvas = hero.querySelector('canvas');
  const context = canvas.getContext('2d');
  if (!context || !('IntersectionObserver' in window)) return;

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  let animation = 0;
  let started = 0;
  let width = 0;
  let height = 0;
  let particles = [];

  function sizeCanvas() {
    const bounds = hero.getBoundingClientRect();
    const density = Math.min(devicePixelRatio || 1, 2);
    width = bounds.width;
    height = bounds.height;
    canvas.width = Math.ceil(width * density);
    canvas.height = Math.ceil(height * density);
    context.setTransform(density, 0, 0, density, 0, 0);
    particles = Array.from({ length: width < 600 ? 420 : 760 }, () => ({
      fromX: Math.random(),
      fromY: Math.random(),
      toX: 0.5 + (Math.random() - 0.5) * 0.19,
      toY: 0.46 + (Math.random() - 0.5) * 0.65,
      size: 0.45 + Math.random() * 0.85,
      opacity: 0.1 + Math.random() * 0.38
    }));
  }

  function draw(now) {
    if (!started) started = now;
    const phase = ((now - started) % 7800) / 7800;
    const distance = Math.sin(phase * Math.PI) ** 2;
    context.clearRect(0, 0, width, height);
    for (const particle of particles) {
      const x = width * (particle.fromX + (particle.toX - particle.fromX) * distance);
      const y = height * (particle.fromY + (particle.toY - particle.fromY) * distance);
      context.fillStyle = `rgba(22, 22, 22, ${particle.opacity * (1 - distance * 0.83)})`;
      context.fillRect(x, y, particle.size, particle.size);
    }
    animation = requestAnimationFrame(draw);
  }

  function update() {
    cancelAnimationFrame(animation);
    if (!visible || document.hidden || motion.matches) {
      context.clearRect(0, 0, width, height);
      return;
    }
    if (!canvas.width || !particles.length) sizeCanvas();
    animation = requestAnimationFrame(draw);
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    update();
  }).observe(hero);
  new ResizeObserver(() => {
    if (visible && !motion.matches) sizeCanvas();
  }).observe(hero);
  document.addEventListener('visibilitychange', update);
  motion.addEventListener('change', update);
})();
