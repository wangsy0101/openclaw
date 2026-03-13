/*
  Tetris - vanilla JS
  - 10x20 arena
  - 7-bag randomizer
  - SRS wall-kicks (Guideline)
  - lock delay
  - next + hold
*/

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const nextCanvas = document.getElementById('next');
  const nextCtx = nextCanvas.getContext('2d');
  const holdCanvas = document.getElementById('hold');
  const holdCtx = holdCanvas.getContext('2d');

  const ui = {
    score: document.getElementById('score'),
    level: document.getElementById('level'),
    lines: document.getElementById('lines'),
    overlay: document.getElementById('overlay'),
    overlayTitle: document.getElementById('overlayTitle'),
    overlayBody: document.getElementById('overlayBody'),
    btnRestart: document.getElementById('btnRestart'),
  };

  const COLS = 10;
  const ROWS = 20;
  const BLOCK = 30;

  const PREVIEW_BLOCK = 24;

  // Scale drawing
  ctx.scale(BLOCK, BLOCK);
  nextCtx.scale(PREVIEW_BLOCK, PREVIEW_BLOCK);
  holdCtx.scale(PREVIEW_BLOCK, PREVIEW_BLOCK);

  const COLORS = {
    'I': '#6ee7ff',
    'J': '#7aa2ff',
    'L': '#ffb86b',
    'O': '#ffe56b',
    'S': '#7dff8b',
    'T': '#c77dff',
    'Z': '#ff6b6b',
    'X': '#00000000',
  };

  const SHAPES = {
    'I': [
      [0,0,0,0],
      [1,1,1,1],
      [0,0,0,0],
      [0,0,0,0],
    ],
    'J': [
      [1,0,0],
      [1,1,1],
      [0,0,0],
    ],
    'L': [
      [0,0,1],
      [1,1,1],
      [0,0,0],
    ],
    'O': [
      [1,1],
      [1,1],
    ],
    'S': [
      [0,1,1],
      [1,1,0],
      [0,0,0],
    ],
    'T': [
      [0,1,0],
      [1,1,1],
      [0,0,0],
    ],
    'Z': [
      [1,1,0],
      [0,1,1],
      [0,0,0],
    ],
  };

  const scoreForLines = (n, level) => {
    // Classic-ish scoring
    const base = [0, 100, 300, 500, 800][n] || 0;
    return base * level;
  };

  const createMatrix = (w, h) => Array.from({ length: h }, () => Array(w).fill('X'));

  const rotateMatrix = (m, dir) => {
    // dir: +1 clockwise, -1 counterclockwise
    const N = m.length;
    const res = Array.from({ length: N }, () => Array(N).fill(0));
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (dir > 0) res[x][N - 1 - y] = m[y][x];
        else res[N - 1 - x][y] = m[y][x];
      }
    }
    return res;
  };

  const collides = (arena, piece) => {
    const { matrix, pos } = piece;
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (matrix[y][x] === 0) continue;
        const ax = x + pos.x;
        const ay = y + pos.y;
        if (ax < 0 || ax >= COLS || ay >= ROWS) return true;
        if (ay >= 0 && arena[ay][ax] !== 'X') return true;
      }
    }
    return false;
  };

  const merge = (arena, piece) => {
    const { matrix, pos, type } = piece;
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (matrix[y][x] === 0) continue;
        const ay = y + pos.y;
        const ax = x + pos.x;
        if (ay >= 0) arena[ay][ax] = type;
      }
    }
  };

  const findFullRows = (arena) => {
    const rows = [];
    outer: for (let y = ROWS - 1; y >= 0; y--) {
      for (let x = 0; x < COLS; x++) {
        if (arena[y][x] === 'X') continue outer;
      }
      rows.push(y);
    }
    return rows; // bottom -> top
  };

  const removeFullRows = (arena, rows) => {
    // rows are indices in current arena; remove bottom-first
    const sorted = [...rows].sort((a, b) => b - a);
    for (const y of sorted) {
      const row = arena.splice(y, 1)[0];
      row.fill('X');
      arena.unshift(row);
    }
  };


  const drawCell = (ctx, x, y, color) => {
    // Beveled / 3D-ish block (arcade feel)
    ctx.save();

    // base
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);

    // inner inset area
    const pad = 0.06;
    const inner = 1 - pad * 2;

    // top-left highlight
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x + pad, y + pad, inner, 0.16);
    ctx.fillRect(x + pad, y + pad, 0.16, inner);

    // bottom-right shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(x + pad, y + 1 - pad - 0.16, inner, 0.16);
    ctx.fillRect(x + 1 - pad - 0.16, y + pad, 0.16, inner);

    // outer edge
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 0.05;
    ctx.strokeRect(x + 0.03, y + 0.03, 0.94, 0.94);

    // subtle inner edge
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 0.04;
    ctx.strokeRect(x + 0.12, y + 0.12, 0.76, 0.76);

    ctx.restore();
  };

  const drawMatrix = (ctx, matrix, offset, typeForOnes) => {
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        const v = matrix[y][x];
        if (!v || v === 'X') continue;
        const t = typeof v === 'string' ? v : typeForOnes;
        drawCell(ctx, x + offset.x, y + offset.y, COLORS[t] || '#fff');
      }
    }
  };

  const clearCanvas = (ctx, w, h) => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.restore();
  };

  // 7-bag generator
  const bag = [];
  const refillBag = () => {
    const pieces = ['I','J','L','O','S','T','Z'];
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    bag.push(...pieces);
  };
  const takeFromBag = () => {
    if (bag.length < 7) refillBag();
    return bag.shift();
  };

  // SRS wall kicks (Guideline).
  // Note: tables use +y = up; our grid +y is down, so we apply y -= kickY.
  const KICKS_JLSTZ = {
    '0>1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '1>0': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '1>2': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '2>1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '2>3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    '3>2': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '3>0': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '0>3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  };

  const KICKS_I = {
    '0>1': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    '1>0': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    '1>2': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
    '2>1': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    '2>3': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    '3>2': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    '3>0': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    '0>3': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
  };

  const getKickTests = (type, from, to) => {
    if (type === 'O') return [[0,0]];
    const key = `${from}>${to}`;
    if (type === 'I') return KICKS_I[key] || [[0,0]];
    return KICKS_JLSTZ[key] || [[0,0]];
  };

  const state = {
    arena: createMatrix(COLS, ROWS),
    current: null,
    next: null,
    hold: null,
    holdUsed: false,
    score: 0,
    lines: 0,
    level: 1,
    dropCounter: 0,
    dropInterval: 1000,
    lastTime: 0,
    paused: false,
    gameOver: false,
    lockDelay: 500,
    lockCounter: 0,
    maxLockResets: 15,
    fx: { particles: [], flash: 0, shake: 0, clearWipe: null },
    clearing: null,
  };

  const updateUi = () => {
    ui.score.textContent = String(state.score);
    ui.lines.textContent = String(state.lines);
    ui.level.textContent = String(state.level);
  };

  const recomputeSpeed = () => {
    // faster with level
    const base = 1000;
    const min = 100;
    state.dropInterval = Math.max(min, base - (state.level - 1) * 75);
  };

  const spawnPiece = (type) => {
    const shape = SHAPES[type];
    // normalize to square matrix for rotation logic
    const N = Math.max(shape.length, shape[0].length);
    const m = Array.from({ length: N }, (_, y) =>
      Array.from({ length: N }, (_, x) => (shape[y]?.[x] ? 1 : 0))
    );

    const piece = {
      type,
      matrix: m,
      rot: 0, // 0=spawn, 1=R, 2=2, 3=L
      pos: { x: Math.floor(COLS / 2) - Math.ceil(N / 2), y: -1 },
      lockResets: 0,
    };
    return piece;
  };

  const setOverlay = (show, title, body) => {
    ui.overlay.classList.toggle('hidden', !show);
    if (title) ui.overlayTitle.textContent = title;
    if (body) ui.overlayBody.textContent = body;
  };

  const isGrounded = (piece) => {
    const test = { ...piece, pos: { x: piece.pos.x, y: piece.pos.y + 1 } };
    return collides(state.arena, test);
  };

  const rand = (a, b) => a + Math.random() * (b - a);

  const fxSpawnParticles = (cells, palette, perCell = 3) => {
    const colors = Array.isArray(palette) ? palette : [palette];
    for (const c of cells) {
      for (let i = 0; i < perCell; i++) {
        state.fx.particles.push({
          x: c.x + rand(0.25, 0.75),
          y: c.y + rand(0.25, 0.75),
          vx: rand(-3.0, 3.0),
          vy: rand(-6.0, -1.0),
          g: rand(10.0, 18.0),
          size: rand(0.08, 0.18),
          life: rand(160, 320),
          maxLife: 320,
          color: colors[(Math.random() * colors.length) | 0],
        });
      }
    }

    // prevent runaway
    if (state.fx.particles.length > 1200) {
      state.fx.particles.splice(0, state.fx.particles.length - 1200);
    }
  };

  const fxOnLock = (piece) => {
    const cells = [];
    const { matrix, pos } = piece;
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (matrix[y][x] === 0) continue;
        const ax = x + pos.x;
        const ay = y + pos.y;
        if (ay < 0) continue;
        cells.push({ x: ax, y: ay });
      }
    }
    const base = COLORS[piece.type] || '#ffffff';
    fxSpawnParticles(cells, [base, 'rgba(255,255,255,0.9)'], 3);
    state.fx.shake = Math.max(state.fx.shake, 60);

  };



  const fxOnFall = (piece, strength = 1) => {
    // trailing "dust" while the piece is falling
    const cells = [];
    const { matrix, pos } = piece;
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (matrix[y][x] === 0) continue;
        // bottom edge of the tetromino
        const isBottom = (y === matrix.length - 1) || (matrix[y + 1]?.[x] === 0);
        if (!isBottom) continue;
        const ax = x + pos.x;
        const ay = y + pos.y;
        if (ay < -1) continue;
        cells.push({ x: ax, y: ay + 1 });
      }
    }

    const base = COLORS[piece.type] || '#ffffff';

    // custom dust particles (short life, mostly downward)
    for (const c of cells) {
      const count = Math.random() < 0.45 ? 1 : 0;
      for (let i = 0; i < count; i++) {
        state.fx.particles.push({
          x: c.x + (Math.random() * 0.6 + 0.2),
          y: c.y + (Math.random() * 0.08),
          vx: (Math.random() - 0.5) * 2.2 * strength,
          vy: (Math.random() * 1.8 + 0.6) * strength,
          g: (10 + Math.random() * 10) * strength,
          size: (0.05 + Math.random() * 0.08),
          life: (80 + Math.random() * 120) / Math.max(0.8, strength),
          maxLife: 220,
          color: Math.random() < 0.25 ? base : 'rgba(255,255,255,0.28)',
        });
      }
    }

    if (state.fx.particles.length > 1200) {
      state.fx.particles.splice(0, state.fx.particles.length - 1200);
    }
  };

  const fxOnLineClear = (rows) => {
    if (!rows || rows.length === 0) return;
    // brief flash + stronger shake
    state.fx.flash = Math.max(state.fx.flash, 160);
    state.fx.shake = Math.max(state.fx.shake, 180);

    state.fx.clearWipe = { rows: [...rows], t: 0, duration: 260 };

    const cells = [];
    for (const y of rows) {
      for (let x = 0; x < COLS; x++) cells.push({ x, y });
    }
    fxSpawnParticles(cells, ['#31e7ff', '#b36bff', '#ffb86b', 'rgba(255,255,255,0.95)'], 2);
  };

  const fxUpdate = (delta) => {
    // timers
    state.fx.flash = Math.max(0, state.fx.flash - delta);
    state.fx.shake = Math.max(0, state.fx.shake - delta);

    // particles
    const ps = state.fx.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= delta;
      if (p.life <= 0) {
        ps.splice(i, 1);
        continue;
      }
      const dt = delta / 1000;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.g * dt;
    }
  };

  const fxDraw = () => {
    // particles
    const ps = state.fx.particles;
    if (ps.length) {
      for (const p of ps) {
        const a = Math.max(0, Math.min(1, p.life / p.maxLife));
        ctx.globalAlpha = a * 0.9;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    }

    // flash
    if (state.fx.flash > 0) {
      const t = Math.min(1, state.fx.flash / 160);
      ctx.fillStyle = `rgba(255,255,255,${0.12 * t})`;
      ctx.fillRect(0, 0, COLS, ROWS);
    }

    // left-to-right clear wipe
    if (state.fx.clearWipe) {
      const cw = state.fx.clearWipe;
      const p = Math.min(1, cw.t / cw.duration);
      const x = p * COLS;
      const w = 1.2;
      for (const y of cw.rows) {
        // bright leading edge
        const grad = ctx.createLinearGradient(x - w, y, x + 0.2, y);
        grad.addColorStop(0, 'rgba(49,231,255,0.00)');
        grad.addColorStop(0.45, 'rgba(49,231,255,0.25)');
        grad.addColorStop(0.7, 'rgba(179,107,255,0.35)');
        grad.addColorStop(1, 'rgba(255,255,255,0.25)');
        ctx.fillStyle = grad;
        ctx.fillRect(Math.max(0, x - w), y, w + 0.2, 1);

        // slight fade behind the sweep to imply erasing
        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        ctx.fillRect(0, y, Math.max(0, x - 0.2), 1);
      }
    }
  };

  const resetGame = () => {
    state.arena = createMatrix(COLS, ROWS);
    bag.length = 0;
    state.score = 0;
    state.lines = 0;
    state.level = 1;
    recomputeSpeed();

    state.hold = null;
    state.holdUsed = false;
    state.gameOver = false;
    state.paused = false;
    state.lockCounter = 0;
    state.fx.particles.length = 0;
    state.fx.flash = 0;
    state.fx.shake = 0;
    setOverlay(false);

    state.next = spawnPiece(takeFromBag());
    state.current = spawnPiece(takeFromBag());
    updateUi();
    drawPreviews();
  };

  const lockAndContinue = () => {
    fxOnLock(state.current);
    merge(state.arena, state.current);

    const rows = findFullRows(state.arena);
    if (rows.length > 0) {
      fxOnLineClear(rows);
      // start clear animation; we'll remove rows + score after wipe finishes
      state.clearing = { rows, t: 0, duration: 260 };
      state.current = null;
      return;
    }

    state.current = state.next;
    state.current.pos.y = -1;
    state.current.pos.x = Math.floor(COLS / 2) - Math.ceil(state.current.matrix.length / 2);
    state.current.rot = 0;
    state.next = spawnPiece(takeFromBag());
    state.holdUsed = false;
    state.lockCounter = 0;

    if (collides(state.arena, state.current)) {
      state.gameOver = true;
      state.paused = true;
      setOverlay(true, '游戏结束', '按 R 重新开始');
    }

    drawPreviews();
  };

  const hardDrop = () => {
    if (state.paused || state.gameOver || state.clearing) return;
    let dist = 0;
    while (true) {
      state.current.pos.y++;
      if (collides(state.arena, state.current)) {
        state.current.pos.y--;
        break;
      }
      dist++;
    }
    state.score += dist * 2; // guideline-ish: 2 per cell
    updateUi();
    lockAndContinue();
    state.dropCounter = 0;
  };

  const softDrop = () => {
    if (state.paused || state.gameOver || state.clearing) return;
    state.current.pos.y++;
    if (collides(state.arena, state.current)) {
      state.current.pos.y--;
      // lock delay handles the rest
    } else {
      state.score += 1; // 1 per cell
      state.lockCounter = 0;
      fxOnFall(state.current, 1.0);
      updateUi();
    }
    state.dropCounter = 0;
  };

  const move = (dir) => {
    if (state.paused || state.gameOver || state.clearing) return;
    const oldX = state.current.pos.x;
    state.current.pos.x += dir;
    if (collides(state.arena, state.current)) {
      state.current.pos.x = oldX;
    } else {
      // moving on the floor can reset lock delay, but not indefinitely
      if (isGrounded(state.current) && state.current.lockResets < state.maxLockResets) {
        state.lockCounter = 0;
        state.current.lockResets++;
      }
    }
  };

  const rotate = (dir) => {
    if (state.paused || state.gameOver || state.clearing) return;

    const piece = state.current;
    const from = piece.rot;
    const to = (from + (dir > 0 ? 1 : 3)) % 4;

    const oldMatrix = piece.matrix;
    const oldX = piece.pos.x;
    const oldY = piece.pos.y;

    const rotated = rotateMatrix(oldMatrix, dir);
    piece.matrix = rotated;

    // O piece: no kicks
    const tests = getKickTests(piece.type, from, to);
    for (const [dx, dyUp] of tests) {
      piece.pos.x = oldX + dx;
      piece.pos.y = oldY - dyUp;
      if (!collides(state.arena, piece)) {
        piece.rot = to;
        if (isGrounded(piece) && piece.lockResets < state.maxLockResets) {
          state.lockCounter = 0;
          piece.lockResets++;
        }
        return;
      }
    }

    // revert
    piece.matrix = oldMatrix;
    piece.pos.x = oldX;
    piece.pos.y = oldY;
  };

  const hold = () => {
    if (state.paused || state.gameOver || state.clearing) return;
    if (state.holdUsed) return;

    const curType = state.current.type;

    if (!state.hold) {
      state.hold = curType;
      state.current = state.next;
      state.current.pos.y = -1;
      state.current.pos.x = Math.floor(COLS / 2) - Math.ceil(state.current.matrix.length / 2);
      state.current.rot = 0;
      state.next = spawnPiece(takeFromBag());
    } else {
      const swap = state.hold;
      state.hold = curType;
      state.current = spawnPiece(swap);
    }

    state.holdUsed = true;
    state.lockCounter = 0;
    state.current.lockResets = 0;

    if (collides(state.arena, state.current)) {
      state.gameOver = true;
      state.paused = true;
      setOverlay(true, '游戏结束', '按 R 重新开始');
    }

    drawPreviews();
  };

  const drawArena = () => {
    ctx.save();
    if (state.fx.shake > 0) {
      const t = Math.min(1, state.fx.shake / 180);
      const mag = 0.18 * t;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }
    // background (avoid pure black; classic deep-blue playfield)
    ctx.fillStyle = 'rgba(12, 18, 46, 0.92)';
    ctx.fillRect(0, 0, COLS, ROWS);

    // grid subtle
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 0.03;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ROWS);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(COLS, y);
      ctx.stroke();
    }

    // placed blocks
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = state.arena[y][x];
        if (t !== 'X') drawCell(ctx, x, y, COLORS[t]);
      }
    }

    if (state.current) {
      // ghost piece
      drawGhost();

      // current piece
      drawMatrix(ctx, state.current.matrix, state.current.pos, state.current.type);
    }

    // FX on top
    fxDraw();

    ctx.restore();
  };

  const drawGhost = () => {
    const ghost = {
      type: state.current.type,
      matrix: state.current.matrix,
      pos: { x: state.current.pos.x, y: state.current.pos.y },
    };
    while (!collides(state.arena, ghost)) ghost.pos.y++;
    ghost.pos.y--;

    // draw semi-transparent
    for (let y = 0; y < ghost.matrix.length; y++) {
      for (let x = 0; x < ghost.matrix[y].length; x++) {
        if (ghost.matrix[y][x] === 0) continue;
        const gx = x + ghost.pos.x;
        const gy = y + ghost.pos.y;
        if (gy < 0) continue;
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(gx + 0.06, gy + 0.06, 0.88, 0.88);
      }
    }
  };

  const drawMini = (ctx, type) => {
    // clear
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    clearCanvas(ctx, w, h);

    // background
    ctx.fillStyle = 'rgba(12, 18, 46, 0.90)';
    ctx.fillRect(0, 0, w / PREVIEW_BLOCK, h / PREVIEW_BLOCK);

    if (!type) return;

    const shape = SHAPES[type];
    const N = Math.max(shape.length, shape[0].length);
    const m = Array.from({ length: N }, (_, y) =>
      Array.from({ length: N }, (_, x) => (shape[y]?.[x] ? 1 : 0))
    );

    // center in 5x5 area
    const off = { x: Math.floor((5 - N) / 2), y: Math.floor((5 - N) / 2) };

    // draw (use same beveled style as main board)
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (m[y][x] === 0) continue;
        drawCell(ctx, x + off.x, y + off.y, COLORS[type]);
      }
    }
  };

  const drawPreviews = () => {
    drawMini(nextCtx, state.next?.type);
    drawMini(holdCtx, state.hold);
  };

  const togglePause = () => {
    if (state.gameOver) return;
    state.paused = !state.paused;
    if (state.paused) setOverlay(true, '暂停', '按 P 继续');
    else setOverlay(false);
  };

  const update = (time = 0) => {
    const delta = time - state.lastTime;
    state.lastTime = time;

    fxUpdate(delta);

    if (state.clearing) {
      state.clearing.t += delta;
      if (state.clearing.t >= state.clearing.duration) {
        const cleared = state.clearing.rows.length;
        removeFullRows(state.arena, state.clearing.rows);
        state.lines += cleared;
        state.score += scoreForLines(cleared, state.level);
        const newLevel = 1 + Math.floor(state.lines / 10);
        if (newLevel !== state.level) {
          state.level = newLevel;
          recomputeSpeed();
        }
        updateUi();

        // spawn next after the clear
        state.current = state.next;
        state.current.pos.y = -1;
        state.current.pos.x = Math.floor(COLS / 2) - Math.ceil(state.current.matrix.length / 2);
        state.current.rot = 0;
        state.next = spawnPiece(takeFromBag());
        state.holdUsed = false;
        state.lockCounter = 0;
        state.clearing = null;

        if (collides(state.arena, state.current)) {
          state.gameOver = true;
          state.paused = true;
          setOverlay(true, '游戏结束', '按 R 重新开始');
        }

        drawPreviews();
      }

      // While clearing, current piece is temporarily null; skip gravity/inputs this frame
      drawArena();
      requestAnimationFrame(update);
      return;
    }

    if (!state.paused && state.current) {
      state.dropCounter += delta;
      if (state.dropCounter > state.dropInterval) {
        state.current.pos.y++;
        if (collides(state.arena, state.current)) {
          state.current.pos.y--; // stay; lock delay will handle
        } else {
          // successful gravity drop resets lock delay
          state.lockCounter = 0;
          fxOnFall(state.current, 0.85);
        }
        state.dropCounter = 0;
      }

      // lock delay
      if (isGrounded(state.current)) {
        state.lockCounter += delta;
        if (state.lockCounter >= state.lockDelay) {
          lockAndContinue();
        }
      } else {
        state.lockCounter = 0;
      }
    }

    drawArena();
    requestAnimationFrame(update);
  };

  // Input
  document.addEventListener('keydown', (e) => {
    // Prevent browser scroll/focus movement while playing
    if (['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Space','KeyC','KeyP','KeyR'].includes(e.code)) {
      e.preventDefault();
    }

    if (e.code === 'KeyP') {
      togglePause();
      return;
    }

    if (e.code === 'KeyR') {
      resetGame();
      return;
    }

    if (state.paused || state.clearing) return;

    switch (e.code) {
      case 'ArrowLeft':
        move(-1);
        break;
      case 'ArrowRight':
        move(1);
        break;
      case 'ArrowDown':
        softDrop();
        break;
      case 'ArrowUp':
        rotate(1);
        break;
      case 'Space':
        hardDrop();
        break;
      case 'KeyC':
        hold();
        break;
    }
  });

  ui.btnRestart.addEventListener('click', () => resetGame());

  // Start
  resetGame();
  updateUi();
  requestAnimationFrame(update);
})();
