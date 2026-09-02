// 全局陣營定義 (顏色、名稱)
const FACTIONS = [
  { id: 0, name: '紅隊', color: '#ff3366', glow: 'rgba(255,51,102,0.4)' },
  { id: 1, name: '藍隊', color: '#00d2ff', glow: 'rgba(0,210,255,0.4)' },
  { id: 2, name: '綠隊', color: '#00ff88', glow: 'rgba(0,255,136,0.4)' },
  { id: 3, name: '黃隊', color: '#ffb700', glow: 'rgba(255,183,0,0.4)' }
];

// 大數格式化模組
class BigNum {
  static UNITS = ['', 'K', 'M', 'G', 'T', 'P', 'E'];

  static format(val) {
    if (val < 1000) return Math.floor(val).toString();
    const exp = Math.min(Math.floor(Math.log10(val) / 3), BigNum.UNITS.length - 1);
    const scaled = val / Math.pow(1000, exp);
    return `${scaled.toFixed(scaled < 10 ? 1 : 0)}${BigNum.UNITS[exp]}`;
  }
}

// 可設定參數
const GAME_CONFIG = {
  gravity: 0.12,
  windForce: 0.32,
  gridResolution: 80,
  initShield: 10000,
  autoRecord: true
};

// 簡單解耦事件匯流排
class EventBus {
  constructor() { this.events = {}; }
  on(event, cb) { (this.events[event] = this.events[event] || []).push(cb); }
  emit(event, data) { (this.events[event] || []).forEach(cb => cb(data)); }
}

const globalBus = new EventBus();