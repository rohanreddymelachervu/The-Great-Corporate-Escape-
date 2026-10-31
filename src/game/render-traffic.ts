import type Phaser from "phaser";
import type { OfficeScene } from "./scene";
import type { MeetingTraffic } from "./traffic";
import { blocked, clamp } from "./logic";
/** Staff are physically animated by the model; the amber doorway light is the tell. */
export function drawMeetingTraffic(
  scene: OfficeScene,
  g: Phaser.GameObjects.Graphics,
  traffic: MeetingTraffic,
  sprites: Map<string, Phaser.GameObjects.Image>,
  labels: Map<string, Phaser.GameObjects.Text>,
) {
  g.clear();
  for (const person of traffic.staff) {
    let sprite = sprites.get(person.id);
    if (!sprite) {
      sprite = scene.add.image(person.x, person.y, "staff").setScale(1.25);
      sprites.set(person.id, sprite);
    }
    sprite
      .setPosition(
        person.x,
        person.y +
          (person.phase === "inside"
            ? Math.sin(scene.elapsed * 2 + person.x) * 0.4
            : Math.sin(scene.elapsed * 11 + person.x) * 1.1),
      )
      .setFlipX(Math.cos(person.angle) < 0)
      .setDepth(40 + person.y / 1000)
      .setAlpha(person.distracted > 0 ? 0.55 : 1);
    if (person.phase !== "inside" && person.distracted <= 0) {
      const points: { x: number; y: number }[] = [{ x: person.x, y: person.y }];
      for (
        let a = person.angle - 0.9;
        a <= person.angle + 0.9 + 0.01;
        a += 0.15
      ) {
        let range = 110;
        for (let d = 12; d < 110; d += 12)
          if (
            blocked(
              { x: person.x + Math.cos(a) * d, y: person.y + Math.sin(a) * d },
              1,
              scene.obstacles,
            )
          ) {
            range = d - 4;
            break;
          }
        points.push({
          x: person.x + Math.cos(a) * range,
          y: person.y + Math.sin(a) * range,
        });
      }
      g.fillStyle(
        person.awareness > 0.3 ? 0xffc78c : 0x98c0c9,
        person.awareness > 0.3 ? 0.13 : 0.045,
      ).fillPoints(points, true);
    }
    if (person.awareness > 0.05) {
      g.lineStyle(3, person.awareness > 0.8 ? 0xff8f92 : 0xffdb94, 0.85)
        .beginPath()
        .arc(
          person.x,
          person.y,
          23,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * person.awareness,
        )
        .strokePath();
    }
  }
  for (const door of traffic.doors) {
    const color = door.warning ? 0xffce7b : door.open ? 0xffa9d0 : 0x79abbe;
    g.fillStyle(
      color,
      door.warning ? 0.6 + Math.sin(scene.elapsed * 12) * 0.3 : 0.6,
    ).fillRect(door.x - 14, door.y - 4, 28, 8);
    g.lineStyle(1, 0x17263b, 1).strokeRect(door.x - 14, door.y - 4, 28, 8);
    let label = labels.get(door.id);
    if (!label) {
      label = scene.add
        .text(0, 0, "", {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#ffdfa5",
          backgroundColor: "#252b3be6",
          padding: { x: 5, y: 3 },
        })
        .setOrigin(0.5, 1)
        .setDepth(25);
      labels.set(door.id, label);
    }
    label
      .setPosition(clamp(door.x, 100, scene.level.width - 100), door.y - 12)
      .setText(
        door.warning ? "MEETING ENDING…" : door.open ? "STAFF EXITING" : "",
      )
      .setVisible(door.warning || door.open);
  }
}
