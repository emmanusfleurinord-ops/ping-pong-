const canvas = document.getElementById('pong');
const context = canvas.getContext('2d');

canvas.width = 1000;
canvas.height = 600;

const paddleWidth = 12;
const paddleHeight = 120;
let INITIAL_SPEED = 6;
let MAX_SPEED = 15;

let userScore = 0;
let computerScore = 0;
let isPaused = false;
let gameOver = false;

// ===== SOM =====
let soundEnabled = true;
let volume = 0.4;
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (!soundEnabled || audioCtx.state === 'closed') return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.value = volume;

    if (type === 'paddle') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(520, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } 
    else if (type === 'wall') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(280, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
        osc.start(); osc.stop(audioCtx.currentTime + 0.12);
    } 
    else if (type === 'score') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(90, audioCtx.currentTime + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    }
    else if (type === 'victory') {
        // Som de vitória (sequência)
        const notes = [523, 659, 784, 1046];
        notes.forEach((freq, i) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.connect(g); g.connect(audioCtx.destination);
            o.type = 'square';
            o.frequency.value = freq;
            g.gain.value = volume * 0.4;
            g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4 + i * 0.15);
            o.start(audioCtx.currentTime + i * 0.15);
            o.stop(audioCtx.currentTime + 0.5 + i * 0.15);
        });
    }
    else if (type === 'power') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
        osc.start(); osc.stop(audioCtx.currentTime + 0.25);
    }
}

// ===== DIFICULDADE =====
const difficulties = {
    easy:   { reaction: 0.07, error: 0.32 },
    medium: { reaction: 0.11, error: 0.16 },
    hard:   { reaction: 0.16, error: 0.05 }
};
let currentDifficulty = difficulties.medium;

// ===== VELOCIDADE DA BOLA =====
const speedSettings = {
    slow:   { initial: 4.5, max: 11 },
    normal: { initial: 6,   max: 15 },
    fast:   { initial: 8,   max: 19 }
};

// ===== RASTRO =====
let trail = [];

// ===== POWER-UP =====
let powerUp = null;
let powerUpTimer = 0;
const POWERUP_INTERVAL = 450; // frames (~7-8 segundos)

// Efeitos temporários
let leftBigTimer = 0;
let rightBigTimer = 0;
let ballSpeedBoost = 0; // frames restantes

// ===== EVENTOS =====
document.getElementById('btn-easy').onclick = () => setDifficulty('easy');
document.getElementById('btn-medium').onclick = () => setDifficulty('medium');
document.getElementById('btn-hard').onclick = () => setDifficulty('hard');
document.getElementById('btn-pause').onclick = togglePause;
document.getElementById('btn-settings').onclick = openSettings;
document.getElementById('btn-close-settings').onclick = closeSettings;
document.getElementById('overlay').onclick = closeSettings;
document.getElementById('btn-sound-toggle').onclick = toggleSound;
document.getElementById('volumeSlider').oninput = e => volume = parseFloat(e.target.value);
document.getElementById('ballSpeedSelect').onchange = e => changeBallSpeed(e.target.value);
document.getElementById('btn-restart').onclick = restartGame;

function setDifficulty(level) {
    currentDifficulty = difficulties[level];
    document.querySelectorAll('.controls button:not(#btn-pause):not(#btn-settings)').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-' + level).classList.add('active');
}

function changeBallSpeed(speed) {
    INITIAL_SPEED = speedSettings[speed].initial;
    MAX_SPEED = speedSettings[speed].max;
    if (!gameOver) {
        ball.speed = INITIAL_SPEED;
        // Ajusta a velocidade atual mantendo a direção
        const angle = Math.atan2(ball.dy, ball.dx);
        ball.dx = Math.sign(ball.dx) * ball.speed * Math.cos(angle);
        ball.dy = ball.speed * Math.sin(angle);
    }
}

function togglePause() {
    if (gameOver) return;
    isPaused = !isPaused;
    const btn = document.getElementById('btn-pause');
    btn.textContent = isPaused ? '▶ Continuar' : '⏸ Pausar';
    btn.classList.toggle('paused', isPaused);
}

function openSettings() {
    document.getElementById('settingsPanel').style.display = 'block';
    document.getElementById('overlay').style.display = 'block';
    isPaused = true;
}

function closeSettings() {
    document.getElementById('settingsPanel').style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
    if (!gameOver) {
        isPaused = false;
        document.getElementById('btn-pause').textContent = '⏸ Pausar';
        document.getElementById('btn-pause').classList.remove('paused');
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    const btn = document.getElementById('btn-sound-toggle');
    btn.textContent = soundEnabled ? 'Ligado' : 'Desligado';
    btn.style.borderColor = soundEnabled ? '#00ff9d' : '#ff4d6d';
    btn.style.color = soundEnabled ? '#00ff9d' : '#ff4d6d';
}

function showWinner(winner) {
    gameOver = true;
    isPaused = true;
    playSound('victory');

    const text = document.getElementById('winnerText');
    if (winner === 'left') {
        text.textContent = '🟢 Verde Venceu!';
        text.style.color = '#00ff9d';
    } else {
        text.textContent = '🔴 Vermelho Venceu!';
        text.style.color = '#ff4d6d';
    }

    document.getElementById('winnerScreen').style.display = 'block';
    document.getElementById('overlay').style.display = 'block';
}

function restartGame() {
    userScore = 0;
    computerScore = 0;
    gameOver = false;
    isPaused = false;
    leftBigTimer = 0;
    rightBigTimer = 0;
    ballSpeedBoost = 0;
    powerUp = null;
    trail = [];

    user.height = paddleHeight;
    computer.height = paddleHeight;

    document.getElementById('winnerScreen').style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('btn-pause').textContent = '⏸ Pausar';
    document.getElementById('btn-pause').classList.remove('paused');

    resetBall();
}

// ===== OBJETOS =====
const user = {
    x: 20,
    y: canvas.height / 2 - paddleHeight / 2,
    width: paddleWidth,
    height: paddleHeight,
    color: '#00ff9d'
};

const computer = {
    x: canvas.width - paddleWidth - 20,
    y: canvas.height / 2 - paddleHeight / 2,
    width: paddleWidth,
    height: paddleHeight,
    color: '#ff4d6d'
};

const ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 10,
    speed: INITIAL_SPEED,
    dx: INITIAL_SPEED,
    dy: INITIAL_SPEED,
    color: '#ffeb3b'
};

// ===== DESENHO =====
function drawScore() {
    context.fillStyle = '#00ff9d';
    context.font = 'bold 50px Arial';
    context.fillText(userScore, canvas.width / 4, 60);

    context.fillStyle = '#ff4d6d';
    context.fillText(computerScore, 3 * canvas.width / 4, 60);

    // Linha do meio
    context.setLineDash([12, 12]);
    context.beginPath();
    context.moveTo(canvas.width / 2, 0);
    context.lineTo(canvas.width / 2, canvas.height);
    context.strokeStyle = '#00f0ff';
    context.lineWidth = 3;
    context.stroke();
    context.setLineDash([]);
    context.lineWidth = 1;

    // Indicador de power-up ativo
    if (leftBigTimer > 0) {
        context.fillStyle = 'rgba(0,255,157,0.3)';
        context.fillRect(5, 5, 10, 30);
    }
    if (rightBigTimer > 0) {
        context.fillStyle = 'rgba(255,77,109,0.3)';
        context.fillRect(canvas.width - 15, 5, 10, 30);
    }
}

function drawPaddle(p) {
    context.shadowColor = p.color;
    context.shadowBlur = 15;
    context.fillStyle = p.color;
    context.fillRect(p.x, p.y, p.width, p.height);
    context.shadowBlur = 0;
}

function drawBall() {
    // Rastro
    for (let i = 0; i < trail.length; i++) {
        const t = trail[i];
        const alpha = i / trail.length * 0.5;
        context.beginPath();
        context.arc(t.x, t.y, ball.radius * (0.4 + alpha * 0.6), 0, Math.PI * 2);
        context.fillStyle = `rgba(255, 235, 59, ${alpha})`;
        context.fill();
    }

    // Bola
    context.shadowColor = ball.color;
    context.shadowBlur = 20;
    context.fillStyle = ball.color;
    context.beginPath();
    context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
}

function drawPowerUp() {
    if (!powerUp) return;

    context.shadowColor = powerUp.color;
    context.shadowBlur = 20;
    context.beginPath();
    context.arc(powerUp.x, powerUp.y, 14, 0, Math.PI * 2);
    context.fillStyle = powerUp.color;
    context.fill();
    context.shadowBlur = 0;

    // Ícone simples
    context.fillStyle = '#000';
    context.font = 'bold 14px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(powerUp.icon, powerUp.x, powerUp.y);
}

// ===== LÓGICA =====
function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.speed = INITIAL_SPEED + (ballSpeedBoost > 0 ? 3 : 0);

    const direction = Math.random() > 0.5 ? 1 : -1;
    const angle = (Math.random() * Math.PI / 2.8) - Math.PI / 5.6;

    ball.dx = direction * ball.speed * Math.cos(angle);
    ball.dy = ball.speed * Math.sin(angle);
}

function checkCollision(b, p) {
    return b.x + b.radius > p.x &&
           b.x - b.radius < p.x + p.width &&
           b.y + b.radius > p.y &&
           b.y - b.radius < p.y + p.height;
}

function spawnPowerUp() {
    const types = [
        { type: 'bigLeft',  color: '#00ff9d', icon: '⬆' },
        { type: 'bigRight', color: '#ff4d6d', icon: '⬆' },
        { type: 'fast',     color: '#ffeb3b', icon: '⚡' },
        { type: 'slow',     color: '#00f0ff', icon: '🐢' }
    ];
    const chosen = types[Math.floor(Math.random() * types.length)];

    powerUp = {
        x: canvas.width / 2 + (Math.random() * 200 - 100),
        y: 80 + Math.random() * (canvas.height - 160),
        type: chosen.type,
        color: chosen.color,
        icon: chosen.icon,
        radius: 14
    };
}

function applyPowerUp(type) {
    playSound('power');
    if (type === 'bigLeft') {
        leftBigTimer = 400; // ~6-7 segundos
        user.height = paddleHeight * 1.55;
    } 
    else if (type === 'bigRight') {
        rightBigTimer = 400;
        computer.height = paddleHeight * 1.55;
    } 
    else if (type === 'fast') {
        ballSpeedBoost = 350;
        ball.speed = Math.min(ball.speed + 3.5, MAX_SPEED + 4);
        const angle = Math.atan2(ball.dy, ball.dx);
        ball.dx = Math.sign(ball.dx) * ball.speed * Math.cos(angle);
        ball.dy = ball.speed * Math.sin(angle);
    } 
    else if (type === 'slow') {
        ball.speed = Math.max(ball.speed * 0.65, 3.5);
        const angle = Math.atan2(ball.dy, ball.dx);
        ball.dx = Math.sign(ball.dx) * ball.speed * Math.cos(angle);
        ball.dy = ball.speed * Math.sin(angle);
    }
    powerUp = null;
}

function moveBall() {
    // Atualiza rastro
    trail.push({ x: ball.x, y: ball.y });
    if (trail.length > 12) trail.shift();

    ball.x += ball.dx;
    ball.y += ball.dy;

    // Paredes
    if (ball.y + ball.radius > canvas.height) {
        ball.y = canvas.height - ball.radius;
        ball.dy = -Math.abs(ball.dy);
        playSound('wall');
    }
    if (ball.y - ball.radius < 0) {
        ball.y = ball.radius;
        ball.dy = Math.abs(ball.dy);
        playSound('wall');
    }

    // Colisão com power-up
    if (powerUp) {
        const dx = ball.x - powerUp.x;
        const dy = ball.y - powerUp.y;
        if (Math.sqrt(dx*dx + dy*dy) < ball.radius + powerUp.radius) {
            applyPowerUp(powerUp.type);
        }
    }

    // Raquetes
    let player = (ball.x < canvas.width / 2) ? user : computer;

    if (checkCollision(ball, player)) {
        let collidePoint = (ball.y - (player.y + player.height / 2)) / (player.height / 2);
        collidePoint = Math.max(-1, Math.min(1, collidePoint));

        const maxAngle = Math.PI / 3.2;
        const angle = collidePoint * maxAngle;
        const direction = (ball.x < canvas.width / 2) ? 1 : -1;

        ball.speed = Math.min(ball.speed * 1.065, MAX_SPEED + (ballSpeedBoost > 0 ? 4 : 0));

        ball.dx = direction * ball.speed * Math.cos(angle);
        ball.dy = ball.speed * Math.sin(angle);

        if (direction === 1) ball.x = player.x + player.width + ball.radius + 1;
        else ball.x = player.x - ball.radius - 1;

        playSound('paddle');
    }

    // Pontuação
    if (ball.x + ball.radius > canvas.width) {
        userScore++;
        playSound('score');
        trail = [];
        if (userScore >= 5) showWinner('left');
        else resetBall();
    } 
    else if (ball.x - ball.radius < 0) {
        computerScore++;
        playSound('score');
        trail = [];
        if (computerScore >= 5) showWinner('right');
        else resetBall();
    }
}

// ===== IA EQUILIBRADA =====
function movePaddle(paddle, isLeft) {
    const ballComingTowards = isLeft ? (ball.dx < 0) : (ball.dx > 0);

    if (ballComingTowards) {
        let targetY = ball.y - paddle.height / 2;
        // Pequeno erro aleatório (igual para os dois)
        const error = (Math.random() - 0.5) * paddle.height * currentDifficulty.error;
        targetY += error;
        paddle.y += (targetY - paddle.y) * currentDifficulty.reaction;
    } else {
        // Volta para o centro devagar (igual)
        const center = canvas.height / 2 - paddle.height / 2;
        paddle.y += (center - paddle.y) * 0.035;
    }

    // Limites
    if (paddle.y < 0) paddle.y = 0;
    if (paddle.y + paddle.height > canvas.height) {
        paddle.y = canvas.height - paddle.height;
    }
}

function update() {
    if (!isPaused && !gameOver) {
        moveBall();
        movePaddle(user, true);
        movePaddle(computer, false);

        // Timers de power-up
        if (leftBigTimer > 0) {
            leftBigTimer--;
            if (leftBigTimer === 0) user.height = paddleHeight;
        }
        if (rightBigTimer > 0) {
            rightBigTimer--;
            if (rightBigTimer === 0) computer.height = paddleHeight;
        }
        if (ballSpeedBoost > 0) ballSpeedBoost--;

        // Spawn de power-up
        powerUpTimer++;
        if (!powerUp && powerUpTimer > POWERUP_INTERVAL) {
            if (Math.random() < 0.7) spawnPowerUp();
            powerUpTimer = 0;
        }
    }

    // Fundo
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0a0a1f');
    gradient.addColorStop(1, '#120a1f');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    drawScore();
    drawPaddle(user);
    drawPaddle(computer);
    drawBall();
    drawPowerUp();

    requestAnimationFrame(update);
}

// Inicia
resetBall();
update();
