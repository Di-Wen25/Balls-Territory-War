class PinballEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.balls = [];
    this.pegs = [];
    this.multipliers = [];
    this.resize();

    this.initBoard();
    this.spawnBalls();
  }

  resize() {
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  initBoard() {
    // 建立釘子障礙陣列
    this.pegs = [];
    const rows = 10, cols = 8;
    for (let r = 2; r < rows; r++) {
      for (let c = 1; c < cols; c++) {
        let offset = (r % 2 === 0) ? 0 : (this.width / cols) / 2;
        this.pegs.push({
          x: c * (this.width / cols) + offset,
          y: r * (this.height / (rows + 4)) + 40,
          r: 3
        });
      }
    }

    // 上方兩側倍率升級入口 (X8, X4, X2)
    const slotW = 32, slotH = 40;
    const yPos = this.height * 0.35;
    this.multipliers = [
      { x: 10, y: yPos, w: slotW, h: slotH, mult: 8, label: 'X8' },
      { x: 45, y: yPos, w: slotW, h: slotH, mult: 4, label: 'X4' },
      { x: 80, y: yPos, w: slotW, h: slotH, mult: 2, label: 'X2' },
      { x: this.width - 112, y: yPos, w: slotW, h: slotH, mult: 2, label: 'X2' },
      { x: this.width - 77, y: yPos, w: slotW, h: slotH, mult: 4, label: 'X4' },
      { x: this.width - 42, y: yPos, w: slotW, h: slotH, mult: 8, label: 'X8' }
    ];
  }

  spawnBalls() {
    FACTIONS.forEach(f => {
      for (let i = 0; i < 2; i++) {
        this.balls.push({
          faction: f,
          x: Math.random() * (this.width - 40) + 20, // X 軸隨機生成
          y: Math.random() * -100,
          vx: (Math.random() - 0.5) * 1.5,
          vy: 0,
          value: 1000,
          history: []
        });
      }
    });
  }

  update() {
    const windYStart = this.height * 0.35;
    const windYEnd = this.height * 0.55;

    for (let b of this.balls) {
      // 記錄軌跡尾巴
      b.history.push({ x: b.x, y: b.y });
      if (b.history.length > 5) b.history.shift();

      // 體積與質量計算：數值越大，質量越大
      const mass = Math.pow(Math.log10(b.value + 1), 1.8);
      const radius = Math.min(18, Math.max(7, Math.log10(b.value) * 3));
      b.r = radius;

      // 1. 重力作用
      b.vy += GAME_CONFIG.gravity;

      // 2. 中央風洞上升氣流作用 (數值小/質量輕的彈珠會被向上吹)
      if (b.y > windYStart && b.y < windYEnd) {
        const windPush = (GAME_CONFIG.windForce * 10) / mass;
        b.vy -= windPush;
      }

      // 限速防穿牆
      b.vx = Math.max(-5, Math.min(5, b.vx));
      b.vy = Math.max(-6, Math.min(6, b.vy));

      b.x += b.vx;
      b.y += b.vy;

      // 牆壁碰撞
      if (b.x - b.r < 0) { b.x = b.r; b.vx *= -0.7; }
      if (b.x + b.r > this.width) { b.x = this.width - b.r; b.vx *= -0.7; }

      // 釘子碰撞
      for (let p of this.pegs) {
        let dx = b.x - p.x, dy = b.y - p.y;
        let dist = Math.hypot(dx, dy);
        if (dist < b.r + p.r) {
          let angle = Math.atan2(dy, dx);
          b.vx = Math.cos(angle) * 2;
          b.vy = Math.sin(angle) * 2;
        }
      }

      // 進倍率區 -> 數值加倍 -> 彈回頂部 X 軸隨機重置
      for (let m of this.multipliers) {
        if (b.x > m.x && b.x < m.x + m.w && b.y > m.y && b.y < m.y + m.h) {
          b.value *= m.mult;
          b.y = -20;
          b.x = Math.random() * (this.width - 40) + 20; // 再次於 X 軸隨機生成
          b.vy = 0;
          break;
        }
      }

      // 突破風洞落入底部技能槽
      if (b.y > this.height) {
        const slotIdx = Math.floor((b.x / this.width) * 5);
        const skills = ['storm', 'gun', 'shield', 'bigball', 'sniper'];

        globalBus.emit('skill_triggered', {
          factionId: b.faction.id,
          skill: skills[slotIdx],
          value: b.value
        });

        // 技能觸發後重置彈珠
        b.y = -30;
        b.x = Math.random() * (this.width - 40) + 20;
        b.vy = 0;
        b.value = 1000;
      }
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 繪製背景網格
    this.ctx.strokeStyle = '#111827';
    this.ctx.lineWidth = 1;
    for (let x = 0; x < this.width; x += 30) {
      this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.height); this.ctx.stroke();
    }

    // 繪製中央風洞向上箭頭氣流特效
    const windY = this.height * 0.45;
    this.ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    this.ctx.fillRect(0, windY - 20, this.width, 40);
    this.ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
    this.ctx.font = '12px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('↑ ↑ ↑ 上升氣流風洞推力區 ↑ ↑ ↑', this.width / 2, windY + 4);

    // 繪製倍率區
    for (let m of this.multipliers) {
      this.ctx.strokeStyle = '#38bdf8';
      this.ctx.strokeRect(m.x, m.y, m.w, m.h);
      this.ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      this.ctx.fillRect(m.x, m.y, m.w, m.h);
      this.ctx.fillStyle = '#38bdf8';
      this.ctx.font = 'bold 12px sans-serif';
      this.ctx.fillText(m.label, m.x + m.w / 2, m.y + m.h / 2 + 4);
    }

    // 繪製障礙釘
    this.ctx.fillStyle = '#475569';
    for (let p of this.pegs) {
      this.ctx.beginPath(); this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); this.ctx.fill();
    }

    // 繪製彈珠 (含數值文字居中與軌跡尾巴)
    for (let b of this.balls) {
      // 尾跡
      for (let i = 0; i < b.history.length; i++) {
        let pt = b.history[i];
        this.ctx.fillStyle = b.faction.glow;
        this.ctx.beginPath();
        this.ctx.arc(pt.x, pt.y, b.r * (i / b.history.length), 0, Math.PI * 2);
        this.ctx.fill();
      }

      // 主體
      this.ctx.fillStyle = b.faction.color;
      this.ctx.beginPath();
      this.ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      // 數值居中
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 9px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(BigNum.format(b.value), b.x, b.y);
    }
  }
}