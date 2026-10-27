import Phaser from "phaser";

/** Quiet architectural backdrop: darker framing around each monument's warm core. */
export function sanctuaryTexture(scene: Phaser.Scene, region: number) {
  const key = `sanctuary-${region}`;
  if (scene.textures.exists(key)) return key;
  const texture = scene.textures.createCanvas(key, 800, 650)!;
  const c = texture.context;
  c.translate(400, 590);
  const colors = ["#92baa0", "#a3cfe0", "#c7b18d"];
  for (const side of [-1, 1]) {
    c.save();
    c.scale(side, 1);
    const material = c.createLinearGradient(100, -400, 260, 20);
    material.addColorStop(
      0,
      region === 1 ? "rgba(70,115,144,.28)" : "rgba(35,72,68,.75)",
    );
    material.addColorStop(1, "rgba(15,42,48,.12)");
    c.beginPath();
    c.moveTo(175, 0);
    c.lineTo(190, -220);
    c.bezierCurveTo(180, -330, 100, -370, 38, -435);
    c.lineTo(62, -445);
    c.bezierCurveTo(140, -405, 235, -345, 239, -230);
    c.lineTo(260, 0);
    c.closePath();
    c.fillStyle = material;
    c.fill();
    c.beginPath();
    c.moveTo(183, -5);
    c.lineTo(204, -238);
    c.bezierCurveTo(200, -330, 100, -390, 52, -438);
    c.strokeStyle = colors[region];
    c.globalAlpha = 0.45;
    c.lineWidth = 1.6;
    c.stroke();
    for (let n = 0; n < 7; n++) {
      const y = -45 - n * 43,
        x = 213 - Math.max(0, n - 3) * 13;
      c.beginPath();
      c.ellipse(
        x,
        y,
        region === 1 ? 4 : 21,
        region === 1 ? 17 : 6,
        -0.5,
        0,
        Math.PI * 2,
      );
      c.fillStyle = colors[region];
      c.globalAlpha = 0.15 + n * 0.015;
      c.fill();
    }
    c.restore();
  }
  c.strokeStyle = colors[region];
  c.lineWidth = 1;
  for (let ring = 0; ring < 3; ring++) {
    c.globalAlpha = 0.1 + ring * 0.035;
    c.beginPath();
    c.ellipse(0, -220, 135 + ring * 14, 150 + ring * 14, 0, 0, Math.PI * 2);
    c.stroke();
  }
  for (let n = 0; n < 12; n++) {
    const a = (n * Math.PI) / 6;
    c.globalAlpha = 0.35;
    c.beginPath();
    c.moveTo(Math.cos(a) * 174, -220 + Math.sin(a) * 187);
    c.lineTo(Math.cos(a) * 182, -220 + Math.sin(a) * 195);
    c.stroke();
  }
  c.globalAlpha = 0.35;
  for (let step = 0; step < 3; step++) {
    c.beginPath();
    c.ellipse(0, step * 9, 130 + step * 45, 12 + step * 4, 0, 0, Math.PI * 2);
    c.fillStyle = "#244c50";
    c.fill();
    c.strokeStyle = colors[region];
    c.stroke();
  }
  c.globalAlpha = 1;
  texture.refresh();
  return key;
}
