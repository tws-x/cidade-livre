// Som do jogo, todo sintetizado com Web Audio: nenhum arquivo para baixar.
//  - rádio do carro: estações com música gerada na hora (cada música sai diferente)
//  - motor do carro, motor do avião e explosão
import { makeRng } from './util.js';

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10] };
const T0 = 0.0001; // "zero" para rampas exponenciais

function noiseBuffer(ctx, secs = 2) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * secs, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// Estalos esparsos de disco de vinil (e um chiado bem baixinho)
function crackleBuffer(ctx, secs = 3) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * secs, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    d[i] = (Math.random() * 2 - 1) * 0.02;
    if (Math.random() < 0.0004) {
      const amp = 0.3 + Math.random() * 0.7;
      for (let k = 0; k < 30 && i + k < d.length; k++) d[i + k] += amp * (Math.random() * 2 - 1) * Math.exp(-k / 6);
    }
  }
  return buf;
}

// Envelope simples: sobe em `a` segundos até `peak` e cai até sumir em `d`
function env(param, t, peak, a, d) {
  param.setValueAtTime(T0, t);
  param.exponentialRampToValueAtTime(peak, t + a);
  param.exponentialRampToValueAtTime(T0, t + a + d);
}

// ---------- Instrumentos ----------

class Kit {
  constructor(ctx, out, noise) {
    this.ctx = ctx;
    this.out = out;
    this.noise = noise;
  }

  noiseHit(t, { freq, type = 'bandpass', q = 1, vol, decay, a = 0.002 }) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    env(g.gain, t, vol, a, decay);
    src.connect(f).connect(g).connect(this.out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + a + decay + 0.05);
  }

  tone(t, { freq, endFreq = freq, type = 'sine', vol, a = 0.002, decay, glide = decay }) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq !== freq) o.frequency.exponentialRampToValueAtTime(endFreq, t + glide);
    const g = c.createGain();
    env(g.gain, t, vol, a, decay);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + a + decay + 0.05);
  }

  kick(t, vol = 0.9) {
    this.tone(t, { freq: 150, endFreq: 42, vol, decay: 0.32, glide: 0.09 });
    this.noiseHit(t, { freq: 3000, vol: vol * 0.15, decay: 0.012 });
  }

  snare(t, vol = 0.5) {
    this.noiseHit(t, { freq: 1900, q: 0.8, vol, decay: 0.16 });
    this.tone(t, { freq: 190, endFreq: 140, type: 'triangle', vol: vol * 0.6, decay: 0.08 });
  }

  clap(t, vol = 0.45) {
    for (let k = 0; k < 3; k++) this.noiseHit(t + k * 0.011, { freq: 1300, q: 1.6, vol: vol * (k === 2 ? 1 : 0.6), decay: k === 2 ? 0.14 : 0.02 });
  }

  hat(t, vol = 0.12, open = false) {
    this.noiseHit(t, { freq: 8000, type: 'highpass', q: 0.5, vol, decay: open ? 0.16 : 0.035 });
  }

  // Sintetizador com filtro: base para baixo, acordes, melodia e arpejo
  synth(t, freqs, { type = 'sawtooth', vol, a = 0.005, decay, sustain = 0, cutoff = 1800, cutEnd = cutoff, detune = 0, out = this.out }) {
    const c = this.ctx;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(cutoff, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, cutEnd), t + a + sustain + decay);
    const g = c.createGain();
    const peak = vol / Math.sqrt(freqs.length);
    g.gain.setValueAtTime(T0, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + sustain);
    g.gain.exponentialRampToValueAtTime(T0, t + a + sustain + decay);
    f.connect(g).connect(out);
    for (const fr of freqs) {
      for (const dt of detune ? [-detune, detune] : [0]) {
        const o = c.createOscillator();
        o.type = type;
        o.frequency.value = fr;
        o.detune.value = dt;
        o.connect(f);
        o.start(t);
        o.stop(t + a + sustain + decay + 0.05);
      }
    }
  }
}

// ---------- Compositor ----------

// Acordes de cada estilo, em graus da escala (0 = tônica)
const PROGRESSIONS = {
  minor: [[0, 5, 2, 6], [0, 3, 5, 4], [0, 6, 5, 6], [5, 6, 0, 0], [0, 3, 6, 2]],
  major: [[0, 4, 5, 3], [0, 5, 3, 4], [1, 4, 0, 0], [3, 4, 2, 5], [0, 3, 1, 4]],
  dorian: [[0, 3, 0, 6], [0, 1, 3, 4], [0, 6, 3, 3]],
};

const STATIONS = [
  { name: 'Batida FM 98.1', style: 'house', bpm: [120, 126], scales: ['minor', 'dorian'], swing: 0 },
  { name: 'Lo-fi 87.5', style: 'lofi', bpm: [74, 86], scales: ['major', 'dorian'], swing: 0.22 },
  { name: 'Retrô 101.7', style: 'synthwave', bpm: [96, 108], scales: ['minor'], swing: 0 },
];

class Song {
  constructor(station, seed) {
    const r = makeRng(seed);
    this.r = r;
    this.station = station;
    this.bpm = station.bpm[0] + Math.floor(r() * (station.bpm[1] - station.bpm[0] + 1));
    this.scaleName = station.scales[Math.floor(r() * station.scales.length)];
    this.scale = SCALES[this.scaleName];
    this.root = 45 + Math.floor(r() * 12); // tônica entre A2 e G#3
    const progs = PROGRESSIONS[this.scaleName];
    this.prog = progs[Math.floor(r() * progs.length)];
    this.bars = 32;
    // Motivo de 2 compassos: passo (16 avos) -> grau relativo ao acorde (ou null)
    this.motif = this.makeMotif(r);
    this.hook = this.makeMotif(r);
    this.stabRhythm = [[2, 6, 10, 14], [0, 3, 6, 10, 12], [2, 5, 10, 13], [3, 6, 11, 14]][Math.floor(r() * 4)];
    this.bassRhythm = [[2, 6, 10, 14], [0, 3, 6, 8, 11, 14], [2, 6, 10, 13, 14]][Math.floor(r() * 3)];
  }

  makeMotif(r) {
    const notes = [];
    let deg = Math.floor(r() * 3) * 2;
    for (let s = 0; s < 32; s++) {
      const strong = s % 4 === 0;
      if (r() < (strong ? 0.6 : 0.28)) {
        deg += [-2, -1, -1, 0, 1, 1, 2, 3][Math.floor(r() * 8)];
        deg = Math.max(-2, Math.min(9, deg));
        notes.push({ s, deg, len: r() < 0.4 ? 2 : 1 });
      }
    }
    return notes;
  }

  // Nota MIDI do grau `deg` da escala, contado a partir do grau do acorde `chord`
  note(chord, deg, octave = 0) {
    const d = chord + deg;
    const n = this.scale.length;
    const o = Math.floor(d / n);
    return this.root + this.scale[((d % n) + n) % n] + 12 * (o + octave);
  }

  chordAt(bar) {
    return this.prog[Math.floor(bar / 2) % this.prog.length];
  }

  // Seção da música: intro, verso, refrão, verso com melodia, final
  section(bar) {
    if (bar < 4) return 'intro';
    if (bar < 12) return 'verse';
    if (bar < 20) return 'chorus';
    if (bar < 28) return 'verse2';
    return 'outro';
  }
}

// ---------- Rádio ----------

class Radio {
  constructor(ctx, out, noise) {
    this.ctx = ctx;
    this.noise = noise;
    // Cadeia do rádio: tira graves e agudos extremos, como alto-falante de carro
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 70;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 9000;
    this.bus.connect(hp).connect(lp).connect(out);
    // Mix da música + eco
    this.mix = ctx.createGain();
    this.mix.gain.value = 0.55;
    this.mix.connect(this.bus);
    this.delay = ctx.createDelay(1);
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    const dlp = ctx.createBiquadFilter();
    dlp.type = 'lowpass';
    dlp.frequency.value = 2500;
    this.send = ctx.createGain();
    this.send.connect(this.delay).connect(dlp).connect(fb).connect(this.delay);
    dlp.connect(wet).connect(this.mix);
    this.kit = new Kit(ctx, this.mix, noise);
    this.fxKit = new Kit(ctx, this.send, noise);
    // Chiado de vinil do lo-fi
    this.crackle = ctx.createGain();
    this.crackle.gain.value = 0;
    const cs = ctx.createBufferSource();
    cs.buffer = crackleBuffer(ctx);
    cs.loop = true;
    const cf = ctx.createBiquadFilter();
    cf.type = 'bandpass';
    cf.frequency.value = 3500;
    cf.Q.value = 0.4;
    cs.connect(cf).connect(this.crackle).connect(this.mix);
    cs.start();

    this.on = false;
    this.station = Math.floor(Math.random() * STATIONS.length);
    this.song = null;
    this.step = 0;
    this.nextTime = 0;
    this.seed = Math.floor(Math.random() * 1e9);
  }

  get name() {
    return this.station < STATIONS.length ? STATIONS[this.station].name : 'Rádio desligado';
  }

  // Liga no meio de uma música, como um rádio de verdade
  tune(at = this.ctx.currentTime) {
    const st = STATIONS[this.station];
    if (!st) {
      this.song = null;
      this.crackle.gain.setTargetAtTime(0, at, 0.1);
      return;
    }
    this.song = new Song(st, this.seed++);
    this.step = 16 * (4 + Math.floor(Math.random() * 12));
    this.nextTime = at + 0.05;
    this.crackle.gain.setTargetAtTime(st.style === 'lofi' ? 0.08 : 0, at, 0.1);
    this.delay.delayTime.setValueAtTime((60 / this.song.bpm) * 0.75, at);
  }

  setOn(on) {
    if (on === this.on) return;
    this.on = on;
    const t = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setTargetAtTime(on ? 1 : 0, t, on ? 0.15 : 0.25);
    if (on) this.tune(t);
    else this.song = null;
  }

  // Troca de estação (dir = 1 ou -1); a última posição é "desligado"
  change(dir = 1) {
    const n = STATIONS.length + 1;
    this.station = (this.station + dir + n) % n;
    const t = this.ctx.currentTime;
    // Chiado de sintonia
    const g = this.ctx.createGain();
    g.connect(this.bus);
    new Kit(this.ctx, g, this.noise).noiseHit(t, { freq: 2500, q: 0.3, vol: 0.18, decay: 0.3, a: 0.01 });
    this.tune(t + 0.3);
    return this.name;
  }

  // Agenda as notas até `until` (segundos do AudioContext)
  schedule(until) {
    if (!this.song) return;
    if (this.nextTime < this.ctx.currentTime - 0.2) this.nextTime = this.ctx.currentTime + 0.05; // aba ficou parada
    while (this.nextTime < until) {
      const song = this.song;
      const stepDur = 60 / song.bpm / 4;
      const s = this.step % 16;
      const bar = Math.floor(this.step / 16);
      const swing = s % 2 ? song.station.swing * stepDur : 0;
      this.playStep(song, bar, s, this.nextTime + swing, stepDur);
      this.nextTime += stepDur;
      this.step++;
      if (this.step >= song.bars * 16) {
        // Próxima música da mesma estação, com uma vinheta no meio
        this.jingle(this.nextTime);
        this.song = new Song(song.station, this.seed++);
        this.step = 0;
        this.nextTime += 1.2;
        this.delay.delayTime.setValueAtTime((60 / this.song.bpm) * 0.75, this.nextTime);
      }
    }
  }

  jingle(t) {
    const k = this.kit;
    [72, 76, 79, 84].forEach((m, i) => k.synth(t + i * 0.12, [mtof(m)], { type: 'triangle', vol: 0.18, decay: 0.5, cutoff: 4000 }));
    this.fxKit.synth(t + 0.36, [mtof(84)], { type: 'triangle', vol: 0.15, decay: 0.6, cutoff: 4000 });
  }

  playStep(song, bar, s, t, stepDur) {
    const k = this.kit;
    const sec = song.section(bar);
    const chord = song.chordAt(bar);
    const chordNotes = (oct, seventh) => [0, 2, 4, ...(seventh ? [6] : [])].map((d) => mtof(song.note(chord, d, oct)));
    const drums = sec !== 'intro' || bar >= 2;
    const full = sec === 'chorus' || sec === 'verse2';
    const outroFade = sec === 'outro' ? 1 - (bar - 28) / 5 : 1;
    const motif = sec === 'chorus' ? song.hook : song.motif;
    const melodyOn = full;
    const mstep = (bar % 2) * 16 + s;
    const style = song.station.style;

    if (style === 'house') {
      if (drums && s % 4 === 0 && sec !== 'outro') k.kick(t, 0.85);
      if (drums && sec !== 'intro') {
        if (s === 4 || s === 12) k.clap(t, 0.32 * outroFade);
        if (s % 4 === 2) k.hat(t, 0.1 * outroFade, true);
        else if (full && s % 2 === 1) k.hat(t, 0.04);
      }
      if (sec !== 'intro' && sec !== 'outro' && song.bassRhythm.includes(s))
        k.synth(t, [mtof(song.note(chord, 0, -1))], { type: 'sawtooth', vol: 0.32, decay: stepDur * 1.6, cutoff: 700, cutEnd: 180 });
      if (song.stabRhythm.includes(s) && sec !== 'outro') {
        k.synth(t, chordNotes(1, true), { type: 'sawtooth', vol: 0.14 * outroFade, decay: stepDur * 2.2, cutoff: 2600, cutEnd: 500, detune: 8 });
        this.fxKit.synth(t, chordNotes(1, true), { type: 'sawtooth', vol: 0.05, decay: stepDur * 2, cutoff: 2000, cutEnd: 400 });
      }
      if (melodyOn) this.melody(song, chord, motif, mstep, t, stepDur, { type: 'square', vol: 0.09, oct: 2, cutoff: 3000 });
    } else if (style === 'lofi') {
      if (drums && sec !== 'outro') {
        if (s === 0 || s === 7 || s === 10) k.kick(t, 0.65);
        if (s === 4 || s === 12) k.snare(t, 0.22);
      }
      if (drums && s % 2 === 0) k.hat(t, (s % 4 === 0 ? 0.06 : 0.035) * outroFade);
      if (s === 0 || (full && s === 8))
        k.synth(t, chordNotes(1, true), { type: 'triangle', vol: 0.22 * outroFade, a: 0.01, decay: stepDur * 7, cutoff: 1400, cutEnd: 600 });
      if (sec !== 'intro' && (s === 0 || s === 10))
        k.synth(t, [mtof(song.note(chord, s === 0 ? 0 : 4, -1))], { type: 'sine', vol: 0.4, decay: stepDur * 5, cutoff: 500 });
      if (melodyOn) this.melody(song, chord, motif, mstep, t, stepDur, { type: 'sine', vol: 0.14, oct: 2, cutoff: 2000, echo: true });
    } else {
      // synthwave
      if (drums && sec !== 'outro') {
        if (s === 0 || s === 8 || (full && s === 10)) k.kick(t, 0.8);
        if (s === 4 || s === 12) {
          k.snare(t, 0.38);
          this.fxKit.snare(t, 0.12);
        }
      }
      if (drums && s % 2 === 0) k.hat(t, 0.05 * outroFade);
      if (sec !== 'intro' && s % 2 === 0)
        k.synth(t, [mtof(song.note(chord, 0, -1))], { type: 'sawtooth', vol: 0.26 * outroFade, decay: stepDur * 1.5, cutoff: 900, cutEnd: 200 });
      if (s === 0)
        k.synth(t, chordNotes(1, false), { type: 'sawtooth', vol: 0.1 * outroFade, a: 0.25, sustain: stepDur * 12, decay: 0.6, cutoff: 1200, detune: 12 });
      if (sec === 'verse' || sec === 'intro') {
        // arpejo em 16 avos pelos tons do acorde
        const arp = [0, 2, 4, 7][s % 4];
        k.synth(t, [mtof(song.note(chord, arp, 1))], { type: 'square', vol: 0.06, decay: stepDur * 0.9, cutoff: 2400, cutEnd: 800 });
      }
      if (melodyOn) this.melody(song, chord, motif, mstep, t, stepDur, { type: 'sawtooth', vol: 0.1, oct: 2, cutoff: 2600, echo: true, detune: 6 });
    }
  }

  melody(song, chord, motif, mstep, t, stepDur, { type, vol, oct, cutoff, echo = false, detune = 0 }) {
    for (const n of motif) {
      if (n.s !== mstep) continue;
      const f = [mtof(song.note(chord, n.deg, oct - 1))];
      const opts = { type, vol, a: 0.01, decay: stepDur * (n.len * 1.8), cutoff, cutEnd: cutoff * 0.5, detune };
      this.kit.synth(t, f, opts);
      if (echo) this.fxKit.synth(t, f, { ...opts, vol: vol * 0.6 });
    }
  }
}

// ---------- Motores e efeitos ----------

class CarEngine {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 400;
    this.filter.Q.value = 3;
    this.oscs = [
      ['sawtooth', 1, 0.5],
      ['sawtooth', 1.01, 0.4],
      ['square', 0.5, 0.35],
    ].map(([type, mul, vol]) => {
      const o = ctx.createOscillator();
      o.type = type;
      const g = ctx.createGain();
      g.gain.value = vol;
      o.connect(g).connect(this.filter);
      o.start();
      return { o, mul };
    });
    this.filter.connect(this.gain).connect(out);
    this.lastSpeed = 0;
  }

  update(dt, car) {
    const t = this.ctx.currentTime;
    if (!car) {
      this.gain.gain.setTargetAtTime(0, t, 0.15);
      return;
    }
    const v = Math.abs(car.speed);
    // Marchas: a rotação sobe dentro de cada faixa de velocidade e cai na troca
    const gears = [0, 9, 17, 26, 36, 48];
    let g = 0;
    while (g < gears.length - 2 && v > gears[g + 1]) g++;
    const frac = Math.min(1, (v - gears[g]) / (gears[g + 1] - gears[g]));
    const accel = (v - this.lastSpeed) / Math.max(dt, 1e-3);
    this.lastSpeed = v;
    const load = Math.max(0, Math.min(1, accel / 8));
    const base = 32 + frac * 58 + g * 5;
    for (const { o, mul } of this.oscs) o.frequency.setTargetAtTime(base * mul, t, 0.05);
    this.filter.frequency.setTargetAtTime(300 + frac * 500 + load * 900, t, 0.08);
    this.gain.gain.setTargetAtTime(0.07 + load * 0.06 + frac * 0.03, t, 0.1);
  }
}

class JetEngine {
  constructor(ctx, out, noise) {
    this.ctx = ctx;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    this.band = ctx.createBiquadFilter();
    this.band.type = 'bandpass';
    this.band.Q.value = 0.7;
    this.band.frequency.value = 500;
    src.connect(this.band).connect(this.gain);
    this.whine = ctx.createOscillator();
    this.whine.type = 'sawtooth';
    this.whineGain = ctx.createGain();
    this.whineGain.gain.value = 0;
    const wl = ctx.createBiquadFilter();
    wl.type = 'lowpass';
    wl.frequency.value = 1500;
    this.whine.connect(wl).connect(this.whineGain).connect(this.gain);
    this.gain.connect(out);
    src.start();
    this.whine.start();
  }

  update(plane) {
    const t = this.ctx.currentTime;
    if (!plane) {
      this.gain.gain.setTargetAtTime(0, t, 0.3);
      return;
    }
    const thr = plane.throttle;
    const wind = Math.min(1, plane.speed / 120);
    this.band.frequency.setTargetAtTime(350 + thr * 1100 + wind * 400, t, 0.2);
    this.whine.frequency.setTargetAtTime(180 + thr * 520, t, 0.3);
    this.whineGain.gain.setTargetAtTime(0.02 + thr * 0.05, t, 0.2);
    this.gain.gain.setTargetAtTime(0.1 + thr * 0.35 + wind * 0.15, t, 0.2);
  }
}

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  // Precisa vir de um clique ou tecla (regra dos navegadores para tocar som)
  start() {
    if (this.ctx) return this.ctx.resume();
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    const noise = noiseBuffer(ctx);
    this.noise = noise;
    this.radio = new Radio(ctx, this.master, noise);
    this.car = new CarEngine(ctx, this.master);
    this.jet = new JetEngine(ctx, this.master, noise);
    // Alguns navegadores só liberam o som depois de um gesto "de verdade"
    const resume = () => ctx.state !== 'running' && ctx.resume();
    addEventListener('keydown', resume);
    addEventListener('pointerdown', resume);
  }

  update(dt, { mode, car, plane }) {
    if (!this.ctx) return;
    this.car.update(dt, mode === 'car' ? car : null);
    this.jet.update(mode === 'plane' && !plane.crashed ? plane : null);
    this.radio.setOn(mode === 'car');
    this.radio.schedule(this.ctx.currentTime + 0.3);
  }

  // Troca a estação; devolve o nome para mostrar na tela
  nextStation(dir = 1) {
    if (!this.ctx || !this.radio.on) return null;
    return this.radio.change(dir);
  }

  get stationName() {
    return this.radio?.name;
  }

  toggleMute() {
    if (!this.ctx) return false;
    this.muted = !this.muted;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  explosion() {
    if (!this.ctx) return;
    const k = new Kit(this.ctx, this.master, this.noise);
    const t = this.ctx.currentTime;
    k.noiseHit(t, { freq: 900, type: 'lowpass', q: 0.7, vol: 0.9, decay: 2.2, a: 0.005 });
    k.tone(t, { freq: 90, endFreq: 28, vol: 0.9, decay: 1.6, glide: 1.2 });
  }
}

// Para testes: grava uma estação num OfflineAudioContext
export function renderStation(ctx, station, seconds, seed = 1, startBar = 0) {
  const radio = new Radio(ctx, ctx.destination, noiseBuffer(ctx));
  radio.seed = seed;
  radio.station = station;
  radio.on = true;
  radio.bus.gain.value = 1;
  radio.tune(0);
  radio.step = startBar * 16;
  radio.schedule(seconds);
  return STATIONS[station].name;
}
