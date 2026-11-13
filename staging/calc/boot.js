// Before first paint: standalone class and saved theme (no flash). Runs without the app bundle.
(function () {
  try {
    var d = document.documentElement;
    if (navigator.standalone || matchMedia('(display-mode: standalone)').matches) d.classList.add('standalone');
    var t = localStorage.getItem('aimcalc:theme');
    if (t) d.dataset.theme = t;
    var bg = { midnight: '#1f232a', daylight: '#e9edf1', ocean: '#0e2233', graphite: '#000000', sakura: '#2a1f26', contrast: '#000000' }[t || 'midnight'];
    if (bg) { d.style.background = bg; }
  } catch (e) { /* storage blocked: defaults */ }
})();
