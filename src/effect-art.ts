import Phaser from "phaser";

export function createEffectArt(scene: Phaser.Scene) {
  const make = (
    key: string,
    w: number,
    h: number,
    draw: (c: CanvasRenderingContext2D) => void,
  ) => {
    const t = scene.textures.createCanvas(key, w, h)!;
    draw(t.context);
    t.refresh();
  };
  make("vfx-vine-seal", 192, 192, (c) => {
    c.translate(96, 96);
    for (let petal = 0; petal < 6; petal++) {
      c.save();
      c.rotate((petal * Math.PI) / 3);
      c.beginPath();
      c.moveTo(0, -20);
      c.bezierCurveTo(-24, -40, -18, -67, 0, -78);
      c.bezierCurveTo(18, -67, 24, -40, 0, -20);
      c.fillStyle = "rgba(157,214,151,.16)";
      c.fill();
      c.strokeStyle = "rgba(222,244,177,.72)";
      c.lineWidth = 1.4;
      c.stroke();
      c.beginPath();
      c.moveTo(0, -25);
      c.lineTo(0, -68);
      c.stroke();
      c.restore();
    }
    c.beginPath();
    c.arc(0, 0, 34, 0, Math.PI * 2);
    c.strokeStyle = "rgba(245,232,180,.7)";
    c.lineWidth = 1;
    c.stroke();
    for (let n = 0; n < 12; n++) {
      const a = (n * Math.PI) / 6;
      c.beginPath();
      c.moveTo(Math.cos(a) * 39, Math.sin(a) * 39);
      c.lineTo(Math.cos(a) * 44, Math.sin(a) * 44);
      c.stroke();
    }
  });
  make("vfx-glint", 64, 64, (c) => {
    const glow = c.createRadialGradient(32, 32, 0, 32, 32, 31);
    glow.addColorStop(0, "rgba(255,238,174,.6)");
    glow.addColorStop(0.25, "rgba(208,238,217,.18)");
    glow.addColorStop(1, "rgba(208,238,217,0)");
    c.fillStyle = glow;
    c.fillRect(0, 0, 64, 64);
    c.beginPath();
    c.moveTo(32, 6);
    c.quadraticCurveTo(34, 29, 54, 32);
    c.quadraticCurveTo(34, 34, 32, 58);
    c.quadraticCurveTo(30, 34, 10, 32);
    c.quadraticCurveTo(30, 30, 32, 6);
    c.fillStyle = "rgba(255,248,212,.85)";
    c.fill();
  });
  make("vfx-shard", 64, 64, (c) => {
    c.beginPath();
    c.moveTo(34, 5);
    c.lineTo(45, 29);
    c.lineTo(27, 57);
    c.lineTo(22, 32);
    c.closePath();
    const g = c.createLinearGradient(20, 5, 45, 56);
    g.addColorStop(0, "rgba(237,226,248,.85)");
    g.addColorStop(0.5, "rgba(144,218,218,.55)");
    g.addColorStop(1, "rgba(255,229,180,.15)");
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = "rgba(245,250,221,.65)";
    c.lineWidth = 1;
    c.stroke();
    c.beginPath();
    c.moveTo(34, 5);
    c.lineTo(32, 31);
    c.lineTo(27, 57);
    c.strokeStyle = "rgba(244,255,230,.8)";
    c.stroke();
  });
  make("vfx-leaf", 64, 32, (c) => {
    c.beginPath();
    c.moveTo(4, 22);
    c.bezierCurveTo(12, -2, 42, 1, 60, 6);
    c.bezierCurveTo(45, 30, 15, 32, 4, 22);
    const g = c.createLinearGradient(5, 4, 55, 27);
    g.addColorStop(0, "#e0edb5");
    g.addColorStop(0.5, "#a3d2a0");
    g.addColorStop(1, "rgba(104,172,152,.2)");
    c.fillStyle = g;
    c.fill();
    c.beginPath();
    c.moveTo(7, 21);
    c.quadraticCurveTo(34, 10, 56, 8);
    c.strokeStyle = "#f0edc4";
    c.lineWidth = 0.8;
    c.stroke();
  });
  make("vfx-dew", 64, 64, (c) => {
    const g = c.createRadialGradient(26, 23, 2, 32, 32, 20);
    g.addColorStop(0, "rgba(230,252,240,.14)");
    g.addColorStop(0.75, "rgba(158,223,225,.04)");
    g.addColorStop(1, "rgba(214,239,219,.6)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(32, 32, 20, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(32, 32, 15, Math.PI, Math.PI * 1.55);
    c.strokeStyle = "rgba(252,255,226,.9)";
    c.lineWidth = 1.5;
    c.stroke();
  });
  make("vfx-column", 128, 1024, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 1024);
    g.addColorStop(0, "rgba(235,231,181,0)");
    g.addColorStop(0.6, "rgba(215,239,211,.05)");
    g.addColorStop(1, "rgba(255,229,165,.45)");
    c.beginPath();
    c.moveTo(10, 1024);
    c.lineTo(35, 0);
    c.lineTo(95, 0);
    c.lineTo(118, 1024);
    c.fillStyle = g;
    c.fill();
    for (let n = 0; n < 5; n++) {
      c.beginPath();
      c.moveTo(25 + n * 18, 1024);
      c.bezierCurveTo(30 + n * 16, 650, 45 + n * 10, 350, 48 + n * 8, 0);
      c.strokeStyle = g;
      c.lineWidth = 1;
      c.stroke();
    }
  });
  make("vfx-dash", 256, 96, (c) => {
    c.save();
    c.translate(128, 48);
    c.scale(1, 0.3);
    const g = c.createRadialGradient(25, 0, 0, 0, 0, 125);
    g.addColorStop(0, "rgba(225,255,224,.3)");
    g.addColorStop(0.35, "rgba(126,230,216,.13)");
    g.addColorStop(1, "rgba(126,230,216,0)");
    c.fillStyle = g;
    c.fillRect(-128, -150, 256, 300);
    c.restore();
    c.strokeStyle = "rgba(231,247,207,.45)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(10, 51);
    c.quadraticCurveTo(132, 26, 237, 48);
    c.stroke();
    c.strokeStyle = "rgba(204,191,241,.35)";
    c.beginPath();
    c.moveTo(32, 60);
    c.quadraticCurveTo(142, 70, 228, 52);
    c.stroke();
  });
}
