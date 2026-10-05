// chess-engine.js
const ChessEngine = (function () {
  'use strict';

  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  const WHITE = 0, BLACK = 1;
  const PAWN = 0, KNIGHT = 1, BISHOP = 2, ROOK = 3, QUEEN = 4, KING = 5;
  const EMPTY = -1;
  const TYPES = ['p', 'n', 'b', 'r', 'q', 'k'];
  const COLOR_CHAR = ['w', 'b'];
  const FILE = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const VAL = [100, 320, 330, 500, 900, 0];

  const KNIGHT_DIRS = [[1, 2], [1, -2], [-1, 2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]];
  const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const QUEEN_DIRS = BISHOP_DIRS.concat(ROOK_DIRS);
  const KING_DIRS = QUEEN_DIRS;

  const INF = 1000000000;
  const MATE = 1000000;

  function sq2i(sq) {
    if (!sq) return -1;
    sq = String(sq).toLowerCase();
    if (sq.length < 2) return -1;
    const f = FILE.indexOf(sq.charAt(0));
    if (f < 0) return -1;
    const r = parseInt(sq.charAt(1), 10);
    if (r < 1 || r > 8) return -1;
    return ((8 - r) << 3) | f;
  }
  function i2sq(i) {
    return FILE[i & 7] + String(8 - (i >> 3));
  }

  const PST = [
    [[0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],[5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],[5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]],
    [[-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],[-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],[-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],[-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]],
    [[-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],[-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],[-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]],
    [[0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0]],
    [[-20,-10,-10,-5,-5,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,5,5,5,0,-10],[-5,0,5,5,5,5,0,-5],[0,0,5,5,5,5,0,-5],[-10,5,5,5,5,5,0,-10],[-10,0,5,0,0,0,0,-10],[-20,-10,-10,-5,-5,-10,-10,-20]],
    [[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],[20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]]
  ];

  function parseFen(fen) {
    const parts = fen.split(' ');
    const rows = parts[0].split('/');
    const cells = new Array(64).fill(EMPTY);
    for (let r = 0; r < 8; r++) {
      let c = 0;
      const row = rows[r] || '';
      for (let i = 0; i < row.length; i++) {
        const ch = row.charAt(i);
        if (ch >= '1' && ch <= '8') { c += +ch; }
        else {
          const color = ch === ch.toUpperCase() ? WHITE : BLACK;
          const type = TYPES.indexOf(ch.toLowerCase());
          if (type >= 0) cells[(r << 3) | c] = type * 2 + color;
          c++;
        }
      }
    }
    const side = parts[1] === 'b' ? BLACK : WHITE;
    const castling = { K: false, Q: false, k: false, q: false };
    if (parts[2] && parts[2] !== '-') for (const ch of parts[2]) castling[ch] = true;
    const ep = (parts[3] && parts[3] !== '-') ? sq2i(parts[3]) : -1;
    const half = (parts[4] != null) ? (+parts[4]) : 0;
    const full = (parts[5] != null) ? (+parts[5]) : 1;
    return { cells, side, castling, ep, half, full };
  }

  class Game {
    constructor(fen) {
      this.hist = [];
      this.undoStack = [];
      this.posMap = new Map();
      this.kingW = -1;
      this.kingB = -1;
      this._load(fen || START_FEN);
    }
    _load(fen) {
      const p = parseFen(fen);
      this.cells = p.cells;
      this.side = p.side;
      this.castling = p.castling;
      this.ep = p.ep;
      this.half = p.half;
      this.full = p.full;
      this.findKings();
      this.posMap = new Map();
      this.posMap.set(this.positionKey(), 1);
    }
    findKings() {
      this.kingW = -1; this.kingB = -1;
      for (let i = 0; i < 64; i++) {
        const p = this.cells[i];
        if (p === EMPTY) continue;
        if ((p >> 1) === KING) { if (p & 1) this.kingB = i; else this.kingW = i; }
      }
    }
    positionKey() {
      let s = '';
      for (let i = 0; i < 64; i++) {
        const p = this.cells[i];
        s += (p === EMPTY ? '.' : TYPES[p >> 1] + ((p & 1) ? 'b' : 'w'));
      }
      s += '#' + this.side;
      s += (this.castling.K ? 'K' : '') + (this.castling.Q ? 'Q' : '') + (this.castling.k ? 'k' : '') + (this.castling.q ? 'q' : '');
      s += '@' + this.ep;
      return s;
    }
    isAttacked(sq, attacker) {
      const r = sq >> 3, c = sq & 7;
      const pr = (attacker === WHITE) ? r + 1 : r - 1;
      for (let dc = -1; dc <= 1; dc += 2) {
        const cc = c + dc;
        if (cc < 0 || cc > 7 || pr < 0 || pr > 7) continue;
        const p = this.cells[(pr << 3) | cc];
        if (p !== EMPTY && (p & 1) === attacker && (p >> 1) === PAWN) return true;
      }
      for (const d of KNIGHT_DIRS) {
        const rr = r + d[0], cc = c + d[1];
        if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
        const p = this.cells[(rr << 3) | cc];
        if (p !== EMPTY && (p & 1) === attacker && (p >> 1) === KNIGHT) return true;
      }
      for (const d of KING_DIRS) {
        const rr = r + d[0], cc = c + d[1];
        if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
        const p = this.cells[(rr << 3) | cc];
        if (p !== EMPTY && (p & 1) === attacker && (p >> 1) === KING) return true;
      }
      for (const d of ROOK_DIRS) {
        let rr = r + d[0], cc = c + d[1];
        while (rr >= 0 && rr <= 7 && cc >= 0 && cc <= 7) {
          const p = this.cells[(rr << 3) | cc];
          if (p !== EMPTY) { if ((p & 1) === attacker && ((p >> 1) === ROOK || (p >> 1) === QUEEN)) return true; break; }
          rr += d[0]; cc += d[1];
        }
      }
      for (const d of BISHOP_DIRS) {
        let rr = r + d[0], cc = c + d[1];
        while (rr >= 0 && rr <= 7 && cc >= 0 && cc <= 7) {
          const p = this.cells[(rr << 3) | cc];
          if (p !== EMPTY) { if ((p & 1) === attacker && ((p >> 1) === BISHOP || (p >> 1) === QUEEN)) return true; break; }
          rr += d[0]; cc += d[1];
        }
      }
      return false;
    }
    inCheck(color) {
      const k = (color === WHITE) ? this.kingW : this.kingB;
      if (k === -1) return false;
      return this.isAttacked(k, color ^ 1);
    }
    _addPawn(moves, from, to, color, isDouble, isCap, promoRow) {
      const piece = this.cells[from];
      const capType = isCap ? (this.cells[to] >> 1) : -1;
      let flags = (isCap ? 'c' : '') + (isDouble ? 'd' : '');
      if ((to >> 3) === promoRow) {
        for (const pt of [QUEEN, ROOK, BISHOP, KNIGHT]) moves.push({ from, to, piece, captured: capType, promo: pt, flags: flags + 'p', color });
      } else {
        moves.push({ from, to, piece, captured: capType, promo: -1, flags, color });
      }
    }
    genPawnMoves(moves, i, color, row, col) {
      const dir = (color === WHITE) ? -8 : 8;
      const startRow = (color === WHITE) ? 6 : 1;
      const promoRow = (color === WHITE) ? 0 : 7;
      if (row !== ((color === WHITE) ? 0 : 7)) {
        const one = i + dir;
        if (one >= 0 && one < 64 && this.cells[one] === EMPTY) {
          this._addPawn(moves, i, one, color, false, false, promoRow);
          if (row === startRow) {
            const two = i + 2 * dir;
            if (this.cells[two] === EMPTY) this._addPawn(moves, i, two, color, true, false, promoRow);
          }
        }
      }
      const dr = (color === WHITE) ? -1 : 1;
      for (let dc = -1; dc <= 1; dc += 2) {
        const cc = col + dc;
        if (cc < 0 || cc > 7) continue;
        const rr = row + dr;
        if (rr < 0 || rr > 7) continue;
        const t = (rr << 3) | cc;
        const target = this.cells[t];
        if (target !== EMPTY && (target & 1) !== color) this._addPawn(moves, i, t, color, false, true, promoRow);
        else if (target === EMPTY && t === this.ep) moves.push({ from: i, to: t, piece: this.cells[i], captured: PAWN, promo: -1, flags: 'ce', color });
      }
    }
    _tryCastle(moves, i, color) {
      const homeRow = (color === WHITE) ? 7 : 0;
      if (i !== ((homeRow << 3) | 4)) return;
      const enemy = color ^ 1;
      const rightK = (color === WHITE) ? 'K' : 'k';
      const rightQ = (color === WHITE) ? 'Q' : 'q';
      if (this.castling[rightK]) {
        const rookIdx = (homeRow << 3) | 7, f = (homeRow << 3) | 5, g = (homeRow << 3) | 6;
        const rk = this.cells[rookIdx];
        if (rk !== EMPTY && (rk >> 1) === ROOK && (rk & 1) === color &&
            this.cells[f] === EMPTY && this.cells[g] === EMPTY &&
            !this.isAttacked(i, enemy) && !this.isAttacked(f, enemy) && !this.isAttacked(g, enemy)) {
          moves.push({ from: i, to: g, piece: this.cells[i], captured: -1, promo: -1, flags: 'k', color });
        }
      }
      if (this.castling[rightQ]) {
        const rookIdx = (homeRow << 3) | 0, b = (homeRow << 3) | 1, c = (homeRow << 3) | 2, d = (homeRow << 3) | 3;
        const rk = this.cells[rookIdx];
        if (rk !== EMPTY && (rk >> 1) === ROOK && (rk & 1) === color &&
            this.cells[b] === EMPTY && this.cells[c] === EMPTY && this.cells[d] === EMPTY &&
            !this.isAttacked(i, enemy) && !this.isAttacked(d, enemy) && !this.isAttacked(c, enemy)) {
          moves.push({ from: i, to: c, piece: this.cells[i], captured: -1, promo: -1, flags: 'q', color });
        }
      }
    }
    genPseudoMoves() {
      const moves = [];
      const color = this.side;
      for (let i = 0; i < 64; i++) {
        const p = this.cells[i];
        if (p === EMPTY || (p & 1) !== color) continue;
        const type = p >> 1, row = i >> 3, col = i & 7;
        if (type === PAWN) this.genPawnMoves(moves, i, color, row, col);
        else if (type === KNIGHT || type === KING) {
          const dirs = (type === KNIGHT) ? KNIGHT_DIRS : KING_DIRS;
          for (const d of dirs) {
            const r2 = row + d[0], c2 = col + d[1];
            if (r2 < 0 || r2 > 7 || c2 < 0 || c2 > 7) continue;
            const t = (r2 << 3) | c2, target = this.cells[t];
            if (target === EMPTY) moves.push({ from: i, to: t, piece: p, captured: -1, promo: -1, flags: '', color });
            else if ((target & 1) !== color) moves.push({ from: i, to: t, piece: p, captured: target >> 1, promo: -1, flags: 'c', color });
          }
          if (type === KING) this._tryCastle(moves, i, color);
        } else {
          const dirs = (type === BISHOP) ? BISHOP_DIRS : (type === ROOK) ? ROOK_DIRS : QUEEN_DIRS;
          for (const d of dirs) {
            let r2 = row + d[0], c2 = col + d[1];
            while (r2 >= 0 && r2 <= 7 && c2 >= 0 && c2 <= 7) {
              const t = (r2 << 3) | c2, target = this.cells[t];
              if (target === EMPTY) moves.push({ from: i, to: t, piece: p, captured: -1, promo: -1, flags: '', color });
              else { if ((target & 1) !== color) moves.push({ from: i, to: t, piece: p, captured: target >> 1, promo: -1, flags: 'c', color }); break; }
              r2 += d[0]; c2 += d[1];
            }
          }
        }
      }
      return moves;
    }
    legalMovesInternal() {
      const pseudo = this.genPseudoMoves(), out = [];
      for (const m of pseudo) {
        this.makeMove(m);
        if (!this.inCheck(m.color)) out.push(m);
        this.unmakeMove();
      }
      return out;
    }
    makeMove(m) {
      const from = m.from, to = m.to;
      const piece = this.cells[from], color = m.color, type = piece >> 1;
      const isEP = m.flags.indexOf('e') >= 0;
      const isCastle = (m.flags.indexOf('k') >= 0 || m.flags.indexOf('q') >= 0);
      const isPromo = m.promo !== -1;
      const isDouble = m.flags.indexOf('d') >= 0;
      let capIndex = -1, capPiece = -1;
      if (isEP) { capIndex = to + ((color === WHITE) ? 8 : -8); capPiece = this.cells[capIndex]; this.cells[capIndex] = EMPTY; }
      else if (this.cells[to] !== EMPTY) { capIndex = to; capPiece = this.cells[to]; }
      const rec = {
        from, to, color, capIndex, capPiece, isPromo, isCastle,
        castleSide: isCastle ? ((m.flags.indexOf('k') >= 0) ? 'k' : 'q') : '',
        prevCastling: { K: this.castling.K, Q: this.castling.Q, k: this.castling.k, q: this.castling.q },
        prevEp: this.ep, prevHalf: this.half, prevFull: this.full,
        prevKingW: this.kingW, prevKingB: this.kingB
      };
      this.cells[to] = isPromo ? (m.promo * 2 + color) : piece;
      this.cells[from] = EMPTY;
      if (type === KING) { if (color === WHITE) this.kingW = to; else this.kingB = to; }
      if (isCastle) {
        let rookFrom, rookTo;
        if (color === WHITE) { if (rec.castleSide === 'k') { rookFrom = sq2i('h1'); rookTo = sq2i('f1'); } else { rookFrom = sq2i('a1'); rookTo = sq2i('d1'); } }
        else { if (rec.castleSide === 'k') { rookFrom = sq2i('h8'); rookTo = sq2i('f8'); } else { rookFrom = sq2i('a8'); rookTo = sq2i('d8'); } }
        this.cells[rookTo] = this.cells[rookFrom]; this.cells[rookFrom] = EMPTY;
      }
      if (type === KING) { if (color === WHITE) { this.castling.K = false; this.castling.Q = false; } else { this.castling.k = false; this.castling.q = false; } }
      if (type === ROOK) {
        if (from === sq2i('a1')) this.castling.Q = false;
        else if (from === sq2i('h1')) this.castling.K = false;
        else if (from === sq2i('a8')) this.castling.q = false;
        else if (from === sq2i('h8')) this.castling.k = false;
      }
      if (capPiece !== -1 && (capPiece >> 1) === ROOK) {
        if (capIndex === sq2i('a1')) this.castling.Q = false;
        else if (capIndex === sq2i('h1')) this.castling.K = false;
        else if (capIndex === sq2i('a8')) this.castling.q = false;
        else if (capIndex === sq2i('h8')) this.castling.k = false;
      }
      this.ep = (type === PAWN && isDouble) ? (from + ((color === WHITE) ? -8 : 8)) : -1;
      this.half = (type === PAWN || capPiece !== -1) ? 0 : this.half + 1;
      this.side = color ^ 1;
      if (this.side === WHITE) this.full++;
      const key = this.positionKey();
      rec.keyAdded = key;
      this.posMap.set(key, (this.posMap.get(key) || 0) + 1);
      m._undo = rec;
      this.undoStack.push(m);
    }
    unmakeMove() {
      const m = this.undoStack.pop(), rec = m._undo, color = rec.color;
      if (rec.isPromo) { this.cells[rec.from] = PAWN * 2 + color; this.cells[rec.to] = EMPTY; }
      else { this.cells[rec.from] = this.cells[rec.to]; this.cells[rec.to] = EMPTY; }
      if (rec.capPiece !== -1) this.cells[rec.capIndex] = rec.capPiece;
      if (rec.isCastle) {
        let rookFrom, rookTo;
        if (color === WHITE) { if (rec.castleSide === 'k') { rookFrom = sq2i('f1'); rookTo = sq2i('h1'); } else { rookFrom = sq2i('d1'); rookTo = sq2i('a1'); } }
        else { if (rec.castleSide === 'k') { rookFrom = sq2i('f8'); rookTo = sq2i('h8'); } else { rookFrom = sq2i('d8'); rookTo = sq2i('a8'); } }
        this.cells[rookTo] = this.cells[rookFrom]; this.cells[rookFrom] = EMPTY;
      }
      this.castling = rec.prevCastling;
      this.ep = rec.prevEp; this.half = rec.prevHalf; this.full = rec.prevFull;
      this.kingW = rec.prevKingW; this.kingB = rec.prevKingB; this.side = color;
      this.posMap.set(rec.keyAdded, this.posMap.get(rec.keyAdded) - 1);
    }
    turn() { return COLOR_CHAR[this.side]; }
    board() {
      const out = new Array(64);
      for (let i = 0; i < 64; i++) { const p = this.cells[i]; out[i] = (p === EMPTY) ? null : { type: TYPES[p >> 1], color: COLOR_CHAR[p & 1] }; }
      return out;
    }
    legalMoves(fromSquare) {
      const internal = this.legalMovesInternal();
      if (!fromSquare) return internal.map((m) => toPublicMove(this, m, internal));
      const fi = sq2i(fromSquare);
      return internal.filter((m) => m.from === fi).map((m) => toPublicMove(this, m, internal));
    }
    move(opts) {
      if (!opts) return null;
      const fromI = sq2i(opts.from), toI = sq2i(opts.to);
      if (fromI === -1 || toI === -1) return null;
      const legal = this.legalMovesInternal();
      let cand = legal.find((m) => m.from === fromI && m.to === toI);
      if (!cand) return null;
      if (cand.promo !== -1) {
        const eff = opts.promotion ? TYPES.indexOf(String(opts.promotion).toLowerCase()) : QUEEN;
        const better = legal.find((m) => m.from === fromI && m.to === toI && m.promo === eff);
        if (better) cand = better;
      }
      const pub = toPublicMove(this, cand, legal);
      this.makeMove(cand);
      this.hist.push(pub);
      return pub;
    }
    undo() {
      if (!this.hist.length) return null;
      const pub = this.hist.pop();
      this.unmakeMove();
      return pub;
    }
    _insufficient() {
      let wAny = 0, bAny = 0, wMin = 0, bMin = 0;
      for (let i = 0; i < 64; i++) {
        const p = this.cells[i];
        if (p === EMPTY || (p >> 1) === KING) continue;
        const type = p >> 1, color = p & 1;
        if (color === WHITE) { wAny++; if (type === BISHOP || type === KNIGHT) wMin++; }
        else { bAny++; if (type === BISHOP || type === KNIGHT) bMin++; }
      }
      if (wAny === 0 && bAny === 0) return true;
      if (wAny === 0 && bAny === bMin && bMin <= 1) return true;
      if (bAny === 0 && wAny === wMin && wMin <= 1) return true;
      if (wAny === 1 && wMin === 1 && bAny === 1 && bMin === 1) return true;
      return false;
    }
    status() {
      const inChk = this.inCheck(this.side);
      const moves = this.legalMovesInternal();
      if (moves.length === 0) {
        if (inChk) { const winner = this.side ^ 1; return { over: true, check: true, result: (winner === WHITE ? '1-0' : '0-1'), reason: 'checkmate' }; }
        return { over: true, check: false, result: '1/2-1/2', reason: 'stalemate' };
      }
      if (this.half >= 100) return { over: true, check: false, result: '1/2-1/2', reason: 'fifty' };
      const key = this.positionKey();
      if ((this.posMap.get(key) || 0) >= 3) return { over: true, check: false, result: '1/2-1/2', reason: 'repetition' };
      if (this._insufficient()) return { over: true, check: false, result: '1/2-1/2', reason: 'insufficient' };
      return { over: false, check: inChk, result: null, reason: null };
    }
    history() { return this.hist.slice(); }
    fen() {
      let s = '';
      for (let r = 0; r < 8; r++) {
        let empty = 0;
        for (let c = 0; c < 8; c++) {
          const p = this.cells[(r << 3) | c];
          if (p === EMPTY) empty++;
          else { if (empty > 0) { s += empty; empty = 0; } s += (p & 1) === WHITE ? TYPES[p >> 1].toUpperCase() : TYPES[p >> 1]; }
        }
        if (empty > 0) s += empty;
        if (r < 7) s += '/';
      }
      s += ' ' + ((this.side === WHITE) ? 'w' : 'b') + ' ';
      let castle = (this.castling.K ? 'K' : '') + (this.castling.Q ? 'Q' : '') + (this.castling.k ? 'k' : '') + (this.castling.q ? 'q' : '');
      s += castle;
      s += ' ' + ((this.ep === -1) ? '-' : i2sq(this.ep)) + ' ' + this.half + ' ' + this.full;
      return s;
    }
    kingSquare(color) {
      const c = (color === 'w') ? WHITE : BLACK;
      const idx = (c === WHITE) ? this.kingW : this.kingB;
      return (idx === -1) ? null : i2sq(idx);
    }
    captured() {
      const w = [], b = [];
      for (const m of this.hist) { if (m.captured) { if (m.color === 'w') b.push(m.captured); else w.push(m.captured); } }
      return { w, b };
    }
  }

  function toPublicMove(g, m, allLegal) {
    let s = '';
    if (m.flags.indexOf('k') >= 0) s = 'O-O';
    else if (m.flags.indexOf('q') >= 0) s = 'O-O-O';
    else {
      const type = m.piece >> 1;
      if (type === PAWN) {
        if (m.captured !== -1) s = FILE[m.from & 7] + 'x' + i2sq(m.to);
        else s = i2sq(m.to);
        if (m.promo !== -1) s += '=' + TYPES[m.promo].toUpperCase();
      } else {
        s = TYPES[type].toUpperCase();
        const others = allLegal.filter((x) => x.piece === m.piece && x.to === m.to && x.from !== m.from);
        if (others.length > 0) {
          const sameFile = others.some((x) => (x.from & 7) === (m.from & 7));
          const sameRank = others.some((x) => (x.from >> 3) === (m.from >> 3));
          if (!sameFile) s += FILE[m.from & 7];
          else if (!sameRank) s += String(8 - (m.from >> 3));
          else s += FILE[m.from & 7] + String(8 - (m.from >> 3));
        }
        if (m.captured !== -1) s += 'x';
        s += i2sq(m.to);
      }
    }
    g.makeMove(m);
    const opp = m.color ^ 1;
    let suffix = '';
    if (g.inCheck(opp)) suffix = (g.legalMovesInternal().length === 0) ? '#' : '+';
    g.unmakeMove();
    s += suffix;
    return {
      from: i2sq(m.from), to: i2sq(m.to), piece: TYPES[m.piece >> 1], color: COLOR_CHAR[m.color],
      captured: (m.captured !== -1) ? TYPES[m.captured] : null,
      promotion: (m.promo !== -1) ? TYPES[m.promo] : null,
      flags: m.flags, san: s,
      uci: i2sq(m.from) + i2sq(m.to) + ((m.promo !== -1) ? TYPES[m.promo] : '')
    };
  }

  let gNodes = 0, gAbort = false, gDeadline = 0;
  function bumpNodes() { gNodes++; if (gDeadline && (gNodes & 1023) === 0 && Date.now() > gDeadline) gAbort = true; }
  function pst(type, i, color) { const row = i >> 3, col = i & 7, t = PST[type]; return (color === WHITE) ? t[row][col] : t[7 - row][col]; }
  function evalWhite(g) {
    let s = 0;
    for (let i = 0; i < 64; i++) { const p = g.cells[i]; if (p === EMPTY) continue; const type = p >> 1, color = p & 1, v = VAL[type] + pst(type, i, color); s += (color === WHITE) ? v : -v; }
    return s;
  }
  function standValue(g) { return (g.side === WHITE) ? evalWhite(g) : -evalWhite(g); }
  function moveScore(m, ttMove) {
    if (m === ttMove) return 100000000;
    let s = 0;
    if (m.promo !== -1) s += 100000;
    if (m.captured !== -1) s += VAL[m.captured] * 32 - VAL[m.piece >> 1];
    return s;
  }
  function orderMoves(list, ttMove) {
    for (let i = 0; i < list.length; i++) list[i]._s = moveScore(list[i], ttMove);
    list.sort((a, b) => b._s - a._s);
  }
  function quiesce(g, alpha, beta, ply, qd) {
    if (gAbort) return 0;
    bumpNodes();
    if (qd <= 0) return standValue(g);
    const inChk = g.inCheck(g.side);
    let stand;
    if (inChk) stand = -INF;
    else { stand = standValue(g); if (stand >= beta) return stand; if (stand > alpha) alpha = stand; }
    let moves = g.genPseudoMoves();
    if (!inChk) {
      const caps = [];
      for (const m of moves) if (m.captured !== -1 || m.promo !== -1) caps.push(m);
      if (caps.length === 0) return alpha;
      moves = caps;
    }
    orderMoves(moves, null);
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      g.makeMove(m);
      if (g.inCheck(m.color)) { g.unmakeMove(); continue; }
      const sc = -quiesce(g, -beta, -alpha, ply + 1, qd - 1);
      g.unmakeMove();
      if (sc > alpha) { alpha = sc; if (alpha >= beta) break; }
    }
    return alpha;
  }
  function search(g, depth, alpha, beta, ply, tt) {
    if (gAbort) return 0;
    bumpNodes();
    if (depth <= 0) return quiesce(g, alpha, beta, ply, 32);
    const a0 = alpha, b0 = beta;
    const key = g.positionKey();
    let ttMove = null;
    if (tt) {
      const e = tt.get(key);
      if (e) {
        if (e.depth >= depth) {
          let sc = e.score;
          if (e.matePly !== -1) sc = (sc > 0) ? (MATE - (ply - e.matePly)) : -(MATE - (ply - e.matePly));
          if (e.flag === 0) return sc;
          if (e.flag === 1 && sc >= beta) return sc;
          if (e.flag === 2 && sc <= alpha) return sc;
        }
        ttMove = e.best;
      }
    }
    const inChk = g.inCheck(g.side);
    const moves = g.genPseudoMoves();
    orderMoves(moves, ttMove);
    let best = -INF, hadLegal = false, bestM = null;
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      g.makeMove(m);
      if (g.inCheck(m.color)) { g.unmakeMove(); continue; }
      hadLegal = true;
      const sc = -search(g, depth - 1, -beta, -alpha, ply + 1, tt);
      g.unmakeMove();
      if (sc > best) { best = sc; bestM = m; }
      if (sc > alpha) alpha = sc;
      if (alpha >= beta) break;
    }
    if (!hadLegal) { if (inChk) return -(MATE - ply); return 0; }
    if (tt) {
      let flag = (best <= a0) ? 2 : (best >= b0) ? 1 : 0;
      let matePly = (best > MATE - 1000 || best < -(MATE - 1000)) ? ply : -1;
      tt.set(key, { depth, score: best, flag, matePly, best: bestM });
    }
    return best;
  }
  function searchDepth(g, d, a, b, ply, tt) { return (d <= 0) ? quiesce(g, a, b, ply, 32) : search(g, d, a, b, ply, tt); }

  function idSearch(game, timeMs, maxDepth) {
    gDeadline = Date.now() + timeMs; gAbort = false; gNodes = 0;
    const tt = new Map();
    let best = null;
    for (let d = 1; d <= maxDepth; d++) {
      const list = game.legalMovesInternal();
      if (!list.length) break;
      if (best) {
        const idx = list.findIndex((m) => m.from === best.from && m.to === best.to && m.promo === best.promo);
        if (idx > 0) { const tmp = list[0]; list[0] = list[idx]; list[idx] = tmp; }
      }
      let iterBest = null, iterScore = -INF, alpha = -INF, complete = true;
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        game.makeMove(m);
        const sc = -searchDepth(game, d - 1, -INF, -alpha, 1, tt);
        game.unmakeMove();
        if (sc > iterScore) { iterScore = sc; iterBest = m; }
        if (sc > alpha) alpha = sc;
        if (gAbort) { complete = false; break; }
      }
      if (complete && iterBest) best = iterBest;
      else if (!best && iterBest) best = iterBest;
      if (gAbort) break;
      if (iterScore >= MATE - 1000 || iterScore <= -(MATE - 1000)) break;
      if (Date.now() > gDeadline) break;
    }
    gAbort = false;
    return best;
  }
  function begMove(legal) {
    const caps = legal.filter((m) => m.captured !== -1);
    if (caps.length && Math.random() < 0.5) return caps[(Math.random() * caps.length) | 0];
    return legal[(Math.random() * legal.length) | 0];
  }
  function casualMove(game, legal) {
    let best = null, bestScore = -INF;
    for (const m of legal) {
      game.makeMove(m);
      const ew = evalWhite(game);
      const sc = ((m.color === WHITE) ? ew : -ew) + (Math.random() * 200 - 100);
      game.unmakeMove();
      if (sc > bestScore) { bestScore = sc; best = m; }
    }
    return best;
  }
  function clubMove(game) {
    const legal = game.legalMovesInternal();
    if (!legal.length) return null;
    orderMoves(legal, null);
    let best = null, bestScore = -INF, alpha = -INF;
    for (const m of legal) {
      game.makeMove(m);
      const sc = -searchDepth(game, 2, -INF, -alpha, 1, null);
      game.unmakeMove();
      if (sc > bestScore) { bestScore = sc; best = m; }
      if (sc > alpha) alpha = sc;
    }
    return best;
  }

  function createGame(fen) { return new Game(fen); }
  function perft(fen, depth) {
    const g = new Game(fen || START_FEN);
    return perftOn(g, depth);
  }
  function perftOn(g, depth) {
    if (depth === 1) return g.legalMovesInternal().length;
    let n = 0;
    const moves = g.legalMovesInternal();
    for (const m of moves) { g.makeMove(m); n += perftOn(g, depth - 1); g.unmakeMove(); }
    return n;
  }
  function bestMove(game, level) {
    try {
      const st = game.status();
      if (st.over) return null;
      const legal = game.legalMovesInternal();
      if (!legal.length) return null;
      let m = null;
      try {
        switch (level) {
          case 1: m = begMove(legal); break;
          case 2: m = casualMove(game, legal); break;
          case 3: m = clubMove(game); break;
          case 4: m = idSearch(game, 1200, 4); break;
          case 5: m = idSearch(game, 2500, 6); break;
          default: m = begMove(legal); break;
        }
      } catch (e) { m = legal[(Math.random() * legal.length) | 0]; }
      if (!m) m = legal[0];
      return toPublicMove(game, m, legal);
    } catch (e) {
      try { const l2 = game.legalMovesInternal(); return l2.length ? toPublicMove(game, l2[0], l2) : null; } catch (e2) { return null; }
    }
  }

  const obj = { createGame, bestMove, perft };
  if (typeof globalThis !== 'undefined') globalThis.ChessEngine = obj;
  return obj;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = ChessEngine;
