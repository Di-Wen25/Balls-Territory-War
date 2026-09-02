class BattleEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');

    this.projectiles = [];
    this.bigBalls = [];
    this.bases = [];
    this.grid = [];
    this.gridTimeMap = []; // 領土佔領時間戳 (用於脈衝光暈)

    this.resize();
    this.initBases();
    this.initGrid();

    globalBus.on('skill_triggered', e => this.handleSkill(e));
  }

  resize() {
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  initGrid() {
    this.res = GAME_CONFIG.gridResolution;
    this.cellW = this.width / this.res;
    this.cellH = this.height / this.res;
    this.grid = Array.from({ length: this.res }, () => new Array(this.res).fill(-1));
    this.gridTimeMap = Array.from({ length: this.res }, () => new Array(this.res).fill(0));
  }

  initBases() {
    const p = 80;
    this.bases = [
      { id: 0, x: p, y: p, shield: GAME_CONFIG.initShield, gun: 100 },
      { id: 1, x: this.width - p, y: p, shield: GAME_CONFIG.initShield, gun: 100 },
      { id: 2, x: p, y: this.height - p, shield: GAME_CONFIG.initShield, gun: 100 },
      { id: 3, x: this.width - p, y: this.height - p, shield: GAME_CONFIG.initShield, gun: 100 }
    ];
  }

  handleSkill(e) {
    const base = this.bases.find(b => b.id === e.factionId);
    if (!base) return;

    if (e.skill === 'shield') base.shield += e.value;
    if (e.skill === 'gun') base.gun += e.value;
    if (e.skill === 'bigball') {
      this.bigBalls.push({
        factionId: base.id,
        x: base.x, y: base.y,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        hp: e.value * 10
      });
    }
  }

  update() {
    // 基地自動根據 Gun 數值持續發射常規子彈
    this.bases.forEach(b => {
      if (Math.random() < 0.15) {
        const angle = Math.random() * Math.PI * 2;
        this.projectiles.push({
          factionId: b.id,
          x: b.x, y: b.y,
          vx: Math.cos(angle) * 4,
          vy: Math.sin(angle) * 4,
          power: b.gun / 10
        });
      }
    });

    // 1. 常規子彈更新 (含邊界碰撞反射)
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      let p = this.projectiles[i];
      p.x += p.vx;
      p.y += p.vy;

      // 牆壁反彈機制
      if (p.x < 0 || p.x > this.width) p.vx *= -1;
      if (p.y < 0 || p.y > this.height) p.vy *= -1;

      // 染色領土
      let gx = Math.floor(p.x / this.cellW);
      let gy = Math.floor(p.y / this.cellH);
      if (gx >= 0 && gx < this.res && gy >= 0 && gy < this.res) {
        if (this.grid[gy][gx] !== p.factionId) {
          this.grid[gy][gx] = p.factionId;
          this.gridTimeMap[gy][gx] = Date.now(); // 記錄佔領時間點
        }
      }
    }

    // 2. 大球 HP 實體更新 (撞擊敵方子彈 / 地面扣血並縮小)
    for (let i = this.bigBalls.length - 1; i >= 0; i--) {
      let bb = this.bigBalls[i];
      bb.x += bb.vx;
      bb.y += bb.vy;

      // 牆壁反彈
      if (bb.x < 0 || bb.x > this.width) bb.vx *= -1;
      if (bb.y < 0 || bb.y > this.height) bb.vy *= -1;

      // 計算動態大小 Size
      bb.radius = Math.min(45, Math.max(12, Math.sqrt(bb.hp) * 0.1));

      // 染色領土與扣血
      let gx = Math.floor(bb.x / this.cellW);
      let gy = Math.floor(bb.y / this.cellH);
      if (gx >= 0 && gx < this.res && gy >= 0 && gy < this.res) {
        if (this.grid[gy][gx] !== bb.factionId) {
          this.grid[gy][gx] = bb.factionId;
          this.gridTimeMap[gy][gx] = Date.now();
          bb.hp -= 5; // 侵蝕敵方土地扣除 HP
        }
      }

      if (bb.hp <= 0) this.bigBalls.splice(i, 1);
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    const now = Date.now();

    // 1. 繪製高密度領土網格 (含新佔領邊界光暈衰減效果)
    for (let r = 0; r < this.res; r++) {
      for (let c = 0; c < this.res; c++) {
        let owner = this.grid[r][c];
        if (owner !== -1) {
          let age = now - this.gridTimeMap[r][c];
          let glow = Math.max(0, 1 - age / 1000); // 1秒內漸暗
          this.ctx.fillStyle = FACTIONS[owner].color;
          this.ctx.globalAlpha = 0.3 + glow * 0.5;
          this.ctx.fillRect(c * this.cellW, r * this.cellH, this.cellW + 0.5, this.cellH + 0.5);
        }
      }
    }
    this.ctx.globalAlpha = 1.0;

    // 2. 繪製基地 UI (護盾與槍力)
    for (let b of this.bases) {
      let fac = FACTIONS[b.id];
      this.ctx.strokeStyle = fac.color;
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.arc(b.x, b.y, 42, 0, Math.PI * 2);
      this.ctx.stroke();

      // UI 數值
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 12px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`🛡️ ${BigNum.format(b.shield)}`, b.x, b.y - 6);
      this.ctx.fillText(`🔫 ${BigNum.format(b.gun)}`, b.x, b.y + 12);
    }

    // 3. 繪製大球 HP 實體
    for (let bb of this.bigBalls) {
      let fac = FACTIONS[bb.factionId];
      this.ctx.fillStyle = fac.color;
      this.ctx.beginPath();
      this.ctx.arc(bb.x, bb.y, bb.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = '#fff';
      this.ctx.stroke();

      // HP 標籤
      this.ctx.fillStyle = '#fff';
      this.ctx.font = 'bold 10px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(BigNum.format(bb.hp), bb.x, bb.y + 3);
    }

    // 4. 繪製常規子彈
    for (let p of this.projectiles) {
      this.ctx.fillStyle = FACTIONS[p.factionId].color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
}