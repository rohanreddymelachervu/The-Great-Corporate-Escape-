import Phaser from "phaser";
import "./ui/style.css";
import { OfficeScene } from "./game/scene";
import { OfficeAudio } from "./audio/audio";
import {
  ABILITIES,
  ACHIEVEMENTS,
  ENEMIES,
  VICTORY_LINES,
} from "./game/catalog";
import { dailySeed, hash } from "./game/logic";
import { LEVELS } from "./game/levels";
import { load, persist, record } from "./game/progression";
import type { Ability, Result } from "./game/types";
const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
const save = load(),
  audio = new OfficeAudio();
audio.setVolumes(save.settings.music, save.settings.sfx, save.settings.mute);
audio.music("menu");
const scene = new OfficeScene(audio);
scene.reducedMotion =
  save.settings.reducedMotion ||
  matchMedia("(prefers-reduced-motion: reduce)").matches;
const game = new Phaser.Game({
  type: Phaser.CANVAS,
  parent: "game",
  backgroundColor: "#101625",
  pixelArt: true,
  antialias: false,
  roundPixels: false,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  render: { powerPreference: "low-power", transparent: false },
  fps: { target: 60, forceSetTimeOut: false },
  scene: [scene],
  banner: false,
  audio: { noAudio: true },
  input: { activePointers: 4 },
});
function resizeGame() {
  const r = $("#stage").getBoundingClientRect();
  game.scale.resize(Math.round(r.width), Math.round(r.height));
}
let playing = false,
  paused = false,
  modalKind = "",
  lastResult: Result | null = null,
  toastTimer: ReturnType<typeof setTimeout> | null = null;
const touch =
  matchMedia("(pointer:coarse)").matches || navigator.maxTouchPoints > 0;
if (touch) document.body.classList.add("touch");
const formatTime = (s: number) =>
  Math.floor(s / 60)
    .toString()
    .padStart(2, "0") +
  ":" +
  Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
function syncMenu() {
  $("#achievement-count").textContent =
    save.achievements.length + "/" + ACHIEVEMENTS.length;
  $("#play-btn").innerHTML =
    (save.unlocked > 1 ? "CONTINUE ESCAPE" : "CLOCK OUT") + " <span>↗</span>";
  $("#sound-btn").textContent = save.settings.mute ? "MUTED" : "SOUND ON";
}
syncMenu();
function toast(title: string, text: string, duration = 3.5) {
  if (modalKind === "result") return;
  $("#toast-title").textContent = title;
  $("#toast-text").textContent = text;
  $("#toast").hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, duration * 1000);
}
window.addEventListener("office:toast", ((e: CustomEvent) => {
  if (playing && !paused)
    toast(e.detail.title, e.detail.text, e.detail.duration);
}) as EventListener);
function pause() {
  if (!playing || scene.ended || paused) return;
  paused = true;
  scene.scene.pause();
  audio.suspend();
  scene.touch = { x: 0, y: 0, sprint: false };
}
function resume() {
  if (!playing || scene.ended) return;
  paused = false;
  scene.scene.resume();
  audio.resume();
  scene.keys && Object.values(scene.keys).forEach((k) => k.reset());
  scene.touch = { x: 0, y: 0, sprint: false };
}
function closeModal() {
  const kind = modalKind;
  if (playing && scene.ended && lastResult && kind !== "result") {
    showResult(scene.won, lastResult, [], false);
    return;
  }
  $("#modal-root").hidden = true;
  $("#modal-root").innerHTML = "";
  modalKind = "";
  if (kind !== "result") resume();
  $("#game").focus();
}
function modal(kind: string, html: string, small = false) {
  if (playing && !scene.ended) pause();
  modalKind = kind;
  $("#toast").hidden = true;
  $("#modal-root").innerHTML =
    `<section class="modal ${small ? "modal-small" : ""}" role="dialog" aria-modal="true" aria-label="${kind}">${kind === "result" ? "" : '<button class="close" aria-label="Close">×</button>'}${html}</section>`;
  $("#modal-root").hidden = false;
  $("#modal-root .close")?.addEventListener("click", closeModal);
  requestAnimationFrame(() =>
    $("#modal-root").querySelector<HTMLElement>("button,input")?.focus(),
  );
}
function start(level: number, daily = false) {
  audio.resume();
  audio.unlock();
  playing = true;
  paused = false;
  modalKind = "";
  lastResult = null;
  $("#modal-root").hidden = true;
  $("#modal-root").innerHTML = "";
  $("#menu").hidden = true;
  $("#hud").hidden = false;
  $("#pause-btn").hidden = false;
  $("#footer").hidden = true;
  $("#toast").hidden = true;
  document.body.classList.add("playing");
  buildAbilities(level);
  const seed = daily ? dailySeed() : `${Date.now()}-${level}`;
  scene.scene.restart({ level, daily, seed, preview: false });
  game.scale.refresh();
  requestAnimationFrame(() => {
    resizeGame();
    $("#game").focus();
    scene.resize();
  });
}
function home() {
  if (playing && !scene.ended) {
    pause();
    modal(
      "leave",
      `<div class="modal-eyebrow">YOUR WEEKEND IS STILL PENDING</div><h2>ABANDON THIS RUN?</h2><p>Your floor progress will reset. Unlocked floors, records and achievements are safe.</p><div class="modal-actions"><button class="primary" id="confirm-home">MAIN MENU ↗</button><button class="secondary" id="keep-playing">KEEP ESCAPING</button></div>`,
      true,
    );
    $("#confirm-home").onclick = goHome;
    $("#keep-playing").onclick = closeModal;
  } else goHome();
}
function goHome() {
  audio.resume();
  playing = false;
  paused = false;
  modalKind = "";
  $("#modal-root").hidden = true;
  $("#modal-root").innerHTML = "";
  $("#menu").hidden = false;
  $("#hud").hidden = true;
  $("#pause-btn").hidden = true;
  $("#footer").hidden = false;
  $("#toast").hidden = true;
  document.body.classList.remove("playing");
  scene.scene.resume();
  scene.scene.restart({ level: 5, preview: true, seed: "menu" });
  requestAnimationFrame(resizeGame);
  audio.music("menu");
  syncMenu();
}
function buildAbilities(level: number) {
  $("#ability-bar").innerHTML = (
    Object.entries(ABILITIES) as [Ability, (typeof ABILITIES)[Ability]][]
  )
    .map(
      ([id, d]) =>
        `<button class="ability ${level < d.level ? "locked" : ""}" data-ability="${id}" ${level < d.level ? "disabled" : ""} title="${d.description}" aria-label="${d.name}"><kbd>${d.key}</kbd><span>${d.short}<small id="ability-${id}">${level < d.level ? "FLOOR " + d.level : "READY"}</small></span></button>`,
    )
    .join("");
  document.querySelectorAll<HTMLButtonElement>("[data-ability]").forEach(
    (b) =>
      (b.onclick = () => {
        audio.unlock();
        if (!paused) scene.ability(b.dataset.ability as Ability);
      }),
  );
}
window.addEventListener("office:hud", ((e: CustomEvent) => {
  if (!playing) return;
  const h = e.detail;
  $("#floor-num").textContent =
    "FLOOR " + String(h.level).padStart(2, "0") + " / 05";
  $("#floor-name").textContent = h.name;
  $("#timer").textContent = formatTime(h.elapsed);
  $("#run-mode").textContent = h.daily ? "DAILY · " + h.seed : "FRIDAY ESCAPE";
  $("#bs-value").textContent = Math.floor(h.bs) + "%";
  $("#bs-bar").style.width = h.bs + "%";
  $("#bs-bar").style.background = h.bs > 70 ? "#ff667f" : "#ff937f";
  $("#stamina-bar").style.width = h.stamina + "%";
  $("#objectives").innerHTML =
    h.objectives
      .map(
        (o: { done: boolean; label: string }) =>
          `<div class="${o.done ? "done" : ""}"><span class="objective-check">${o.done ? "✓" : "□"}</span>${o.label}</div>`,
      )
      .join("") +
    (h.ready ? '<div style="color:#a9f4ce">↗ REACH THE ELEVATOR</div>' : "");
  $("#detection").hidden = h.suspicion < 0.25 || h.hidden;
  $("#detection").textContent =
    h.suspicion > 0.9
      ? "MEETING INCOMING. BREAK LINE OF SIGHT."
      : "YOU’RE BEING PERCEIVED. MOVE.";
  $("#field-status").textContent = h.hidden
    ? "HIDDEN · DECOMPRESSING. −BS."
    : h.active.slack
      ? "BUSY ON SLACK. DON’T MOVE."
      : h.active.call
        ? "ON A VERY REAL CLIENT CALL."
        : h.active.calendar
          ? "CALENDAR: MEETINGS DECLINED."
          : h.active.vpn
            ? "VPN DOWN. CORPORATE ACTIVITY PAUSED."
            : h.target
              ? "E · " + h.target.toUpperCase()
              : h.ready
                ? "EXIT IS OPEN. YOUR WEEKEND IS THIS WAY."
                : "FOLLOW THE GOLD ARROW · BADGE → SWITCH → EXIT";
  for (const [id, d] of Object.entries(ABILITIES) as [
    Ability,
    (typeof ABILITIES)[Ability],
  ][]) {
    const b = document.querySelector<HTMLElement>(`[data-ability="${id}"]`);
    if (!b || h.level < d.level) continue;
    const cd = h.cooldowns[id] || 0,
      active = h.active[id] || 0;
    $("#ability-" + id).textContent =
      active > 0
        ? id === "wfh"
          ? "APPROVED"
          : Math.ceil(active) + "s ACTIVE"
        : cd > 0
          ? Math.ceil(cd) + "s"
          : id === "coffee"
            ? h.coffee + " CUPS"
            : id === "wfh"
              ? h.wfh + " TOKEN" + (h.wfh === 1 ? "" : "S")
              : "READY";
    b.classList.toggle("active", active > 0);
    b.classList.toggle("cooling", cd > 0);
    b.style.setProperty(
      "--cool",
      Math.max(0, 100 - (cd / (d.cooldown || 1)) * 100) + "%",
    );
  }
}) as EventListener);
window.addEventListener("office:end", ((e: CustomEvent) =>
  showResult(
    e.detail.win,
    e.detail.result,
    e.detail.earned,
    e.detail.alt,
  )) as EventListener);
function showResult(
  win: boolean,
  result: Result,
  earned: string[],
  alt: boolean,
) {
  lastResult = result;
  let newly: string[] = [];
  if (win) newly = record(save, result, earned);
  syncMenu();
  const final = win && result.level === 5 && !result.daily;
  const line = final
    ? "The glass doors open. A security guard nods. Outside, an auto driver says “meter plus twenty.” You have never been happier."
    : VICTORY_LINES[hash(result.seed) % VICTORY_LINES.length];
  modal(
    "result",
    `<div class="result-hero"><div class="modal-eyebrow">${result.daily ? "DAILY ESCAPE · " + result.seed : win ? "FRIDAY. FINALLY." : "MEETING ACCEPTED. INVOLUNTARILY."}</div><div class="result-icon ${win ? "" : "fail"}">${win ? "↗" : "∞"}</div><h2>${win ? (final ? "YOU HAVE A LIFE." : "OUT OF OFFICE.") : "PROMOTED TO<br>STAYING LATE."}</h2><p>${win ? line : "Congratulations! You’re now Senior Vice President of Staying Late. Your compensation: exposure to another all-hands."}</p>${win ? `<div class="medal">${result.medal.toUpperCase()}</div><div class="score-large">${result.score.toLocaleString()}<small style="font-size:10px;letter-spacing:1px;margin-left:8px">PTS</small></div>` : '<div class="medal">YOUR WEEKEND DESERVES A RETRY.</div>'}<div class="result-stats"><div><b>${formatTime(result.time)}</b><small>TIME</small></div><div><b>${result.spots}</b><small>SPOTTED</small></div><div><b>${result.bs}%</b><small>FINAL BS</small></div><div><b>${result.collectibles}</b><small>LAPTOPS</small></div></div>${newly.length ? `<div class="result-achievements">${newly.map((id) => "UNLOCKED · " + ACHIEVEMENTS.find((a) => a.id === id)?.name).join("<br>")}</div>` : ""}${alt ? "<p>Purple exit approved. Remote work is a state of escape.</p>" : ""}<div class="modal-actions" style="justify-content:center"><button id="result-primary" class="primary">${!win ? "RETRY INSTANTLY ↻" : result.daily || result.level === 5 ? "PLAY AGAIN ↻" : "NEXT FLOOR ↗"}</button><button id="result-retry" class="secondary">${win ? "REPLAY FLOOR" : "MAIN MENU"}</button>${win ? '<button id="share-btn" class="secondary">SHARE RESULT ↗</button>' : '<button id="result-tip" class="secondary">SURVIVAL TIPS</button>'}<button id="result-home" class="secondary">${win ? "MAIN MENU" : "CHOOSE FLOOR"}</button></div><div class="share-status" id="share-status"></div></div>`,
    false,
  );
  $("#result-primary").onclick = () =>
    start(
      win && !result.daily && result.level < 5
        ? result.level + 1
        : result.level,
      result.daily,
    );
  $("#result-retry").onclick = () =>
    win ? start(result.level, result.daily) : goHome();
  $("#result-home").onclick = () => (win ? goHome() : floorSelect());
  if (win) $("#share-btn").onclick = share;
  else $("#result-tip").onclick = () => how(true);
}
function share() {
  if (!lastResult) return;
  const r = lastResult;
  const text = `I escaped ${LEVELS[r.level - 1].name} in ${formatTime(r.time)}. ${r.medal} · ${r.score.toLocaleString()} pts · ${r.spots} sightings. ${r.daily ? "Daily " + r.seed + " · " : ""}THE GREAT OFFICE ESCAPE: 4:59 PM. Your manager is typing…`;
  if (navigator.share)
    navigator
      .share({ title: "The Great Office Escape: 4:59 PM", text })
      .then(() => {
        $("#share-status").textContent = "Your weekend has been broadcast.";
      })
      .catch(() => {
        $("#share-status").textContent = text;
      });
  else if (navigator.clipboard)
    navigator.clipboard
      .writeText(text)
      .then(() => {
        $("#share-status").textContent =
          "Result copied. Paste it where the managers can’t see.";
      })
      .catch(() => {
        $("#share-status").textContent = text;
      });
  else $("#share-status").textContent = text;
}
function floorSelect() {
  modal(
    "floors",
    `<div class="modal-eyebrow">FIVE FLOORS BETWEEN YOU AND A LIFE</div><h2>CHOOSE YOUR<br>WORKPLACE HAZARD.</h2><p>Escape each floor to unlock the next. Daily mode lets everyone attempt the same floor and seed.</p><div class="floor-grid">${LEVELS.map((l) => `<button class="floor-card" data-floor="${l.id}" ${l.id > save.unlocked ? "disabled" : ""}><span>0${l.id}</span><div><strong>${l.name}</strong><small>${l.subtitle}</small></div><em>${l.id > save.unlocked ? "LOCKED" : save.bests[l.id]?.medal || "UNESCAPED"}${save.bests[l.id] ? "<br>" + save.bests[l.id].score.toLocaleString() + " pts" : ""}</em></button>`).join("")}</div>`,
  );
  document
    .querySelectorAll<HTMLButtonElement>("[data-floor]")
    .forEach((b) => (b.onclick = () => start(Number(b.dataset.floor))));
}
function achievements() {
  modal(
    "achievements",
    `<div class="modal-eyebrow">${save.achievements.length} / ${ACHIEVEMENTS.length} UNLOCKED · SAVED ON THIS DEVICE</div><h2>EXCELLENT AT<br>NOT BEING HERE.</h2><div class="achievement-grid">${ACHIEVEMENTS.map((a) => `<div class="achievement ${save.achievements.includes(a.id) ? "unlocked" : ""}"><b>${save.achievements.includes(a.id) ? "✓" : "□"} ${a.name}</b><p>${a.text}</p><small>${save.achievements.includes(a.id) ? "UNLOCKED" : "KEEP ESCAPING"}</small></div>`).join("")}</div>`,
  );
}
function settings() {
  modal(
    "settings",
    `<div class="modal-eyebrow">YOUR OFFICE. YOUR TERMS.</div><h2>SET BOUNDARIES.</h2><label class="setting-row">Music <input id="music-volume" type="range" min="0" max="1" step="0.05" value="${save.settings.music}" aria-label="Music volume"></label><label class="setting-row">Sound effects <input id="sfx-volume" type="range" min="0" max="1" step="0.05" value="${save.settings.sfx}" aria-label="Sound effects volume"></label><label class="setting-row">Mute all audio <input id="mute-check" type="checkbox" ${save.settings.mute ? "checked" : ""}></label><label class="setting-row">Reduced motion <input id="motion-check" type="checkbox" ${save.settings.reducedMotion ? "checked" : ""}></label><p>Progress is saved locally on this browser. No accounts, trackers, AI calls, or meetings required.</p><div class="modal-actions"><button id="settings-done" class="primary">DONE ↗</button></div>`,
    true,
  );
  $("#music-volume").oninput = () => {
    save.settings.music = Number($<HTMLInputElement>("#music-volume").value);
    applySettings();
  };
  $("#sfx-volume").oninput = () => {
    save.settings.sfx = Number($<HTMLInputElement>("#sfx-volume").value);
    applySettings();
    audio.sfx("item");
  };
  $("#mute-check").onchange = () => {
    save.settings.mute = $<HTMLInputElement>("#mute-check").checked;
    applySettings();
  };
  $("#motion-check").onchange = () => {
    save.settings.reducedMotion = $<HTMLInputElement>("#motion-check").checked;
    scene.reducedMotion = save.settings.reducedMotion;
    persist(save);
  };
  $("#settings-done").onclick = closeModal;
}
function applySettings() {
  audio.setVolumes(save.settings.music, save.settings.sfx, save.settings.mute);
  persist(save);
  syncMenu();
}
function how(afterFail = false) {
  modal(
    "how",
    `<div class="modal-eyebrow">OBJECTIVE: LEAVE. DO NOT EXPLAIN.</div><h2>THE SURVIVAL GUIDE.</h2><div class="guide-grid"><div class="guide-block"><strong>01 · GET OUT</strong><p>Follow the gold arrow. Collect your badge, use E at the mint switch, then enter the elevator. Purple WFH exits need a rare house token + ability 6. Each floor is a fresh 1–4 minute escape.</p></div><div class="guide-block"><strong>02 · DON’T GET PERCEIVED</strong><p>Colored cones show vision. Walls and furniture block sight. A filling ring gives you a grace period. Break sight to lose pursuit. Sprinting is loud. Interns are fast, not omniscient.</p></div><div class="guide-block"><strong>03 · BS IS NOT HEALTHCARE</strong><p>Getting caught adds Corporate BS. At 100%, you stay late. E at purple hide rings to disappear and decompress. Coffee pickups and pantry stations reduce BS. Three seconds of grace after a catch.</p></div><div class="guide-block"><strong>04 · PRACTICE STRATEGIC UNAVAILABILITY</strong><p>1 throws coffee ahead. 2 fakes a call. 3 pretends to work (stay still). 4 blocks meetings. 5 disconnects VPN. 6 approves WFH. Abilities unlock by floor. Mouse over a button for details.</p></div></div><p><kbd>WASD</kbd> / arrows: move · <kbd>SHIFT</kbd> sprint · <kbd>E</kbd> / Space interact · <kbd>1–6</kbd> abilities · <kbd>ESC</kbd> pause · <kbd>M</kbd> mute. Touch: drag joystick, hold RUN, tap ACT. Landscape gives a wider view.</p><details><summary style="font-size:10px;color:#a9f4ce;cursor:pointer">KNOW YOUR CORPORATE THREATS ↓</summary>${Object.values(
      ENEMIES,
    )
      .map(
        (d) =>
          `<div class="threat-row" style="border-color:#${d.color.toString(16)}"><b>${d.name} · ${d.title}</b><p>+${d.damage} BS. Weakness: ${d.weakness}. ${d.name === "The Yappaccino Intern" ? "Fast erratic patrols. Nearby yap slows you; hear 12 seconds for Yappologist." : d.name === "Office Gossip" ? "Broadcasts your location to nearby enemies." : d.name === "The Founder" ? "Long sightlines. All Hands expands awareness. Ignores fake calls." : d.name === "HR" ? "Forced-fun rings build BS; avoid the pink zone." : d.name === "Product Manager" ? "Scope events briefly lock the elevator. VPN cancels the blocker." : "Patrols desks and checks Slack. Fake calls are effective."}</p></div>`,
      )
      .join(
        "",
      )}</details><div class="modal-actions"><button id="how-done" class="primary">${afterFail ? "RETRY FLOOR ↻" : "GOT IT. LEAVING. ↗"}</button></div>`,
  );
  $("#how-done").onclick = () =>
    afterFail && lastResult
      ? start(lastResult.level, lastResult.daily)
      : closeModal();
}
function pauseMenu() {
  if (!playing || scene.ended) return;
  modal(
    "pause",
    `<div class="modal-eyebrow">TIME IS PAUSED. YOUR MANAGER IS NOT.</div><h2>BRB. DEFINITELY<br>WORKING.</h2><p>No movement, timers, cooldowns, or enemies advance while paused. Your weekend can wait a second.</p><div class="modal-actions"><button id="resume-btn" class="primary">KEEP ESCAPING ↗</button><button id="restart-btn" class="secondary">RESTART FLOOR ↻</button><button id="pause-help" class="secondary">SURVIVAL GUIDE</button><button id="pause-home" class="secondary">MAIN MENU</button></div>`,
    true,
  );
  $("#resume-btn").onclick = closeModal;
  $("#restart-btn").onclick = () => start(scene.level.id, scene.options.daily);
  $("#pause-help").onclick = () => how();
  $("#pause-home").onclick = home;
}
$("#play-btn").onclick = () => start(save.unlocked);
$("#daily-btn").onclick = () => {
  const seed = dailySeed(),
    l = (hash(seed) % 5) + 1;
  modal(
    "daily",
    `<div class="modal-eyebrow">SAME SEED. SAME CHAOS. EVERYONE.</div><h2>THE DAILY<br>STAND-DOWN.</h2><p>${seed} UTC · Floor ${l}: ${LEVELS[l - 1].name}</p><p>Identical starting resources and seeded patrols. No campaign unlocks needed. Share your score to compare with colleagues. Best today: <strong style="color:#a9f4ce">${save.dailyBests[seed]?.toLocaleString() || "UNESCAPED"}</strong>.</p><p style="font-size:9px">Scores are local and honor-system; no online leaderboard. Different choices naturally change the simulation.</p><div class="modal-actions"><button id="daily-start" class="primary">ATTEMPT TODAY’S ESCAPE ↗</button></div>`,
    true,
  );
  $("#daily-start").onclick = () => start(l, true);
};
$("#floors-btn").onclick = floorSelect;
$("#achievements-btn").onclick = achievements;
$("#how-btn").onclick = () => how();
$("#settings-btn").onclick = settings;
$("#sound-btn").onclick = () => {
  save.settings.mute = !save.settings.mute;
  audio.unlock();
  applySettings();
};
$("#pause-btn").onclick = pauseMenu;
$("#home-link").onclick = (e) => {
  e.preventDefault();
  home();
};
document.addEventListener("pointerdown", () => audio.unlock(), {
  passive: true,
});
document.addEventListener("keydown", (e) => {
  audio.unlock();
  if (e.code === "KeyM" && !e.repeat) {
    save.settings.mute = !save.settings.mute;
    applySettings();
  }
  if (e.code === "Escape") {
    e.preventDefault();
    if (modalKind && modalKind !== "result") closeModal();
    else if (playing && !scene.ended) pauseMenu();
  }
  if (
    playing &&
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
      e.code,
    )
  )
    e.preventDefault();
  if (e.code === "KeyR" && modalKind === "result" && lastResult)
    start(lastResult.level, lastResult.daily);
  if (e.key === "Tab" && modalKind) {
    const nodes = Array.from(
      $("#modal-root").querySelectorAll<HTMLElement>(
        "button:not(:disabled),input,summary",
      ),
    );
    const a = nodes[0],
      b = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === a) {
      e.preventDefault();
      b?.focus();
    } else if (!e.shiftKey && document.activeElement === b) {
      e.preventDefault();
      a?.focus();
    }
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && playing && !scene.ended) pauseMenu();
});
window.addEventListener("blur", () => {
  scene.touch = { x: 0, y: 0, sprint: false };
  if (playing && !scene.ended && !paused) pauseMenu();
});
const joy = $("#joystick"),
  stick = $("#stick");
let joyPointer = -1;
function resetJoy() {
  joyPointer = -1;
  scene.touch.x = 0;
  scene.touch.y = 0;
  stick.style.transform = "translate(0px,0px)";
}
function updateJoy(e: PointerEvent) {
  const r = joy.getBoundingClientRect(),
    x = e.clientX - r.left - r.width / 2,
    y = e.clientY - r.top - r.height / 2,
    len = Math.hypot(x, y),
    max = r.width * 0.31,
    factor = Math.min(1, max / (len || 1));
  const nx = x * factor,
    ny = y * factor;
  stick.style.transform = `translate(${nx}px,${ny}px)`;
  scene.touch.x = len < 9 ? 0 : nx / max;
  scene.touch.y = len < 9 ? 0 : ny / max;
}
joy.onpointerdown = (e) => {
  e.preventDefault();
  if (paused) return;
  joyPointer = e.pointerId;
  joy.setPointerCapture(e.pointerId);
  updateJoy(e);
};
joy.onpointermove = (e) => {
  if (e.pointerId === joyPointer) {
    e.preventDefault();
    updateJoy(e);
  }
};
joy.onpointerup = resetJoy;
joy.onpointercancel = resetJoy;
joy.onlostpointercapture = resetJoy;
const sprint = $("#touch-sprint");
sprint.onpointerdown = (e) => {
  e.preventDefault();
  sprint.setPointerCapture(e.pointerId);
  scene.touch.sprint = true;
};
sprint.onpointerup = () => {
  scene.touch.sprint = false;
};
sprint.onpointercancel = () => {
  scene.touch.sprint = false;
};
sprint.onlostpointercapture = () => {
  scene.touch.sprint = false;
};
$("#touch-interact").onpointerdown = (e) => {
  e.preventDefault();
  if (!paused) scene.interact();
};
window.addEventListener("office:toast", () => {
  if (scene.preview) $("#toast").hidden = true;
});
// Read-only state aids reproducible QA without exposing cheats in the shipped build.
const inspection: {
  snapshot: () => unknown;
  ready: () => boolean;
  qa?: unknown;
} = { snapshot: () => scene.snapshot(), ready: () => !!scene.player };
if (import.meta.env.DEV && new URLSearchParams(location.search).has("qa"))
  inspection.qa = {
    start: (level: number) => start(level),
    position: (x: number, y: number) => {
      scene.pos = { x, y };
    },
    bs: (v: number) => {
      scene.bs = v;
    },
    ability: (a: Ability) => scene.ability(a),
    interact: () => scene.interact(),
  };
Object.defineProperty(window, "__office", {
  value: inspection,
  writable: false,
});
// Display the hand-drawn office immediately; menu never runs an active stealth simulation.
game.events.once("ready", () => {
  scene.scene.restart({ level: 5, preview: true, seed: "menu" });
});
setTimeout(() => {
  if (!playing && scene.scene.isActive() && !scene.preview)
    scene.scene.restart({ level: 5, preview: true, seed: "menu" });
}, 150);
