class GameApp {
  constructor() {
    this.pinball = new PinballEngine('pinball-canvas');
    this.battle = new BattleEngine('battle-canvas');
    
    this.isRunning = false;
    this.mediaRecorder = null;
    this.recordedChunks = [];

    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('btn-start').addEventListener('click', () => this.toggleGame());
    document.getElementById('btn-settings').addEventListener('click', () => {
      document.getElementById('settings-modal').classList.remove('hidden');
    });
    document.getElementById('btn-save-settings').addEventListener('click', () => {
      GAME_CONFIG.gravity = parseFloat(document.getElementById('cfg-gravity').value);
      GAME_CONFIG.windForce = parseFloat(document.getElementById('cfg-wind').value);
      GAME_CONFIG.gridResolution = parseInt(document.getElementById('cfg-grid-res').value, 10);
      GAME_CONFIG.initShield = parseInt(document.getElementById('cfg-init-shield').value, 10);
      
      this.battle.initGrid();
      this.battle.initBases();
      document.getElementById('settings-modal').classList.add('hidden');
    });

    document.getElementById('btn-export').addEventListener('click', () => this.downloadVideo());
  }

  toggleGame() {
    this.isRunning = !this.isRunning;
    const btn = document.getElementById('btn-start');

    if (this.isRunning) {
      btn.innerText = '暫停對局';
      btn.className = 'btn danger';
      this.startRecording();
      this.loop();
    } else {
      btn.innerText = '繼續戰爭';
      btn.className = 'btn primary';
      this.stopRecording();
    }
  }

  startRecording() {
    this.recordedChunks = [];
    // 擷取右側戰爭 Canvas 串流
    const stream = this.battle.canvas.captureStream(60);
    this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      document.getElementById('btn-export').disabled = false;
    };

    this.mediaRecorder.start();
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  downloadVideo() {
    const blob = new Blob(this.recordedChunks, { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MarbleWar_Replay_${Date.now()}.mp4`;
    a.click();
    URL.revokeObjectURL(url);
  }

  loop() {
    if (!this.isRunning) return;

    this.pinball.update();
    this.pinball.draw();

    this.battle.update();
    this.battle.draw();

    requestAnimationFrame(() => this.loop());
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new GameApp();
});