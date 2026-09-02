/**
 * 大數格式化類別
 */
class BigNum {
  static UNITS = ['', 'K', 'M', 'G', 'T', 'P', 'E'];

  static format(num) {
    if (num < 1000) return Math.floor(num).toString();
    const exp = Math.min(Math.floor(Math.log10(num) / 3), BigNum.UNITS.length - 1);
    const scaled = num / Math.pow(10, exp * 3);
    return `${scaled.toFixed(1)}${BigNum.UNITS[exp]}`;
  }
}

/**
 * 遊戲主要控制引擎
 */
class MarbleWarEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.width = this.canvas.width;
    this.height = this.canvas.height;

    // 網格領土參數 (50x40 網格)
    this.cols = 50;
    this.rows = 40;
    this.cellWidth = this.width / this.cols;
    this.cellHeight = (this.height - 150) / this.rows; // 留出上方數學門賽道

    this.players = [];
    this.marbles = [];
    this.gates = [];
    this.grid = []; // 領土權屬記錄

    this.isRunning = false;
    this.simulationSpeed = 1;
    this.maxMarbles = 100;
    this.splitMode = false;
    this.startTime = 0;

    // 錄影相關
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordedBlob = null;

    this.initDefaultPlayers();
    this.initGates();
    this.resetGrid();
  }

  initDefaultPlayers() {
    this.players = [
      { id: 'p1', name: '紅隊勇士', color: '#ff4d4d', avatar: null, kills: 0, peakSize: 10 },
      { id: 'p2', name: '藍隊領主', color: '#4d94ff', avatar: null, kills: 0, peakSize: 10 },
      { id: 'p3', name: '綠隊幻影', color: '#4dff88', avatar: null, kills: 0, peakSize: 10 },
      { id: 'p4', name: '黃隊霸主', color: '#ffff4d', avatar: null, kills: 0, peakSize: 10 }
    ];
  }

  resetGrid() {
    this.grid = Array(this.rows).fill(null).map(() => Array(this.cols).fill(null));
  }

  initGates() {
    // 設置兩條上方通道上的數學門
    this.gates = [
      { x: this.width * 0.25 - 40, y: 50, w: 80, h: 20, op: '*', val: 2, text: 'x2' },
      { x: this.width * 0.75 - 40, y: 50, w: 80, h: 20, op: '+', val: 50, text: '+50' },
      { x: this.width * 0.25 - 40, y: 100, w: 80, h: 20, op: '+', val: 500, text: '+500' },
      { x: this.width * 0.75 - 40, y: 100, w: 80, h: 20, op: '*', val: 1.5, text: 'x1.5' }
    ];
  }

  spawnMarble(player) {
    const laneX = (player.id === 'p1' || player.id === 'p3') ? this.width * 0.25 : this.width * 0.75;
    this.marbles.push({
      id: Math.random().toString(36).substring(2, 9),
      playerId: player.id,
      color: player.color,
      x: laneX + (Math.random() * 20 - 10),
      y: 10,
      vx: (Math.random() - 0.5) * 2,
      vy: 2 + Math.random() * 2,
      size: 10,
      radius: 8,
      lastGateTime: 0
    });
  }

  startSimulation(activePlayerCount, splitMode, maxMarbles, speed) {
    this.activePlayers = this.players.slice(0, activePlayerCount);
    this.splitMode = splitMode;
    this.maxMarbles = maxMarbles;
    this.simulationSpeed = speed;
    this.marbles = [];
    this.resetGrid();
    this.isRunning = true;
    this.startTime = Date.now();

    // 啟動 Canvas 串流錄製管線
    this.startRecording();

    // 每位活躍玩家先發射初始彈珠
    this.activePlayers.forEach(p => {
      p.kills = 0;
      p.peakSize = 10;
      this.spawnMarble(p);
    });

    this.loop();
  }

  startRecording() {
    this.recordedChunks = [];
    const stream = this.canvas.captureStream(60); // 60 FPS 幀率捕捉
    this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      this.recordedBlob = new Blob(this.recordedChunks, { type: 'video/mp4' });
      document.getElementById('export-video-btn').disabled = false;
      document.getElementById('modal-download-btn').disabled = false;
    };

    this.mediaRecorder.start();
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  update() {
    // 根據模擬速度多次推進邏輯
    for (let s = 0; s < this.simulationSpeed; s++) {
      this.updatePhysics();
    }
    this.checkGameOver();
  }

  updatePhysics() {
    // 自動補彈
    if (this.marbles.length < this.activePlayers.length * 2 && this.marbles.length < this.maxMarbles) {
      if (Math.random() < 0.05) {
        const randomPlayer = this.activePlayers[Math.floor(Math.random() * this.activePlayers.length)];
        this.spawnMarble(randomPlayer);
      }
    }

    for (let i = this.marbles.length - 1; i >= 0; i--) {
      const m = this.marbles[i];
      m.x += m.vx;
      m.y += m.vy;

      // 邊界碰撞
      if (m.x - m.radius < 0 || m.x + m.radius > this.width) m.vx *= -1;
      if (m.y - m.radius < 0) m.vy *= -1;

      // 通過數學門
      const now = Date.now();
      if (now - m.lastGateTime > 300) {
        for (const gate of this.gates) {
          if (m.x > gate.x && m.x < gate.x + gate.w && m.y > gate.y && m.y < gate.y + gate.h) {
            if (gate.op === '+') m.size += gate.val;
            if (gate.op === '*') m.size *= gate.val;
            m.lastGateTime = now;
            
            // 更新玩家體積峰值紀錄
            const owner = this.players.find(p => p.id === m.playerId);
            if (owner && m.size > owner.peakSize) owner.peakSize = m.size;
            break;
          }
        }
      }

      // 進入下方戰場領土區域
      if (m.y > 150) {
        // 底部反彈
        if (m.y + m.radius > this.height) {
          m.vy *= -0.8;
          m.y = this.height - m.radius;
        }

        // 領土染色與縮小機制
        const gridX = Math.floor(m.x / this.cellWidth);
        const gridY = Math.floor((m.y - 150) / this.cellHeight);

        if (gridX >= 0 && gridX < this.cols && gridY >= 0 && gridY < this.rows) {
          const currentCellOwner = this.grid[gridY][gridX];
          if (currentCellOwner !== m.playerId) {
            this.grid[gridY][gridX] = m.playerId;
            // 擴張領土會消耗彈珠體積
            m.size = Math.max(1, m.size - 0.5);
          }
        }
      }

      // 彈珠間碰撞檢測
      for (let j = i - 1; j >= 0; j--) {
        const m2 = this.marbles[j];
        const dx = m2.x - m.x;
        const dy = m2.y - m.y;
        const dist = Math.hypot(dx, dy);

        if (dist < m.radius + m2.radius) {
          // 異隊碰撞
          if (m.playerId !== m2.playerId) {
            if (m.size >= m2.size) {
              m.size -= m2.size;
              this.players.find(p => p.id === m.playerId).kills++;
              this.marbles.splice(j, 1);
              if (this.splitMode && m.size > 50) this.splitMarble(m);
            } else {
              m2.size -= m.size;
              this.players.find(p => p.id === m2.playerId).kills++;
              this.marbles.splice(i, 1);
              if (this.splitMode && m2.size > 50) this.splitMarble(m2);
              break;
            }
          }
        }
      }

      // 更新半徑視覺反饋
      m.radius = Math.min(25, Math.max(6, Math.log10(m.size + 1) * 5));
    }
  }

  splitMarble(m) {
    if (this.marbles.length >= this.maxMarbles) return;
    m.size /= 2;
    this.marbles.push({
      ...m,
      id: Math.random().toString(36).substring(2, 9),
      vx: -m.vx + (Math.random() - 0.5),
      vy: -m.vy + (Math.random() - 0.5)
    });
  }

  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 1. 繪製頂部數學門賽道區
    this.ctx.fillStyle = '#161b22';
    this.ctx.fillRect(0, 0, this.width, 150);

    for (const gate of this.gates) {
      this.ctx.fillStyle = '#1f6feb';
      this.ctx.fillRect(gate.x, gate.y, gate.w, gate.h);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 12px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(gate.text, gate.x + gate.w / 2, gate.y + 14);
    }

    // 2. 繪製領土網格
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ownerId = this.grid[r][c];
        if (ownerId) {
          const owner = this.players.find(p => p.id === ownerId);
          this.ctx.fillStyle = owner ? owner.color : '#000';
          this.ctx.fillRect(c * this.cellWidth, 150 + r * this.cellHeight, this.cellWidth, this.cellHeight);
        }
      }
    }

    // 繪製網格邊線
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.beginPath();
    for (let i = 0; i <= this.cols; i++) {
      this.ctx.moveTo(i * this.cellWidth, 150);
      this.ctx.lineTo(i * this.cellWidth, this.height);
    }
    for (let j = 0; j <= this.rows; j++) {
      this.ctx.moveTo(0, 150 + j * this.cellHeight);
      this.ctx.lineTo(this.width, 150 + j * this.cellHeight);
    }
    this.ctx.stroke();

    // 3. 繪製彈珠
    for (const m of this.marbles) {
      this.ctx.beginPath();
      this.ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = m.color;
      this.ctx.fill();
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      // 繪製數值標籤
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '10px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(BigNum.format(m.size), m.x, m.y - m.radius - 2);
    }

    this.updateStatsUI();
  }

  updateStatsUI() {
    const statsContainer = document.getElementById('live-stats');
    const totalCells = this.rows * this.cols;
    
    let html = '';
    this.activePlayers.forEach(p => {
      let ownedCells = 0;
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (this.grid[r][c] === p.id) ownedCells++;
        }
      }
      const pct = ((ownedCells / totalCells) * 100).toFixed(1);
      html += `<div style="color:${p.color}">${p.name}: ${pct}%</div>`;
    });
    statsContainer.innerHTML = html;
  }

  checkGameOver() {
    const totalCells = this.rows * this.cols;
    for (const p of this.activePlayers) {
      let ownedCells = 0;
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (this.grid[r][c] === p.id) ownedCells++;
        }
      }

      // 當某一玩家佔領超過 85% 領土時判定獲勝
      if (ownedCells / totalCells >= 0.85) {
        this.isRunning = false;
        this.stopRecording();
        this.showResultModal(p, ((ownedCells / totalCells) * 100).toFixed(1));
        break;
      }
    }
  }

  showResultModal(winner, territoryPct) {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);
    document.getElementById('winner-name').innerText = `獲勝者：${winner.name}`;
    document.getElementById('stat-territory').innerText = `${territoryPct}%`;
    document.getElementById('stat-peak-size').innerText = BigNum.format(winner.peakSize);
    document.getElementById('stat-kills').innerText = winner.kills;
    document.getElementById('stat-duration').innerText = `${duration}s`;

    if (winner.avatar) {
      document.getElementById('winner-avatar').src = winner.avatar;
    } else {
      document.getElementById('winner-avatar').src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="40" fill="%23238636"/></svg>';
    }

    document.getElementById('result-modal').classList.remove('hidden');
  }

  loop() {
    if (!this.isRunning) return;
    this.update();
    this.render();
    requestAnimationFrame(() => this.loop());
  }
}

// 頁面初始化與 DOM 事件綁定
window.addEventListener('DOMContentLoaded', () => {
  const engine = new MarbleWarEngine('game-canvas');
  const playersListEl = document.getElementById('players-config-list');

  // 動態渲染玩家介面設定面板
  function renderPlayerConfigs() {
    playersListEl.innerHTML = '';
    engine.players.forEach((p, idx) => {
      const card = document.createElement('div');
      card.className = 'player-card';
      card.innerHTML = `
        <input type="color" value="${p.color}" data-idx="${idx}" class="color-picker">
        <input type="text" value="${p.name}" data-idx="${idx}" class="name-input" style="width: 100px;">
        <input type="file" accept="image/png" data-idx="${idx}" class="avatar-input" style="width: 140px; font-size: 0.7rem;">
      `;
      playersListEl.appendChild(card);
    });

    // 事件監聽
    document.querySelectorAll('.color-picker').forEach(el => {
      el.addEventListener('change', (e) => {
        engine.players[e.target.dataset.idx].color = e.target.value;
      });
    });
    document.querySelectorAll('.name-input').forEach(el => {
      el.addEventListener('change', (e) => {
        engine.players[e.target.dataset.idx].name = e.target.value;
      });
    });
    document.querySelectorAll('.avatar-input').forEach(el => {
      el.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            engine.players[e.target.dataset.idx].avatar = event.target.result;
          };
          reader.readAsDataURL(file);
        }
      });
    });
  }

  renderPlayerConfigs();

  // 速度滑塊控制
  const speedSlider = document.getElementById('speed-slider');
  speedSlider.addEventListener('input', (e) => {
    document.getElementById('speed-val').innerText = `${e.target.value}x`;
  });

  // 啟動按鈕
  document.getElementById('start-btn').addEventListener('click', () => {
    const mode = document.getElementById('mode-select').value;
    const splitMode = document.getElementById('split-mode-toggle').checked;
    const maxMarbles = parseInt(document.getElementById('max-marbles-input').value, 10);
    const speed = parseInt(speedSlider.value, 10);
    const activeCount = mode === '2p' ? 2 : 4;

    document.getElementById('export-video-btn').disabled = true;
    engine.startSimulation(activeCount, splitMode, maxMarbles, speed);
  });

  // 下載影片觸發
  function triggerVideoDownload() {
    if (!engine.recordedBlob) return;
    const url = URL.createObjectURL(engine.recordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MarbleWar_Replay_${Date.now()}.mp4`;
    a.click();
    URL.revokeObjectURL(url);
  }

  document.getElementById('export-video-btn').addEventListener('click', triggerVideoDownload);
  document.getElementById('modal-download-btn').addEventListener('click', triggerVideoDownload);

  document.getElementById('modal-close-btn').addEventListener('click', () => {
    document.getElementById('result-modal').classList.add('hidden');
  });
});