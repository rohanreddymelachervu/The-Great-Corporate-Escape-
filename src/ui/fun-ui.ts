import { FunFriday, FUN_LINES } from "../game/fun";
import type { OfficeAudio } from "../audio/audio";
export type FunOutcome = FunFriday["result"];

/** A five-beat activity, with one accessible action and no moving modal panels. */
export function playFunFriday(options: {
  root: HTMLElement;
  audio: OfficeAudio;
  sprite: string;
  practice: boolean;
  onScored: (result: FunOutcome, seconds: number) => void;
  onReturn: () => void;
}): () => void {
  const { root, audio, sprite, practice, onScored, onReturn } = options;
  const session = new FunFriday();
  root.innerHTML = `<div class="modal-eyebrow">HR PRESENTS · MANDATORY FUN FRIDAY</div><h2>CLAP FOR<br>THE CULTURE.</h2><div class="fun-host"><img src="${sprite}" alt="HR holding an engagement clipboard"><p>“Five claps. One culture score.<br>Your enthusiasm will be quantified.”</p></div><p>${practice ? "Bonus game · no campaign progress is changed." : "Optional escape strategy · the office pauses while you play."} Tap <strong>CLAP</strong> or press <kbd>SPACE</kbd> when the marker enters the mint zone. Land 3 of 5.</p><div class="fun-stage"><div class="fun-rounds" id="fun-rounds"></div><strong id="fun-line"></strong><div class="fun-track" role="progressbar" aria-label="Clap timing marker" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="fun-target" style="left:43%;width:24%"></span><span id="fun-marker"></span></div><div class="fun-feedback" id="fun-feedback" aria-live="polite">Wait for the mint zone. You’ve got this.</div><button id="clap-btn" class="primary">START ACTIVITY <span>SPACE</span></button><div class="fun-score" id="fun-score">0 / 5 CLAPS · 0 PTS</div></div><p class="fun-reward">${practice ? "Chase your local best. All claps are legally non-binding." : "3+ hits: −25 BS, +1 coffee, HR distracted for 12s. Miss: +8 BS. Activity time counts toward your run."}</p>`;
  const q = <T extends HTMLElement = HTMLElement>(s: string) =>
    root.querySelector<T>(s)!;
  let active = true,
    frame = 0,
    elapsed = 0,
    roundMs = 0,
    previous = performance.now(),
    rest = 0,
    armed = false,
    scored = false,
    started = false;
  function paint() {
    q("#fun-rounds").innerHTML = Array.from(
      { length: session.total },
      (_, i) =>
        `<span class="${i < session.round ? (session.results[i]?.hit ? "hit" : "miss") : i === session.round ? "current" : ""}">${i + 1}</span>`,
    ).join("");
    q("#fun-line").textContent =
      FUN_LINES[Math.min(session.round, FUN_LINES.length - 1)];
    q("#fun-score").textContent =
      `${session.hits} / 5 CLAPS · ${session.score} PTS`;
  }
  function finish() {
    if (scored) return;
    scored = true;
    armed = false;
    const result = session.result;
    onScored(result, elapsed / 1000);
    audio.sfx(result.success ? "exit" : "caught");
    q("#fun-line").textContent = result.success
      ? "CULTURE HACKED. WEEKEND PROTECTED."
      : "HR HAS RECORDED “GROWTH POTENTIAL”.";
    q(".fun-track").hidden = true;
    q("#fun-feedback").textContent = result.success
      ? practice
        ? "An exceptional performance of caring."
        : "−25 BS · +1 cup · HR occupied for 12 seconds."
      : practice
        ? "A bold rejection of workplace choreography."
        : "Only +8 BS. The audit will describe this as “authentic”.";
    const button = q<HTMLButtonElement>("#clap-btn");
    button.disabled = false;
    button.textContent = practice
      ? "BACK TO THE OFFICE MENU"
      : "RETURN TO YOUR ESCAPE";
    button.id = "fun-done";
    button.onclick = onReturn;
    button.focus();
  }
  function hit() {
    if (!active || session.finished) return;
    if (!started) {
      started = true;
      armed = true;
      roundMs = 0;
      previous = performance.now();
      q("#clap-btn").innerHTML = "CLAP <span>SPACE</span>";
      return;
    }
    if (!armed) return;
    const result = session.beat(session.marker(roundMs));
    audio.sfx(result.hit ? "item" : "click");
    q("#fun-feedback").textContent = result.hit
      ? (result.points >= 85
          ? "PERFECTLY PERFORMATIVE! +"
          : "APPROVED ENTHUSIASM. +") + result.points
      : "OFF-BEAT. YOUR APPRAISAL REMAINS UNCHANGED.";
    armed = false;
    q<HTMLButtonElement>("#clap-btn").disabled = true;
    rest = 550;
    paint();
    if (session.finished) finish();
  }
  q<HTMLButtonElement>("#clap-btn").onclick = hit;
  const key = (e: KeyboardEvent) => {
    if (e.code !== "Space" || e.repeat || session.finished) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!session.finished) hit();
  };
  document.addEventListener("keydown", key, true);
  function step(now: number) {
    if (!active) return;
    const dt = document.hidden ? 0 : Math.min(60, now - previous);
    previous = now;
    if (started && !session.finished) {
      elapsed += dt;
      if (rest > 0) {
        rest -= dt;
        if (rest <= 0) {
          roundMs = 0;
          armed = true;
          q("#fun-marker").style.left = "0%";
          q<HTMLButtonElement>("#clap-btn").disabled = false;
          paint();
        }
      } else {
        roundMs += dt;
        const position = session.marker(roundMs);
        q("#fun-marker").style.left = position * 100 + "%";
        q(".fun-track").setAttribute(
          "aria-valuenow",
          String(Math.round(position * 100)),
        );
        if (position >= 1) hit();
      }
    }
    frame = requestAnimationFrame(step);
  }
  paint();
  audio.resume();
  audio.unlock();
  frame = requestAnimationFrame(step);
  q<HTMLButtonElement>("#clap-btn").focus();
  return () => {
    active = false;
    cancelAnimationFrame(frame);
    document.removeEventListener("keydown", key, true);
  };
}
