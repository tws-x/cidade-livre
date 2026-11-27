import { GRID, ROAD, BLOCK, HALF, AIRPORT, APRON, FARM, roadCoord } from './config.js';

const HELP = {
  keyboard: {
    foot: '<b>A pé</b><br>WASD andar · Shift correr · Espaço pular<br>Mouse gira a câmera (ou arraste)<br>F entrar em carro ou avião<br>G qualidade dos gráficos · H dia / pôr do sol / noite · M som',
    car: '<b>Dirigindo</b><br>W acelerar · S frear / ré<br>A / D virar · Espaço freio de mão<br>R troca a rádio · F sair do carro',
    plane:
      '<b>Pilotando</b><br>W / S mais / menos motor<br>↑ / ↓ levantar / baixar o nariz<br>← / → inclinar (faz a curva)<br>A / D leme · Espaço freio no chão<br>Acelere e puxe ↑ para decolar: caça e jato ~200 km/h, comercial ~220, 747 ~250<br>F sair (parado no chão)',
  },
  gamepad: {
    foot: '<b>A pé</b><br>Stick esquerdo andar · B (○) correr · A (✕) pular<br>Stick direito gira a câmera<br>Y (△) entrar em carro ou avião<br>Cruz ↓ qualidade · Select ou Cruz ↑ dia / noite',
    car: '<b>Dirigindo</b><br>RT (R2) acelerar · LT (L2) frear / ré<br>Stick esquerdo virar · B (○) freio de mão<br>Stick direito olha em volta<br>Cruz ← → troca a rádio · Y (△) sair do carro',
    plane:
      '<b>Pilotando</b><br>RT / LT (R2 / L2) mais / menos motor<br>Stick esquerdo: ↑ ↓ nariz · ← → inclinar<br>LB / RB (L1 / R1) leme · A (✕) freio no chão<br>Acelere e puxe o stick para cima para decolar<br>Y (△) sair (parado no chão)',
  },
  tv: {
    foot: '<b>A pé</b><br>↑ andar / correr · ↓ devagar / parar<br>← → virar<br>OK entrar em carro ou avião<br>1 / vermelho dia / noite · 2 / verde gráficos<br>4 / azul liga / desliga o som',
    car: '<b>Dirigindo</b> (piloto automático)<br>↑ acelerar · ↓ frear / ré<br>← → virar · 3 / amarelo troca a rádio<br>OK sair do carro (devagar)',
    plane:
      '<b>Pilotando</b><br>No chão: segure ↑ para acelerar e decolar · ↓ frear · ← → guiar<br>No ar: ↑ ↓ nariz · ← → curva (motor no máximo)<br>Para pousar, segure ↓ até tocar o chão e parar<br>OK sair (parado no chão)',
  },
};

const MAP = 180;
const SCALE = 0.45; // pixels por metro

export class Hud {
  constructor() {
    this.hud = document.getElementById('hud');
    this.stats = document.getElementById('stats');
    this.prompt = document.getElementById('prompt');
    this.toastEl = document.getElementById('toast');
    this.ctx = document.getElementById('minimap').getContext('2d');
    this.mode = null;
    this.device = null;
    this.toastTimer = 0;
  }

  toast(text, secs = 2.5) {
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = 1;
    this.toastTimer = secs;
  }

  showPrompt(text) {
    this.prompt.style.display = text ? 'block' : 'none';
    if (text) this.prompt.textContent = text;
  }

  update(dt, { device = 'keyboard', mode, car, plane, planes, focus, heading, cars }) {
    if (mode !== this.mode || device !== this.device) {
      this.mode = mode;
      this.device = device;
      this.hud.innerHTML = HELP[device][mode];
    }
    if (mode === 'car') this.stats.innerHTML = `${Math.round(Math.abs(car.speed) * 3.6)} <small>km/h</small>`;
    else if (mode === 'plane') {
      this.stats.innerHTML =
        `${Math.round(plane.speed * 3.6)} <small>km/h</small><br>` +
        `${Math.round(plane.pos.y)} <small>m de altura</small><br>` +
        `<small>Motor ${Math.round(plane.throttle * 100)}%</small>`;
    } else this.stats.innerHTML = '';

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.style.opacity = 0;
    }
    this.drawMap(focus, heading, cars, planes);
  }

  // Minimapa com o norte para cima, centrado no jogador
  drawMap(focus, heading, cars, planes) {
    const ctx = this.ctx;
    const c = MAP / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#5d8a3e';
    ctx.fillRect(0, 0, MAP, MAP);

    ctx.save();
    ctx.translate(c, c);
    ctx.scale(SCALE, SCALE);
    ctx.translate(-focus.x, -focus.z);
    ctx.fillStyle = '#3a3c40';
    ctx.fillRect(-HALF - ROAD / 2, -HALF - ROAD / 2, HALF * 2 + ROAD, HALF * 2 + ROAD);
    ctx.fillRect(HALF, APRON.z - ROAD / 2, APRON.x - HALF, ROAD);
    for (const rx of AIRPORT.runways) ctx.fillRect(rx - AIRPORT.width / 2, AIRPORT.z - AIRPORT.length / 2, AIRPORT.width, AIRPORT.length);
    ctx.fillStyle = '#55585c';
    ctx.fillRect(APRON.x - APRON.w / 2, APRON.z - APRON.d / 2, APRON.w, APRON.d);
    ctx.fillStyle = '#b89a62';
    ctx.fillRect(FARM.minX, FARM.minZ, FARM.maxX - FARM.minX, FARM.maxZ - FARM.minZ);
    ctx.fillStyle = '#a9a79f';
    for (let i = 0; i < GRID; i++) {
      for (let j = 0; j < GRID; j++) ctx.fillRect(roadCoord(i) + ROAD / 2, roadCoord(j) + ROAD / 2, BLOCK, BLOCK);
    }
    ctx.fillStyle = '#eeeeee';
    for (const car of cars) ctx.fillRect(car.pos.x - 3, car.pos.z - 3, 6, 6);
    ctx.restore();

    // Ícones dos aviões, presos na borda quando estão fora do mapa
    ctx.font = '18px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    for (const plane of planes) {
      let px = (plane.pos.x - focus.x) * SCALE;
      let pz = (plane.pos.z - focus.z) * SCALE;
      const d = Math.hypot(px, pz);
      if (d > c - 12) {
        px *= (c - 12) / d;
        pz *= (c - 12) / d;
      }
      ctx.fillText('✈', c + px, c + pz);
    }

    // Seta do jogador: o canvas gira no sentido horário, por isso π − heading
    ctx.translate(c, c);
    ctx.rotate(Math.PI - heading);
    ctx.fillStyle = '#ffd54a';
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 7);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
