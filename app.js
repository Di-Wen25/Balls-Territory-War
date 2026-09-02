// 全局陣營設定
const FACTIONS = [
    { id: 0, color: '#ff4d6d' }, // 紅
    { id: 1, color: '#00e5ff' }, // 藍
    { id: 2, color: '#39ff14' }, // 綠
    { id: 3, color: '#ffb300' }  // 黃
];

// 大數格式化
function formatNum(num) {
    if (num < 1000) return Math.floor(num);
    const units = ['K', 'M', 'B', 'T'];
    const exp = Math.min(Math.floor(Math.log10(num) / 3), units.length) - 1;
    return (num / Math.pow(1000, exp + 1)).toFixed(1) + units[exp];
}

// ---------------- 系統一：左側物理掉落面板 ----------------

class PinballSystem {
    constructor(canvasId, eventBus) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.eventBus = eventBus;
        this.balls = [];
        this.pegs = [];
        this.multipliers = [];
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.initObstacles();
        this.spawnInitialBalls();
    }

    resize() {
        this.width = this.canvas.clientWidth;
        this.height = this.canvas.clientHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    initObstacles() {
        this.pegs = [];
        // 建構交錯的障礙釘網格
        const rows = 12;
        const cols = 9;
        for (let r = 2; r < rows; r++) {
            for (let c = 1; c < cols; c++) {
                let offset = (r % 2 === 0) ? 0 : this.width / cols / 2;
                this.pegs.push({
                    x: c * (this.width / cols) + offset,
                    y: r * (this.height / rows),
                    radius: 4
                });
            }
        }

        // 定義兩側倍率升級區
        this.multipliers = [
            { x: 0, y: this.height * 0.5, w: 40, h: 100, mult: 2, label: 'x2' },
            { x: 0, y: this.height * 0.7, w: 40, h: 100, mult: 4, label: 'x4' },
            { x: this.width - 40, y: this.height * 0.5, w: 40, h: 100, mult: 2, label: 'x2' },
            { x: this.width - 40, y: this.height * 0.7, w: 40, h: 100, mult: 4, label: 'x4' }
        ];
    }

    spawnInitialBalls() {
        FACTIONS.forEach(f => {
            for(let i=0; i<3; i++) {
                this.balls.push({
                    faction: f,
                    x: this.width / 2 + (Math.random() - 0.5) * 100,
                    y: Math.random() * -100,
                    vx: (Math.random() - 0.5) * 2,
                    vy: 0,
                    radius: 6,
                    value: 10
                });
            }
        });
    }

    update() {
        const gravity = 0.15;
        const bounce = 0.6;
        
        for (let i = this.balls.length - 1; i >= 0; i--) {
            let b = this.balls[i];
            b.vy += gravity;
            b.x += b.vx;
            b.y += b.vy;

            // 邊界碰撞
            if (b.x < b.radius) { b.x = b.radius; b.vx *= -bounce; }
            if (b.x > this.width - b.radius) { b.x = this.width - b.radius; b.vx *= -bounce; }

            // 釘子碰撞 (簡化版圓形碰撞)
            for (let p of this.pegs) {
                let dx = b.x - p.x;
                let dy = b.y - p.y;
                let dist = Math.hypot(dx, dy);
                if (dist < b.radius + p.radius) {
                    let angle = Math.atan2(dy, dx);
                    let speed = Math.hypot(b.vx, b.vy) * bounce;
                    b.vx = Math.cos(angle) * speed;
                    b.vy = Math.sin(angle) * speed;
                    // 擠出碰撞體
                    b.x = p.x + Math.cos(angle) * (b.radius + p.radius + 1);
                    b.y = p.y + Math.sin(angle) * (b.radius + p.radius + 1);
                }
            }

            // 倍率升級判定 (回到頂部)
            let handled = false;
            for (let m of this.multipliers) {
                if (b.x - b.radius < m.x + m.w && b.x + b.radius > m.x &&
                    b.y - b.radius < m.y + m.h && b.y + b.radius > m.y) {
                    b.value *= m.mult;
                    b.radius = Math.min(15, b.radius + 1);
                    b.y = -20; 
                    b.x = this.width / 2 + (Math.random() - 0.5) * 50;
                    b.vy = 0;
                    b.vx = (Math.random() - 0.5) * 2;
                    handled = true;
                    break;
                }
            }

            if (handled) continue;

            // 底部技能槽判定
            if (b.y > this.height) {
                let section = Math.floor((b.x / this.width) * 5); // 劃分5個技能槽
                let skills = ['storm', 'bullet', 'shield', 'bigball', 'sniper'];
                
                // 觸發事件傳送至右側
                this.eventBus.trigger('skill_activated', {
                    factionId: b.faction.id,
                    skill: skills[section],
                    power: b.value
                });

                // 重置彈珠
                b.y = -50 - Math.random() * 100;
                b.x = this.width / 2 + (Math.random() - 0.5) * 150;
                b.vy = 0;
                b.vx = (Math.random() - 0.5) * 2;
                b.value = 10;
                b.radius = 6;
            }
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // 繪製障礙釘
        this.ctx.fillStyle = '#2c405a';
        for (let p of this.pegs) {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
            this.ctx.fill();
        }

        // 繪製倍率區
        for (let m of this.multipliers) {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            this.ctx.strokeStyle = '#4a6b94';
            this.ctx.fillRect(m.x, m.y, m.w, m.h);
            this.ctx.strokeRect(m.x, m.y, m.w, m.h);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '16px sans-serif';
            this.ctx.fillText(m.label, m.x + m.w/2 - 10, m.y + m.h/2 + 5);
        }

        // 繪製底部分隔線
        this.ctx.strokeStyle = '#1c2b3d';
        this.ctx.beginPath();
        for(let i=1; i<5; i++) {
            this.ctx.moveTo(this.width / 5 * i, this.height - 50);
            this.ctx.lineTo(this.width / 5 * i, this.height);
        }
        this.ctx.stroke();

        // 繪製彈珠
        for (let b of this.balls) {
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = b.faction.color;
            this.ctx.fillStyle = b.faction.color;
            this.ctx.beginPath();
            this.ctx.arc(b.x, b.y, b.radius, 0, Math.PI*2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '10px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(formatNum(b.value), b.x, b.y - b.radius - 2);
        }
    }
}

// ---------------- 系統二：右側戰略與領土面板 ----------------

class BattleSystem {
    constructor(canvasId, eventBus) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        this.bases = [];
        this.projectiles = [];
        // 領土網格解析度
        this.gridSize = 10; 
        this.grid = [];
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.initBases();
        
        // 接收來自左側的技能觸發
        eventBus.subscribe('skill_activated', (data) => this.handleSkill(data));
    }

    resize() {
        this.width = this.canvas.clientWidth;
        this.height = this.canvas.clientHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        // 初始化或重置領土網格
        this.cols = Math.ceil(this.width / this.gridSize);
        this.rows = Math.ceil(this.height / this.gridSize);
        this.grid = Array.from({length: this.rows}, () => new Array(this.cols).fill(-1));
        this.initBases();
    }

    initBases() {
        const padding = 100;
        this.bases = [
            { id: 0, x: padding, y: padding, shield: 1000, fireRate: 1 },
            { id: 1, x: this.width - padding, y: padding, shield: 1000, fireRate: 1 },
            { id: 2, x: padding, y: this.height - padding, shield: 1000, fireRate: 1 },
            { id: 3, x: this.width - padding, y: this.height - padding, shield: 1000, fireRate: 1 }
        ];

        // 預設佔領基地周邊網格
        this.bases.forEach(b => {
            const gc = Math.floor(b.x / this.gridSize);
            const gr = Math.floor(b.y / this.gridSize);
            for(let r = -5; r <= 5; r++) {
                for(let c = -5; c <= 5; c++) {
                    if(gr+r >=0 && gr+r < this.rows && gc+c >=0 && gc+c < this.cols) {
                        this.grid[gr+r][gc+c] = b.id;
                    }
                }
            }
        });
    }

    handleSkill(data) {
        const base = this.bases.find(b => b.id === data.factionId);
        if (!base) return;

        switch(data.skill) {
            case 'shield':
                base.shield += data.power * 10;
                break;
            case 'bullet':
                // 暫時提升射速或發射一批常規彈
                for(let i=0; i<3; i++) this.shoot(base, 'normal', data.power);
                break;
            case 'storm':
                // 360度環繞射擊
                for(let angle=0; angle < Math.PI*2; angle+= Math.PI/8) {
                    this.shootDir(base, angle, 'normal', data.power / 5);
                }
                break;
            case 'bigball':
                // 慢速大質量穿透彈
                this.shoot(base, 'heavy', data.power * 5);
                break;
            case 'sniper':
                // 鎖定隨機敵方基地
                const targets = this.bases.filter(b => b.id !== base.id);
                const target = targets[Math.floor(Math.random() * targets.length)];
                const angle = Math.atan2(target.y - base.y, target.x - base.x);
                this.shootDir(base, angle, 'fast', data.power * 2);
                break;
        }
    }

    shoot(base, type, power) {
        const angle = Math.random() * Math.PI * 2;
        this.shootDir(base, angle, type, power);
    }

    shootDir(base, angle, type, power) {
        let speed = 5;
        let radius = 3;
        if(type === 'heavy') { speed = 2; radius = 12; }
        if(type === 'fast') { speed = 12; radius = 2; }

        this.projectiles.push({
            factionId: base.id,
            x: base.x,
            y: base.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            type: type,
            power: power,
            radius: radius
        });
    }

    update() {
        // 常規射擊 (基礎頻率)
        if(Math.random() < 0.1) {
            this.bases.forEach(b => this.shoot(b, 'normal', 10));
        }

        // 子彈邏輯與領土染色
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            let p = this.projectiles[i];
            p.x += p.vx;
            p.y += p.vy;

            // 領土轉換檢測
            let gc = Math.floor(p.x / this.gridSize);
            let gr = Math.floor(p.y / this.gridSize);
            
            if (gc >= 0 && gc < this.cols && gr >= 0 && gr < this.rows) {
                if (this.grid[gr][gc] !== p.factionId) {
                    this.grid[gr][gc] = p.factionId;
                    p.power -= 1; // 染色消耗能量
                }
            }

            // 出界或能量耗盡移除
            if (p.x < 0 || p.x > this.width || p.y < 0 || p.y > this.height || p.power <= 0) {
                this.projectiles.splice(i, 1);
            }
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // 1. 渲染網格領土
        for(let r=0; r<this.rows; r++) {
            for(let c=0; c<this.cols; c++) {
                let owner = this.grid[r][c];
                if(owner !== -1) {
                    // 為了效能，採用透明度疊加產生色塊，而非精確邊緣繪製
                    this.ctx.fillStyle = FACTIONS[owner].color + '40'; // 添加透明度 Hex
                    this.ctx.fillRect(c * this.gridSize, r * this.gridSize, this.gridSize, this.gridSize);
                }
            }
        }

        // 2. 渲染基地與護盾數值
        for(let b of this.bases) {
            let color = FACTIONS[b.id].color;
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = color;
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(b.x, b.y, 40, 0, Math.PI*2);
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;

            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 16px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(formatNum(b.shield), b.x, b.y + 5);
        }

        // 3. 渲染子彈
        for(let p of this.projectiles) {
            this.ctx.fillStyle = FACTIONS[p.factionId].color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
            this.ctx.fill();
        }
    }
}

// ---------------- 系統三：主控與通訊匯流排 ----------------

class EventBus {
    constructor() {
        this.listeners = {};
    }
    subscribe(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }
    trigger(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }
}

// 初始化啟動
const eventBus = new EventBus();
const pinball = new PinballSystem('pinball-canvas', eventBus);
const battle = new BattleSystem('battle-canvas', eventBus);

function gameLoop() {
    pinball.update();
    pinball.draw();
    
    battle.update();
    battle.draw();
    
    requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);