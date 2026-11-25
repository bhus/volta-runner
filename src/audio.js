// Procedural Web Audio API chiptune synthesizer (Apple II + NES Mega Man style)
// Includes iOS Safari / Mobile Chrome touch-gesture unlock & master gain stage.

export class RetroAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.unlocked = false;
    this.sfxEnabled = true;
    this.musicEnabled = true;
    this.musicTimer = null;
    this.step = 0;
    this.isBoss = false;
  }

  unlock() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.setValueAtTime(0.85, this.ctx.currentTime);
      this.master.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    // iOS Safari / Mobile Chrome silent buffer unlock
    if (!this.unlocked) {
      try {
        const buf = this.ctx.createBuffer(1, 1, 22050);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(this.master);
        src.start(0);
        this.unlocked = true;
      } catch {
        // ignore if not ready yet
      }
    }

    if (this.musicEnabled && !this.musicTimer) {
      this.startMusic();
    }
  }

  setSfx(on) {
    this.sfxEnabled = on;
    if (on) this.unlock();
  }

  setMusic(on) {
    this.musicEnabled = on;
    if (on) {
      this.unlock();
      this.startMusic();
    } else {
      this.stopMusic();
    }
  }

  setBossMode(isBoss) {
    this.isBoss = isBoss;
  }

  tone(freq, dur, type = 'square', vol = 0.14, slideTo = null, delay = 0) {
    if (!this.sfxEnabled || !this.ctx || !this.master) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(30, freq), now);
    if (slideTo !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), now + dur);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.015);
  }

  noise(dur, vol = 0.16, filterFreq = 1200, delay = 0) {
    if (!this.sfxEnabled || !this.ctx || !this.master) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    const now = this.ctx.currentTime + delay;
    const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(now);
    src.stop(now + dur + 0.015);
  }

  play(name) {
    if (!this.sfxEnabled || !this.ctx) return;
    switch (name) {
      case 'jump':
        this.tone(240, 0.13, 'square', 0.13, 560);
        break;
      case 'slide':
        this.noise(0.14, 0.12, 900);
        this.tone(320, 0.12, 'triangle', 0.12, 150);
        break;
      case 'buster':
        this.tone(880, 0.075, 'square', 0.13, 290);
        break;
      case 'chargeShot':
        this.tone(260, 0.22, 'sawtooth', 0.18, 980);
        this.tone(520, 0.22, 'square', 0.14, 120);
        this.noise(0.12, 0.14, 1600);
        break;
      case 'axeThrow':
        this.tone(420, 0.09, 'triangle', 0.16, 680);
        this.tone(680, 0.09, 'triangle', 0.13, 360, 0.07);
        break;
      case 'dig':
        this.noise(0.14, 0.18, 650);
        this.tone(220, 0.12, 'square', 0.14, 70);
        break;
      case 'brickRegen':
        this.tone(180, 0.09, 'square', 0.09, 340);
        break;
      case 'gold':
        this.tone(784, 0.07, 'square', 0.14);
        this.tone(1046.5, 0.12, 'square', 0.14, null, 0.06);
        break;
      case 'powerup':
        [523, 659, 784, 1046].forEach((f, i) =>
          this.tone(f, 0.08, 'square', 0.13, null, i * 0.055)
        );
        break;
      case 'boloCannon':
        this.noise(0.24, 0.22, 420);
        this.tone(150, 0.22, 'sawtooth', 0.18, 45);
        break;
      case 'turretFire':
        this.tone(520, 0.09, 'sawtooth', 0.11, 190);
        break;
      case 'enemyHit':
        this.tone(440, 0.06, 'square', 0.13, 220);
        this.noise(0.05, 0.11, 1800);
        break;
      case 'enemyDie':
        this.noise(0.18, 0.18, 800);
        this.tone(340, 0.18, 'sawtooth', 0.15, 65);
        break;
      case 'playerHit':
        this.noise(0.2, 0.2, 500);
        this.tone(240, 0.24, 'sawtooth', 0.18, 75);
        break;
      case 'volta':
        this.noise(0.16, 0.14, 2800);
        this.tone(920, 0.12, 'sawtooth', 0.1, 340);
        break;
      case 'portalOpen':
        [440, 554, 659, 880, 1108].forEach((f, i) =>
          this.tone(f, 0.11, 'square', 0.14, null, i * 0.07)
        );
        break;
      case 'levelWin':
        [523, 659, 784, 659, 1046].forEach((f, i) =>
          this.tone(f, 0.13, 'square', 0.15, null, i * 0.09)
        );
        break;
      case 'gameOver':
        [392, 349, 311, 261].forEach((f, i) =>
          this.tone(f, 0.22, 'sawtooth', 0.15, null, i * 0.18)
        );
        break;
    }
  }

  startMusic() {
    if (this.musicTimer || !this.musicEnabled) return;
    const normalLead = [
      330, 0, 392, 440, 494, 0, 440, 392,
      330, 392, 523, 494, 440, 0, 392, 0,
      294, 0, 349, 392, 440, 0, 392, 349,
      330, 0, 294, 247, 220, 0, 247, 294,
    ];
    const normalBass = [
      110, 110, 165, 110, 110, 110, 165, 147,
      131, 131, 196, 131, 110, 110, 147, 131,
      98, 98, 147, 98, 98, 98, 147, 131,
      110, 110, 131, 147, 110, 110, 165, 147,
    ];
    const bossLead = [
      220, 233, 220, 330, 220, 233, 392, 349,
      330, 0, 294, 261, 233, 220, 196, 220,
    ];
    const bossBass = [
      110, 110, 117, 110, 110, 110, 131, 117,
      110, 110, 147, 131, 117, 110, 98, 110,
    ];

    this.musicTimer = setInterval(() => {
      if (!this.musicEnabled || !this.ctx || !this.master || this.ctx.state !== 'running') return;
      const lead = this.isBoss ? bossLead : normalLead;
      const bass = this.isBoss ? bossBass : normalBass;
      const i = this.step % lead.length;
      const lf = lead[i];
      const bf = bass[i];
      if (lf > 0) this._musicNote(lf, 0.11, 'square', 0.055);
      if (bf > 0) this._musicNote(bf, 0.12, 'triangle', 0.095);
      if (this.step % 4 === 2) {
        this._musicHat();
      }
      this.step++;
    }, 145);
  }

  _musicNote(freq, dur, type, vol) {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.01);
  }

  _musicHat() {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.03);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(6000, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.032, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
    src.connect(hp);
    hp.connect(gain);
    gain.connect(this.master);
    src.start(now);
    src.stop(now + 0.035);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
