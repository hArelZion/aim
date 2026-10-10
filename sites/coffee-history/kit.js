// Jarvis site kit — shared behaviour (don't edit; add page-specific code to script.js).
// Condensing nav, mobile menu, reveal on scroll, accessible tabs, simple form confirmation.
document.documentElement.classList.add("js");
(function () {
  const nav = document.querySelector(".nav");
  if (nav) {
    const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 40);
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    const toggle = nav.querySelector(".nav__toggle");
    const close = () => { nav.classList.remove("is-open"); toggle && toggle.setAttribute("aria-expanded", "false"); document.body.style.overflow = ""; };
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
      toggle.addEventListener("click", () => {
        const open = nav.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(open));
        document.body.style.overflow = open ? "hidden" : "";
      });
    }
    nav.querySelectorAll(".nav__links a").forEach((a) => a.addEventListener("click", close));
  }

  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
  }), { rootMargin: "0px 0px -8% 0px", threshold: 0.1 });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  document.querySelectorAll('[role="tablist"]').forEach((list) => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const select = (t) => tabs.forEach((x) => {
      const on = x === t;
      x.setAttribute("aria-selected", String(on));
      x.tabIndex = on ? 0 : -1;
      const p = document.getElementById(x.getAttribute("aria-controls"));
      if (p) p.hidden = !on;
    });
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", (e) => {
        const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (d) { const n = tabs[(i + d + tabs.length) % tabs.length]; select(n); n.focus(); }
      });
    });
    select(tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0]);
  });

  document.querySelectorAll("form[data-confirm]").forEach((form) => form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    let done = form.querySelector(".form__done");
    if (!done) { done = document.createElement("p"); done.className = "form__done"; done.setAttribute("role", "status"); form.append(done); }
    done.textContent = form.dataset.confirm;
  }));
})();
