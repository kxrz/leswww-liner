"use client";

import { useEffect } from "react";

/**
 * The public pages in motion (GSAP, after bertiaux.fr), mounted on the landing, the gallery and the brand page. Each
 * effect looks for what it animates and does nothing on a page without it: the title rises letter by letter, frames
 * redraw like a real e-ink panel, pictures draw themselves band by band as they arrive, section titles rise word by
 * word, the strip follows the scroll, the comparison sweeps once.
 *
 * Nothing moves with reduced motion. Pointer effects (tilt, magnetic buttons) only with a mouse. Only the hero is held
 * back before the script runs, by MOTION_GATE (lib/motion.ts), and for 2.5 s at most.
 */
export function Motion() {
  useEffect(() => {
    let cleanup = () => {};
    let cancelled = false;
    (async () => {
      const [{ gsap }, { ScrollTrigger }, { SplitText }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
        import("gsap/SplitText"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger, SplitText);
      // Split on the final fonts, or lines are measured on the fallback
      await document.fonts.ready;
      if (cancelled) return;

      const mm = gsap.matchMedia();
      // Each effect hands back what undoes its listeners and added elements; GSAP reverts the tweens itself
      const all = (...undo: (Undo | void)[]) => () => undo.forEach((u) => u?.());
      mm.add("(prefers-reduced-motion: no-preference)", () =>
        all(
          intro(gsap, SplitText),
          redraws(gsap),
          reveals(gsap, SplitText),
          cascades(gsap),
          bands(gsap, ScrollTrigger),
          strip(gsap, ScrollTrigger),
          compare(gsap, ScrollTrigger),
        ),
      );
      mm.add("(prefers-reduced-motion: no-preference) and (pointer: fine)", () => all(tilt(gsap), magnetic(gsap)));
      cleanup = () => mm.revert();
    })();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);
  return null;
}

type GSAP = typeof import("gsap").gsap;
type Undo = () => void;
type Split = typeof import("gsap/SplitText").SplitText;
type Trigger = typeof import("gsap/ScrollTrigger").ScrollTrigger;

const $$ = <T extends HTMLElement = HTMLElement>(selector: string, scope: ParentNode = document) =>
  Array.from(scope.querySelectorAll<T>(selector));

/** Listen, and hand back what stops listening. */
function on<K extends keyof HTMLElementEventMap>(el: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void): Undo {
  el.addEventListener(type, fn);
  return () => el.removeEventListener(type, fn);
}

/** The title rises letter by letter out of its lines, then the lede, the perks and the buttons follow. */
function intro(gsap: GSAP, SplitText: Split): Undo | void {
  const title = document.querySelector<HTMLElement>("[data-hero-title]");
  if (!title) return;
  const split = SplitText.create(title, { type: "lines,chars", mask: "lines" });
  // The lemon highlight sweeps in behind its words once they have risen, instead of waiting there empty
  const marks = title.querySelectorAll("mark");
  gsap.set(marks, {
    backgroundColor: "transparent",
    backgroundImage: "linear-gradient(var(--accent), var(--accent))",
    backgroundRepeat: "no-repeat",
    backgroundSize: "0% 100%",
  });
  gsap
    .timeline({ defaults: { ease: "expo.out" } })
    .from(split.chars, { yPercent: 110, rotate: 8, duration: 1.1, stagger: 0.018 })
    .to(marks, { backgroundSize: "100% 100%", duration: 0.7, ease: "expo.inOut", stagger: 0.12 }, "-=0.7")
    .from("[data-hero-sub]", { y: 24, autoAlpha: 0, duration: 0.9, stagger: 0.08 }, "<");
  // Everything now starts from its first frame: the page can show the hero (MOTION_GATE)
  document.documentElement.classList.add("motion-ready");
  return () => document.documentElement.classList.add("motion-ready");
}

/**
 * The frame redraws the way a colour e-ink panel does: a black flash, the six inks one after the other, then the
 * picture settles band by band. Once on arrival, again from the "Redraw" button, and whenever another picture is hung
 * in it (the gallery).
 */
function redraws(gsap: GSAP): Undo {
  const undo: Undo[] = [];
  const INKS = ["#000000", "#ffffff", "#e8d24a", "#c23b2e", "#2a2f8f", "#2f7a3b", "#ffffff"];
  $$("[data-redraw-frame]").forEach((figure) => {
    const screen = figure.querySelector<HTMLElement>(".screen");
    if (!screen?.querySelector(".picture")) return;
    const flash = document.createElement("div");
    flash.className = "ink-flash";
    flash.setAttribute("aria-hidden", "true");
    screen.append(flash);
    undo.push(() => flash.remove());

    const play = () => {
      const picture = screen.querySelector<HTMLElement>(".picture");
      const tl = gsap.timeline();
      tl.set(flash, { autoAlpha: 1, backgroundColor: INKS[0] });
      INKS.slice(1).forEach((ink) => tl.set(flash, { backgroundColor: ink }, "+=0.11"));
      tl.set(flash, { autoAlpha: 0 }, "+=0.11")
        .fromTo(picture, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.9, ease: "steps(12)" }, "<");
      return tl;
    };
    play();

    // A new picture in the frame is a new <img> (Frame keys it by its address): redraw for it
    const watch = new MutationObserver((changes) => {
      if (changes.some((c) => [...c.addedNodes].some((n) => n instanceof HTMLElement && n.classList.contains("picture")))) play();
    });
    watch.observe(screen, { childList: true });
    undo.push(() => watch.disconnect());

    const button = figure.querySelector<HTMLButtonElement>("[data-redraw]");
    if (button) {
      button.hidden = false;
      undo.push(on(button, "click", () => play()), () => (button.hidden = true));
    }
  });
  return () => undo.forEach((u) => u());
}

/** Section titles rise word by word as they come into view. */
function reveals(gsap: GSAP, SplitText: Split) {
  $$(".block h2, .list-title, .slide-text h2").forEach((title) => {
    const split = SplitText.create(title, { type: "lines,words", mask: "lines" });
    gsap.from(split.words, {
      yPercent: 110,
      rotate: 4,
      duration: 1,
      ease: "expo.out",
      stagger: 0.06,
      scrollTrigger: { trigger: title, start: "top 88%" },
    });
  });
}

/** Lists arrive one item after the other: the steps, the phones, the specs, the three roles. */
function cascades(gsap: GSAP) {
  const groups: [string, gsap.TweenVars][] = [
    [".how li", { y: 40, autoAlpha: 0 }],
    [".phone", { y: 80, rotate: (i: number) => (i - 1) * 4, autoAlpha: 0 }],
    [".specs dt, .specs dd", { x: -24, autoAlpha: 0 }],
    [".roles > div", { y: 40, autoAlpha: 0 }],
    [".duo > *", { y: 40, autoAlpha: 0 }],
    [".faq details", { y: 16, autoAlpha: 0 }],
  ];
  for (const [selector, from] of groups) {
    const items = $$(selector);
    if (!items.length) continue;
    gsap.from(items, {
      ...from,
      duration: 0.9,
      ease: "expo.out",
      stagger: 0.07,
      scrollTrigger: { trigger: items[0].parentElement, start: "top 85%" },
    });
  }
  // The "How it works" numbers count up as their step arrives
  $$(".how .label").forEach((label) => {
    const end = Number(label.textContent);
    if (!end) return;
    const n = { v: 0 };
    gsap.to(n, {
      v: end,
      duration: 0.8,
      ease: "power2.out",
      onUpdate: () => (label.textContent = String(Math.round(n.v)).padStart(2, "0")),
      scrollTrigger: { trigger: label, start: "top 85%" },
    });
  });
}

/**
 * Pictures draw themselves band by band as they arrive, the way the panel paints, and what goes with them follows:
 * each brand slide and its words, the gallery's cards a few at a time.
 */
function bands(gsap: GSAP, ScrollTrigger: Trigger) {
  const paint = { clipPath: "inset(0 0 0% 0)", duration: 0.8, ease: "steps(10)" };
  const hidden = { clipPath: "inset(0 0 100% 0)" };

  $$(".slides li").forEach((slide) => {
    const picture = slide.querySelector("img");
    const words = slide.querySelectorAll(".slide-text > *");
    gsap
      .timeline({ scrollTrigger: { trigger: slide, start: "top 80%" } })
      .fromTo(picture, hidden, paint)
      .from(words, { x: 32, autoAlpha: 0, duration: 0.8, ease: "expo.out", stagger: 0.07 }, "-=0.4");
  });

  const cards = $$(".gallery .card");
  if (cards.length) {
    gsap.set(cards, { y: 40, autoAlpha: 0 });
    gsap.set(cards.map((c) => c.querySelector(".thumb img")), hidden);
    ScrollTrigger.batch(cards, {
      start: "top 90%",
      once: true,
      onEnter: (batch) => {
        gsap.to(batch, { y: 0, autoAlpha: 1, duration: 0.8, ease: "expo.out", stagger: 0.08 });
        gsap.to(batch.map((c) => c.querySelector(".thumb img")), { ...paint, stagger: 0.08, delay: 0.15 });
      },
    });
  }
}

/** The strip of recent pictures speeds up and leans with the scroll, then settles back to its slow drift. */
function strip(gsap: GSAP, ScrollTrigger: Trigger) {
  const marquee = document.querySelector<HTMLElement>(".marquee");
  if (!marquee) return;
  const skew = gsap.quickTo(marquee, "skewX", { duration: 0.5, ease: "power3.out" });
  const speed = { rate: 1 };
  const apply = () => marquee.getAnimations().forEach((a) => (a.playbackRate = speed.rate));
  ScrollTrigger.create({
    trigger: marquee,
    start: "top bottom",
    end: "bottom top",
    onUpdate: (self) => {
      if (marquee.classList.contains("paused")) return;
      const v = self.getVelocity();
      speed.rate = gsap.utils.clamp(1, 12, 1 + Math.abs(v) / 150);
      apply();
      gsap.to(speed, { rate: 1, duration: 1.4, delay: 0.15, ease: "power2.out", overwrite: true, onUpdate: apply });
      skew(gsap.utils.clamp(-8, 8, v / -200));
    },
  });
}

/** The before/after sweeps once across the picture when it comes into view, to show it can be dragged. */
function compare(gsap: GSAP, ScrollTrigger: Trigger): Undo | void {
  const range = document.querySelector<HTMLInputElement>(".compare input[type=range]");
  if (!range) return;
  // React listens to input events: set the value the way a browser would, then tell it
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  const move = (v: number) => {
    setValue.call(range, String(Math.round(v)));
    range.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const split = { v: 50 };
  let touched = false;
  const stop = () => (touched = true);
  const undo = [on(range, "pointerdown", stop), on(range, "keydown", stop)];
  ScrollTrigger.create({
    trigger: range,
    start: "top 75%",
    once: true,
    onEnter: () => {
      gsap
        .timeline({ defaults: { ease: "power2.inOut" }, onUpdate: () => !touched && move(split.v) })
        .to(split, { v: 85, duration: 0.9 })
        .to(split, { v: 15, duration: 1.3 })
        .to(split, { v: 50, duration: 0.9 });
    },
  });
  return () => undo.forEach((u) => u());
}

/** Frames and slides lean towards the pointer, like a picture on a wall seen from the side. */
function tilt(gsap: GSAP): Undo {
  const undo: Undo[] = [];
  $$("[data-tilt]").forEach((zone) => {
    const target = zone.querySelector<HTMLElement>(".frame") ?? zone;
    gsap.set(target, { transformPerspective: 900 });
    const rx = gsap.quickTo(target, "rotationX", { duration: 0.6, ease: "power3.out" });
    const ry = gsap.quickTo(target, "rotationY", { duration: 0.6, ease: "power3.out" });
    undo.push(
      on(zone, "pointermove", (e) => {
        const b = zone.getBoundingClientRect();
        ry(((e.clientX - b.left) / b.width - 0.5) * 10);
        rx(((e.clientY - b.top) / b.height - 0.5) * -8);
      }),
      on(zone, "pointerleave", () => {
        rx(0);
        ry(0);
      }),
    );
  });
  return () => undo.forEach((u) => u());
}

/** The main buttons lean towards the pointer, then spring back. */
function magnetic(gsap: GSAP): Undo {
  const undo: Undo[] = [];
  $$(".hero .btn, .cta .btn, #build .btn, .featured-text .btn").forEach((button) => {
    const x = gsap.quickTo(button, "x", { duration: 0.5, ease: "power3.out" });
    const y = gsap.quickTo(button, "y", { duration: 0.5, ease: "power3.out" });
    undo.push(
      on(button, "pointermove", (e) => {
        const b = button.getBoundingClientRect();
        x((e.clientX - (b.left + b.width / 2)) * 0.3);
        y((e.clientY - (b.top + b.height / 2)) * 0.4);
      }),
      on(button, "pointerleave", () => gsap.to(button, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.4)" })),
    );
  });
  return () => undo.forEach((u) => u());
}
