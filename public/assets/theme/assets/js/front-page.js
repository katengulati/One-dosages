(function() {
  var root = document.querySelector('.hero-slideshow');
  if (!root) return;
  var slides = Array.prototype.slice.call(root.querySelectorAll('.hero-slide'));
  var previous = root.querySelector('.slide-arrow.prev');
  var next = root.querySelector('.slide-arrow.next');
  var toggle = root.querySelector('.slide-toggle');
  var toggleIcon = toggle.querySelector('i');
  var toggleText = toggle.querySelector('span');
  var status = document.getElementById('hero-slide-status');
  var track = root.querySelector('.hero-slideshow-track');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var current = 0;
  var timer = null;
  var userPaused = reduceMotion.matches;
  var temporarilyPaused = false;

  function showSlide(n, announce) {
    current = (n + slides.length) % slides.length;
    slides.forEach(function(slide, index) {
      var active = index === current;
      slide.classList.toggle('active', active);
      slide.setAttribute('aria-hidden', active ? 'false' : 'true');
      slide.toggleAttribute('inert', !active);
    });
    if (announce && status) {
      status.textContent = 'Slide ' + (current + 1) + ' of ' + slides.length + ': ' + (slides[current].querySelector('img').alt || 'Peptide research highlight');
    }
  }

  function stop() {
    if (timer) window.clearInterval(timer);
    timer = null;
  }

  function start() {
    stop();
    if (userPaused || temporarilyPaused || document.hidden) return;
    timer = window.setInterval(function() { showSlide(current + 1, false); }, 5000);
  }

  function updateToggle() {
    toggle.setAttribute('aria-pressed', userPaused ? 'true' : 'false');
    toggleText.textContent = userPaused ? 'Play' : 'Pause';
    toggleIcon.className = userPaused ? 'fas fa-play' : 'fas fa-pause';
    toggleIcon.setAttribute('aria-hidden', 'true');
  }

  previous.addEventListener('click', function() { showSlide(current - 1, true); start(); });
  next.addEventListener('click', function() { showSlide(current + 1, true); start(); });
  toggle.addEventListener('click', function() {
    userPaused = !userPaused;
    updateToggle();
    start();
  });
  root.addEventListener('mouseenter', function() { temporarilyPaused = true; stop(); });
  root.addEventListener('mouseleave', function() { temporarilyPaused = false; start(); });
  root.addEventListener('focusin', function() { temporarilyPaused = true; stop(); });
  root.addEventListener('focusout', function(event) {
    if (!root.contains(event.relatedTarget)) { temporarilyPaused = false; start(); }
  });
  root.addEventListener('keydown', function(event) {
    if (event.key === 'ArrowLeft') { event.preventDefault(); showSlide(current - 1, true); }
    if (event.key === 'ArrowRight') { event.preventDefault(); showSlide(current + 1, true); }
  });

  if (track) {
    var touchStartX = null;
    var touchStartY = null;

    track.addEventListener('touchstart', function(event) {
      if (event.touches.length !== 1 || event.target.closest('button')) return;
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
      stop();
    }, { passive: true });

    track.addEventListener('touchend', function(event) {
      if (touchStartX === null || !event.changedTouches.length) return;
      var deltaX = event.changedTouches[0].clientX - touchStartX;
      var deltaY = event.changedTouches[0].clientY - touchStartY;
      touchStartX = null;
      touchStartY = null;

      if (Math.abs(deltaX) >= 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
        showSlide(current + (deltaX < 0 ? 1 : -1), true);
      }
      start();
    }, { passive: true });

    track.addEventListener('touchcancel', function() {
      touchStartX = null;
      touchStartY = null;
      start();
    }, { passive: true });
  }

  document.addEventListener('visibilitychange', start);
  if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', function() {
    if (reduceMotion.matches) userPaused = true;
    updateToggle();
    start();
  });

  showSlide(0, false);
  updateToggle();
  start();
})();

function calculatePeptide() {
  const vialAmount = parseFloat(document.getElementById('vialAmount').value) || 0;
  const vialUnit = document.getElementById('vialUnit').value;
  const totalML = parseFloat(document.getElementById('totalVolume').value) || 0;
  const desiredDoseVal = parseFloat(document.getElementById('desiredDose').value) || 0;
  const doseUnit = document.getElementById('doseUnit').value;
  const resultDiv = document.getElementById('calcResults');
  const numericFields = [
    document.getElementById('vialAmount'),
    document.getElementById('totalVolume'),
    document.getElementById('desiredDose')
  ];

  // The home page ships in English and Spanish; results follow the document language.
  const spanish = /^es\b/i.test(document.documentElement.lang || '');
  const copy = spanish ? {
    invalid: 'Introduce números válidos en todos los campos.',
    volume: 'Volumen necesario:', perDose: 'por dosis',
    syringe: 'En una jeringa de 100 unidades:', units: 'unidades',
    total: 'Dosis totales en el vial:', doses: 'dosis',
    format: function(n, d) { return n.toFixed(d).replace('.', ','); }
  } : {
    invalid: 'Please enter valid numbers in all fields.',
    volume: 'Volume needed:', perDose: 'per dose',
    syringe: 'On a 100-unit syringe:', units: 'units',
    total: 'Total doses in vial:', doses: 'doses',
    format: function(n, d) { return n.toFixed(d); }
  };
  // One Aminos palette: ink for values, the brand error red only for errors.
  const ink = '#0a0a0a';
  const error = '#8a1212';

  if (vialAmount <= 0 || totalML <= 0 || desiredDoseVal <= 0) {
    numericFields.forEach(function(field) {
      field.setAttribute('aria-invalid', String(!(parseFloat(field.value) > 0)));
    });
    resultDiv.setAttribute('role', 'alert');
    resultDiv.setAttribute('aria-live', 'assertive');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = "<p style='color:" + error + ";font-weight:700;'>" + copy.invalid + "</p>";
    return;
  }

  numericFields.forEach(function(field) { field.setAttribute('aria-invalid', 'false'); });
  resultDiv.setAttribute('role', 'status');
  resultDiv.setAttribute('aria-live', 'polite');

  // Convert to mg
  let mgInVial = vialUnit === 'mcg' ? vialAmount / 1000 : vialAmount;
  let mgDose = doseUnit === 'mcg' ? desiredDoseVal / 1000 : desiredDoseVal;

  const doseVolume = (mgDose / mgInVial) * totalML;
  const totalDoses = mgInVial / mgDose;
  const insulinUnits = doseVolume * 100;

  const value = `color:${ink}; font-weight:700; font-variant-numeric:tabular-nums;`;
  const message = `
    <p style="margin-bottom:10px; line-height:1.6;">
      <strong>${copy.volume}</strong>
      <span style="${value}">${copy.format(doseVolume, 3)} mL</span> ${copy.perDose}
    </p>
    <p style="margin-bottom:10px; line-height:1.6;">
      <strong>${copy.syringe}</strong>
      <span style="${value}">${copy.format(insulinUnits, 1)} ${copy.units}</span> ${copy.perDose}
    </p>
    <p style="margin-bottom:0; line-height:1.6;">
      <strong>${copy.total}</strong>
      <span style="${value}">${copy.format(totalDoses, 1)} ${copy.doses}</span>
    </p>
  `;

  resultDiv.style.display = 'block';
  resultDiv.innerHTML = message;
}
