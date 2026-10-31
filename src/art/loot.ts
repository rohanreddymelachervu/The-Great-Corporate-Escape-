import type Phaser from "phaser";
import { LOOT } from "../game/loot";
/** Hand-built tiny assets. No emoji, screenshots, or runtime asset downloads. */
export function createLootTextures(scene: Phaser.Scene) {
  for (const kind of Object.keys(LOOT)) {
    const key = "loot-" + kind;
    if (scene.textures.exists(key)) continue;
    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 36;
    const c = canvas.getContext("2d")!;
    c.imageSmoothingEnabled = false;
    const r = (x: number, y: number, w: number, h: number, color: string) => {
      c.fillStyle = color;
      c.fillRect(x, y, w, h);
    };
    r(7, 31, 27, 3, "#0b15266b");
    if (kind === "tv") {
      r(1, 4, 38, 24, "#121a2c");
      r(3, 6, 34, 20, "#65788e");
      r(5, 8, 30, 16, "#426984");
      r(6, 9, 28, 4, "#86bed0");
      r(8, 15, 12, 2, "#a7e7d7");
      r(8, 19, 20, 1, "#89abc5");
      r(31, 23, 2, 1, "#a9f4ce");
      r(17, 28, 6, 4, "#25384d");
      r(10, 32, 21, 2, "#a6aabc");
      r(5, 3, 27, 1, "#a4a7b8");
    } else if (kind === "snacks") {
      r(6, 8, 27, 22, "#39283e");
      r(8, 10, 24, 19, "#cc846a");
      r(6, 7, 27, 4, "#f4c794");
      r(9, 13, 22, 3, "#e6ae7c");
      r(12, 18, 15, 8, "#e5d6a6");
      r(14, 20, 4, 4, "#ad784e");
      r(21, 19, 4, 4, "#ad784e");
      r(9, 28, 23, 3, "#f0c293");
      r(5, 5, 9, 2, "#8ee2b2");
    } else if (kind === "keyboard") {
      r(2, 13, 36, 14, "#121c2c");
      r(4, 15, 32, 10, "#a79bbd");
      r(5, 16, 30, 2, "#d9c9dd");
      for (let yy = 18; yy < 24; yy += 3)
        for (let xx = 6; xx < 35; xx += 4)
          r(xx, yy, 3, 2, (xx + yy) % 3 ? "#514d72" : "#89d5c0");
      r(12, 23, 14, 1, "#f1d2c8");
      r(20, 5, 2, 7, "#6c8791");
      r(22, 4, 8, 2, "#6c8791");
    } else if (kind === "plant") {
      r(12, 22, 17, 10, "#78566a");
      r(10, 20, 21, 4, "#d3a39c");
      r(15, 26, 11, 5, "#b6807f");
      r(19, 8, 3, 14, "#48756e");
      r(7, 9, 12, 7, "#99c49b");
      r(19, 4, 10, 9, "#6eaa8d");
      r(22, 14, 12, 6, "#a9d4a8");
      r(10, 7, 7, 2, "#d1e9b0");
      r(24, 3, 4, 7, "#aacd99");
    } else if (kind === "trophy") {
      r(9, 5, 23, 15, "#513c42");
      r(11, 6, 19, 12, "#d9aa59");
      r(12, 7, 16, 3, "#ffe2a5");
      r(7, 6, 4, 9, "#c38d4d");
      r(29, 6, 4, 9, "#c38d4d");
      r(8, 14, 6, 3, "#d9aa59");
      r(27, 14, 5, 3, "#d9aa59");
      r(17, 18, 8, 4, "#edc57f");
      r(19, 22, 4, 5, "#9b6a40");
      r(12, 27, 17, 6, "#26374c");
      r(15, 29, 11, 2, "#e3c28c");
    } else if (kind === "coffee-machine") {
      r(7, 3, 26, 30, "#142035");
      r(9, 5, 22, 26, "#809ba1");
      r(10, 6, 20, 5, "#c8d0ca");
      r(12, 12, 16, 11, "#263a50");
      r(13, 13, 5, 2, "#a9f4ce");
      r(23, 13, 3, 2, "#f2c187");
      r(14, 24, 12, 6, "#27364c");
      r(17, 22, 7, 7, "#e4cfb3");
      r(18, 22, 5, 2, "#936c5f");
      r(10, 30, 20, 2, "#c6c3b4");
    } else {
      r(6, 6, 28, 19, "#162035");
      r(8, 8, 24, 15, "#a692d3");
      r(10, 10, 20, 10, "#39465f");
      r(11, 12, 11, 2, "#9dcad1");
      r(11, 16, 16, 1, "#a9f4ce");
      r(3, 25, 34, 5, "#a9a8b9");
      r(7, 26, 26, 2, "#52647b");
      r(16, 30, 9, 1, "#d9c9dc");
    }
    scene.textures.addCanvas(key, canvas);
  }
}
