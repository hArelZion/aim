class ChessApp {
  constructor() {
    this.game = null;
    this.worker = null;
    this.workerId = 0;
    this.selectedSquare = null;
    this.legalMoves = [];
    this.isRobotGame = false;
    this.robotLevel = 3;
    this.robotColor = 'b';
    this.isFlipped = false;
    this.isSoundOn = true;
    this.audioContext = null;
    this.gameState = null;
    this.dragStart = null;
    this.dragPiece = null;
    this.thinking = false;
    this.initUI();
    this.initWorker();
    this.loadSettings();
    this.checkSavedGame();
  }

  initUI() {
    // DOM elements
    this.elements = {
      startScreen: document.getElementById('start-screen'),
      gameScreen: document.getElementById('game-screen'),
      playRobotBtn: document.getElementById('play-robot'),
      twoPlayersBtn: document.getElementById('two-players'),
      continueBtn: document.getElementById('continue'),
      robotOptions: document.getElementById('robot-options'),
      levelBtns: document.querySelectorAll('.level-btn'),
      colorBtns: document.querySelectorAll('.color-btn'),
      startRobotGameBtn: document.getElementById('start-robot-game'),
      board: document.getElementById('board'),
      topPlayer: document.getElementById('top-player'),
      bottomPlayer: document.getElementById('bottom-player'),
      statusLine: document.getElementById('status-line'),
      undoBtn: document.getElementById('undo-btn'),
      flipBtn: document.getElementById('flip-btn'),
      newGameBtn: document.getElementById('new-game-btn'),
      menuBtn: document.getElementById('menu-btn'),
      toggleMoveList: document.getElementById('toggle-move-list'),
      moveList: document.getElementById('move-list'),
      promotionModal: document.getElementById('promotion-modal'),
      promotionOptions: document.querySelector('.promotion-options'),
      gameOverModal: document.getElementById('game-over-modal'),
      gameResult: document.getElementById('game-result'),
      gameReason: document.getElementById('game-reason'),
      rematchBtn: document.getElementById('rematch-btn'),
      menuBtnModal: document.getElementById('menu-btn-modal'),
      soundToggle: document.getElementById('sound-toggle')
    };

    // Event listeners
    this.elements.playRobotBtn.addEventListener('click', () => this.showRobotOptions());
    this.elements.twoPlayersBtn.addEventListener('click', () => this.startGame(false));
    this.elements.continueBtn.addEventListener('click', () => this.continueGame());
    this.elements.startRobotGameBtn.addEventListener('click', () => this.startGame(true));

    this.elements.levelBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.elements.levelBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.robotLevel = parseInt(btn.dataset.level);
        this.saveSettings();
      });
    });

    this.elements.colorBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.elements.colorBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.robotColor = btn.dataset.color;
        this.saveSettings();
      });
    });

    this.elements.undoBtn.addEventListener('click', () => this.undoMove());
    this.elements.flipBtn.addEventListener('click', () => this.flipBoard());
    this.elements.newGameBtn.addEventListener('click', () => this.showStartScreen());
    this.elements.menuBtn.addEventListener('click', () => this.showStartScreen());
    this.elements.toggleMoveList.addEventListener('click', () => this.toggleMoveList());
    this.elements.rematchBtn.addEventListener('click', () => this.rematch());
    this.elements.menuBtnModal.addEventListener('click', () => this.showStartScreen());
    this.elements.soundToggle.addEventListener('click', () => this.toggleSound());

    // Initialize board
    this.initBoard();
    this.initCoordinates();
  }

  initBoard() {
    const board = this.elements.board;
    board.innerHTML = '';

    for (let rank = 8; rank >= 1; rank--) {
      for (let file = 0; file < 8; file++) {
        const square = document.createElement('div');
        const fileChar = String.fromCharCode(97 + file);
        const squareId = fileChar + rank;

        square.id = squareId;
        square.className = `square ${(file + rank) % 2 === 0 ? 'light' : 'dark'}`;
        square.setAttribute('aria-label', `${squareId} empty`);

        board.appendChild(square);
      }
    }
    this.initBoardInput();
  }

  initCoordinates() {
    const filesContainer = document.querySelector('.files');
    const ranksContainer = document.querySelector('.ranks');

    filesContainer.innerHTML = '';
    ranksContainer.innerHTML = '';

    // Add empty divs for padding
    filesContainer.innerHTML = '<div></div>';
    ranksContainer.innerHTML = '<div></div>';

    // Add file letters (a-h)
    for (let file = 0; file < 8; file++) {
      const fileChar = String.fromCharCode(97 + file);
      const fileElement = document.createElement('div');
      fileElement.dataset.file = fileChar;
      filesContainer.appendChild(fileElement);
    }

    // Add rank numbers (1-8)
    for (let rank = 8; rank >= 1; rank--) {
      const rankElement = document.createElement('div');
      rankElement.dataset.rank = rank;
      ranksContainer.appendChild(rankElement);
    }

    // Add empty divs for padding
    filesContainer.innerHTML += '<div></div>';
    ranksContainer.innerHTML += '<div></div>';
  }

  initWorker() {
    try {
      this.worker = new Worker('worker.js');
      this.worker.onmessage = (e) => this.handleWorkerMessage(e);
    } catch (error) {
      console.warn('Web Workers not supported, falling back to main thread');
      this.worker = null;
    }
  }

  loadSettings() {
    try {
      const savedSettings = localStorage.getItem('chessSettings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        this.robotLevel = settings.level || 3;
        this.robotColor = settings.color || 'b';
        this.isSoundOn = settings.soundOn !== false;

        // Update UI to reflect saved settings
        this.elements.levelBtns.forEach(btn => {
          if (parseInt(btn.dataset.level) === this.robotLevel) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });

        this.elements.colorBtns.forEach(btn => {
          if (btn.dataset.color === this.robotColor) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });

        this.updateSoundButton();
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  saveSettings() {
    try {
      const settings = {
        level: this.robotLevel,
        color: this.robotColor,
        soundOn: this.isSoundOn
      };
      localStorage.setItem('chessSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  checkSavedGame() {
    try {
      const savedGame = localStorage.getItem('chessSavedGame');
      if (savedGame) {
        this.elements.continueBtn.classList.remove('hidden');
      }
    } catch (error) {
      console.error('Error checking saved game:', error);
    }
  }

  saveGame() {
    try {
      if (this.game) {
        const moves = this.game.history().map(move => move.uci);
        localStorage.setItem('chessSavedGame', JSON.stringify({
          isRobotGame: this.isRobotGame,
          robotLevel: this.robotLevel,
          robotColor: this.robotColor,
          moves: moves
        }));
      }
    } catch (error) {
      console.error('Error saving game:', error);
    }
  }

  clearSavedGame() {
    try {
      localStorage.removeItem('chessSavedGame');
      this.elements.continueBtn.classList.add('hidden');
    } catch (error) {
      console.error('Error clearing saved game:', error);
    }
  }

  showRobotOptions() {
    this.elements.robotOptions.classList.toggle('hidden');
  }

  startGame(isRobotGame, fen = null) {
    this.isRobotGame = isRobotGame;
    this.robotLevel = parseInt(document.querySelector('.level-btn.active').dataset.level);
    const humanColor = document.querySelector('.color-btn.active').dataset.color;

    if (humanColor === 'r') {
      this.robotColor = Math.random() < 0.5 ? 'w' : 'b';
    } else {
      this.robotColor = humanColor === 'w' ? 'b' : 'w';
    }

    this.game = ChessEngine.createGame(fen);
    this.isFlipped = this.robotColor === 'w';
    this.selectedSquare = null;
    this.legalMoves = [];
    this.clearHighlights();
    this.renderBoard();
    this.updatePlayerInfo();
    this.updateMoveList();
    this.updateStatusLine();
    this.elements.startScreen.classList.add('hidden');
    this.elements.gameScreen.classList.remove('hidden');
    this.elements.robotOptions.classList.add('hidden');

    if (this.isRobotGame && this.game.turn() === this.robotColor) {
      this.getRobotMove();
    }
  }

  continueGame() {
    try {
      const savedGame = localStorage.getItem('chessSavedGame');
      if (savedGame) {
        const gameData = JSON.parse(savedGame);
        this.isRobotGame = gameData.isRobotGame;
        this.robotLevel = gameData.robotLevel;
        this.robotColor = gameData.robotColor;

        this.game = ChessEngine.createGame();
        gameData.moves.forEach(move => {
          this.game.move({
            from: move.slice(0, 2),
            to: move.slice(2, 4),
            promotion: move[4]
          });
        });

        this.isFlipped = this.robotColor === 'w';
        this.selectedSquare = null;
        this.legalMoves = [];
        this.clearHighlights();
        this.renderBoard();
        this.updatePlayerInfo();
        this.updateMoveList();
        this.updateStatusLine();
        this.elements.startScreen.classList.add('hidden');
        this.elements.gameScreen.classList.remove('hidden');

        if (this.isRobotGame && this.game.turn() === this.robotColor) {
          this.getRobotMove();
        }
      }
    } catch (error) {
      console.error('Error continuing game:', error);
      this.startGame(false);
    }
  }

  rematch() {
    this.startGame(this.isRobotGame);
    this.elements.gameOverModal.classList.add('hidden');
  }

  showStartScreen() {
    this.saveGame();
    this.elements.gameScreen.classList.add('hidden');
    this.elements.startScreen.classList.remove('hidden');
    this.elements.robotOptions.classList.add('hidden');
    this.elements.gameOverModal.classList.add('hidden');
  }

  initBoardInput() {
    this.elements.board.addEventListener('pointerdown', this.handlePointerDown.bind(this));
    this.elements.board.addEventListener('pointermove', this.handlePointerMove.bind(this));
    this.elements.board.addEventListener('pointerup', this.handlePointerUp.bind(this));
    this.elements.board.addEventListener('pointercancel', this.handlePointerUp.bind(this));
  }

  handlePointerDown(e) {
    const sq = e.target.closest('.square');
    if (!sq || this.game.status().over || (this.isRobotGame && this.game.turn() === this.robotColor) || this.thinking) return;
    this.pointerStart = {x: e.clientX, y: e.clientY, square: sq, wasSelected: this.selectedSquare};
    this.dragging = false;
    const piece = sq.querySelector('.piece');
    if (piece && this.game.board()[this.squareToIndex(sq.id)].color === this.game.turn()) {
      if (this.selectedSquare !== sq.id) {
        this.selectedSquare = sq.id;
        this.legalMoves = this.game.legalMoves(sq.id);
        this.renderBoard();
        this.highlightLegalMoves();
      }
      this.dragPiece = piece;
      try { this.elements.board.setPointerCapture(e.pointerId); } catch (e) {}
    }
  }

  handlePointerMove(e) {
    if (!this.pointerStart || !this.dragPiece) return;
    if (!this.dragging && (Math.abs(e.clientX - this.pointerStart.x) > 6 || Math.abs(e.clientY - this.pointerStart.y) > 6)) {
      this.dragging = true;
      this.dragPiece.style.position = 'fixed';
      this.dragPiece.style.pointerEvents = 'none';
      this.dragPiece.style.zIndex = '1000';
      this.dragPiece.classList.add('dragging');
    }
    if (this.dragging) {
      this.dragPiece.style.left = `${e.clientX - this.dragPiece.offsetWidth / 2}px`;
      this.dragPiece.style.top = `${e.clientY - this.dragPiece.offsetHeight / 2}px`;
    }
  }

  handlePointerUp(e) {
    if (!this.pointerStart) return;
    const s = this.pointerStart;
    this.pointerStart = null;
    if (this.dragging) {
      this.dragPiece.style.position = '';
      this.dragPiece.style.left = '';
      this.dragPiece.style.top = '';
      this.dragPiece.style.zIndex = '';
      this.dragPiece.style.pointerEvents = '';
      this.dragPiece.classList.remove('dragging');
      const dropSquare = document.elementFromPoint(e.clientX, e.clientY)?.closest('.square');
      if (dropSquare && this.legalMoves.some(m => m.to === dropSquare.id)) {
        this.tryMove(this.selectedSquare, dropSquare.id);
      } else {
        this.renderBoard();
        this.highlightLegalMoves();
      }
    } else {
      this.handleTap(s.square.id, s.wasSelected);
    }
    this.dragging = false;
    this.dragPiece = null;
  }

  handleTap(sq, wasSelected) {
    if (this.selectedSquare && this.legalMoves.some(m => m.to === sq)) {
      this.tryMove(this.selectedSquare, sq);
      return;
    }
    const piece = this.game.board()[this.squareToIndex(sq)];
    if (piece && piece.color === this.game.turn()) {
      if (wasSelected === sq) {
        this.selectedSquare = null;
        this.legalMoves = [];
        this.renderBoard();
      }
      return;
    }
    this.selectedSquare = null;
    this.legalMoves = [];
    this.renderBoard();
  }

  tryMove(from, to) {
    if (this.legalMoves.some(m => m.to === to && m.promotion)) {
      this.showPromotionModal(from, to);
      return;
    }
    const move = this.game.move({from, to});
    this.selectedSquare = null;
    this.legalMoves = [];
    if (move) this.handleMove(move);
    else this.renderBoard();
  }

  showPromotionModal(from, to) {
    this.elements.promotionModal.classList.remove('hidden');
    this.elements.promotionOptions.innerHTML = '';

    const color = this.game.turn();
    const pieces = ['q', 'r', 'b', 'n'];

    pieces.forEach(piece => {
      const pieceElement = document.createElement('div');
      pieceElement.className = 'promotion-piece';
      pieceElement.innerHTML = PIECES[color + piece];
      pieceElement.addEventListener('click', () => {
        const move = this.game.move({
          from: from,
          to: to,
          promotion: piece
        });

        if (move) {
          this.handleMove(move);
        }

        this.elements.promotionModal.classList.add('hidden');
        this.selectedSquare = null;
        this.legalMoves = [];
        this.clearHighlights();
      });

      this.elements.promotionOptions.appendChild(pieceElement);
    });
  }

  handleMove(move) {
    this.playSound(move);
    this.vibrate(move);
    this.renderBoard();
    this.updatePlayerInfo();
    this.updateMoveList();
    this.updateStatusLine();
    this.saveGame();

    const status = this.game.status();
    if (status.over) {
      this.showGameOver(status);
      return;
    }

    if (this.isRobotGame && this.game.turn() === this.robotColor) {
      this.getRobotMove();
    }
  }

  getRobotMove() {
    this.elements.statusLine.textContent = 'Robot is thinking...';
    this.elements.undoBtn.disabled = true;
    this.thinking = true;

    if (this.worker) {
      this.workerId++;
      const currentId = this.workerId;
      const moves = this.game.history().map(move => move.uci);

      this.worker.postMessage({
        id: currentId,
        moves: moves,
        level: this.robotLevel
      });

      // Fallback timeout in case worker doesn't respond
      setTimeout(() => {
        if (currentId === this.workerId && this.game.turn() === this.robotColor) {
          this.getRobotMoveFallback();
        }
      }, 5000);
    } else {
      // Fallback to main thread
      setTimeout(() => {
        this.getRobotMoveFallback();
      }, 500);
    }
  }

  getRobotMoveFallback() {
    const move = ChessEngine.bestMove(this.game, this.robotLevel);
    if (move) {
      setTimeout(() => {
        this.game.move(move);
        this.handleMove(move);
        this.thinking = false;
      }, 500);
    }
  }

  handleWorkerMessage(e) {
    if (e.data.id === this.workerId && this.game.turn() === this.robotColor) {
      const move = e.data.move;
      if (move) {
        setTimeout(() => {
          this.game.move(move);
          this.handleMove(move);
          this.thinking = false;
        }, 500);
      }
    }
  }

  undoMove() {
    if (!this.game || this.game.status().over || this.thinking) return;

    if (this.isRobotGame && this.game.turn() !== this.robotColor) {
      // Undo both player and robot moves
      const undoneMove1 = this.game.undo();
      if (undoneMove1) {
        const undoneMove2 = this.game.undo();
        if (undoneMove2) {
          this.selectedSquare = null;
          this.legalMoves = [];
          this.clearHighlights();
          this.renderBoard();
          this.updatePlayerInfo();
          this.updateMoveList();
          this.updateStatusLine();
          this.saveGame();
        }
      }
    } else {
      // Undo only the last move
      const undoneMove = this.game.undo();
      if (undoneMove) {
        this.selectedSquare = null;
        this.legalMoves = [];
        this.clearHighlights();
        this.renderBoard();
        this.updatePlayerInfo();
        this.updateMoveList();
        this.updateStatusLine();
        this.saveGame();

        if (this.isRobotGame && this.game.turn() === this.robotColor) {
          this.getRobotMove();
        }
      }
    }
  }

  flipBoard() {
    this.isFlipped = !this.isFlipped;
    this.renderBoard();
  }

  renderBoard() {
    const board = this.game.board();
    const squares = document.querySelectorAll('.square');

    squares.forEach((square, index) => {
      const piece = board[index];
      square.innerHTML = '';

      if (piece) {
        const pieceElement = document.createElement('div');
        pieceElement.className = 'piece';
        pieceElement.innerHTML = PIECES[piece.color + piece.type];
        square.appendChild(pieceElement);
        square.setAttribute('aria-label', `${square.id} ${piece.color} ${piece.type}`);
      } else {
        square.setAttribute('aria-label', `${square.id} empty`);
      }

      // Highlight last move
      const lastMove = this.game.history().slice(-1)[0];
      if (lastMove) {
        if (square.id === lastMove.from || square.id === lastMove.to) {
          square.classList.add('last-move');
        } else {
          square.classList.remove('last-move');
        }
      }

      // Highlight check
      const status = this.game.status();
      if (status.check) {
        const kingSquare = this.game.kingSquare(this.game.turn());
        if (square.id === kingSquare) {
          square.classList.add('check');
        } else {
          square.classList.remove('check');
        }
      } else {
        square.classList.remove('check');
      }
    });

    // Update player names and avatars based on flipped state
    const topPlayerName = this.elements.topPlayer.querySelector('.player-name');
    const bottomPlayerName = this.elements.bottomPlayer.querySelector('.player-name');
    const topAvatarPiece = this.elements.topPlayer.querySelector('.avatar-piece');
    const bottomAvatarPiece = this.elements.bottomPlayer.querySelector('.avatar-piece');

    if (this.isFlipped) {
      topPlayerName.textContent = 'White';
      bottomPlayerName.textContent = 'Black';
      topAvatarPiece.innerHTML = PIECES['wk'];
      bottomAvatarPiece.innerHTML = PIECES['bk'];
      this.elements.bottomPlayer.querySelector('.player-info').style.transform = '';
    } else {
      topPlayerName.textContent = 'Black';
      bottomPlayerName.textContent = 'White';
      topAvatarPiece.innerHTML = PIECES['bk'];
      bottomAvatarPiece.innerHTML = PIECES['wk'];
      this.elements.bottomPlayer.querySelector('.player-info').style.transform = 'rotate(180deg)';
    }

    // Update robot player name if in robot game
    if (this.isRobotGame) {
      const levelNames = ['Beginner', 'Casual', 'Club', 'Strong', 'Master'];
      const robotPlayerName = this.robotColor === 'w' ? topPlayerName : bottomPlayerName;
      robotPlayerName.textContent = `Robot · ${levelNames[this.robotLevel - 1]}`;
    }
  }

  highlightLegalMoves() {
    this.clearHighlights();

    if (!this.selectedSquare || this.legalMoves.length === 0) return;

    const selectedSquareElement = document.getElementById(this.selectedSquare);
    selectedSquareElement.classList.add('selected');

    this.legalMoves.forEach(move => {
      const targetSquare = document.getElementById(move.to);
      if (move.captured) {
        targetSquare.classList.add('legal-capture');
      } else {
        targetSquare.classList.add('legal-move');
      }
    });
  }

  clearHighlights() {
    document.querySelectorAll('.square').forEach(square => {
      square.classList.remove('selected', 'legal-move', 'legal-capture');
    });
  }

  updatePlayerInfo() {
    const captured = this.game.captured();
    const topCaptured = this.elements.topPlayer.querySelector('.captured-pieces');
    const bottomCaptured = this.elements.bottomPlayer.querySelector('.captured-pieces');
    const topMaterial = this.elements.topPlayer.querySelector('.material-advantage');
    const bottomMaterial = this.elements.bottomPlayer.querySelector('.material-advantage');

    topCaptured.innerHTML = '';
    bottomCaptured.innerHTML = '';

    // Update top player's captured pieces (black pieces captured by white)
    captured.w.forEach(piece => {
      const pieceElement = document.createElement('div');
      pieceElement.className = 'captured-piece';
      pieceElement.innerHTML = PIECES['b' + piece];
      topCaptured.appendChild(pieceElement);
    });

    // Update bottom player's captured pieces (white pieces captured by black)
    captured.b.forEach(piece => {
      const pieceElement = document.createElement('div');
      pieceElement.className = 'captured-piece';
      pieceElement.innerHTML = PIECES['w' + piece];
      bottomCaptured.appendChild(pieceElement);
    });

    // Calculate material advantage
    const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    let whiteMaterial = 0;
    let blackMaterial = 0;

    // Count pieces on the board
    this.game.board().forEach(square => {
      if (square) {
        if (square.color === 'w') {
          whiteMaterial += pieceValues[square.type];
        } else {
          blackMaterial += pieceValues[square.type];
        }
      }
    });

    // Add captured pieces
    captured.w.forEach(piece => {
      whiteMaterial += pieceValues[piece];
    });

    captured.b.forEach(piece => {
      blackMaterial += pieceValues[piece];
    });

    const materialDiff = whiteMaterial - blackMaterial;

    if (this.isFlipped) {
      topMaterial.textContent = materialDiff >= 0 ? `+${materialDiff}` : materialDiff;
      bottomMaterial.textContent = materialDiff <= 0 ? `+${-materialDiff}` : -materialDiff;
    } else {
      topMaterial.textContent = materialDiff <= 0 ? `+${-materialDiff}` : -materialDiff;
      bottomMaterial.textContent = materialDiff >= 0 ? `+${materialDiff}` : materialDiff;
    }
  }

  updateMoveList() {
    const history = this.game.history();
    const moveList = this.elements.moveList;

    moveList.innerHTML = '';

    for (let i = 0; i < history.length; i += 2) {
      const moveEntry = document.createElement('div');
      moveEntry.className = 'move-entry';

      const moveNumber = document.createElement('span');
      moveNumber.className = 'move-number';
      moveNumber.textContent = `${Math.floor(i / 2) + 1}.`;

      const whiteMove = document.createElement('span');
      whiteMove.className = 'move-san';
      whiteMove.textContent = history[i].san;

      moveEntry.appendChild(moveNumber);
      moveEntry.appendChild(whiteMove);

      if (i + 1 < history.length) {
        const blackMove = document.createElement('span');
        blackMove.className = 'move-san';
        blackMove.textContent = history[i + 1].san;
        moveEntry.appendChild(blackMove);
      }

      moveList.appendChild(moveEntry);
    }

    // Scroll to bottom
    moveList.scrollTop = moveList.scrollHeight;
  }

  toggleMoveList() {
    this.elements.moveList.classList.toggle('hidden');
    this.elements.toggleMoveList.textContent = this.elements.moveList.classList.contains('hidden') ? 'Moves ▼' : 'Moves ▲';
  }

  updateStatusLine() {
    const status = this.game.status();
    const turn = this.game.turn();

    if (status.over) {
      if (status.result === '1-0') {
        this.elements.statusLine.textContent = 'White wins by checkmate';
      } else if (status.result === '0-1') {
        this.elements.statusLine.textContent = 'Black wins by checkmate';
      } else {
        this.elements.statusLine.textContent = 'Game drawn';
      }
    } else if (status.check) {
      this.elements.statusLine.textContent = `${turn === 'w' ? 'White' : 'Black'} is in check`;
    } else {
      this.elements.statusLine.textContent = `${turn === 'w' ? 'White' : 'Black'} to move`;
    }

    this.elements.undoBtn.disabled = this.game.history().length === 0 ||
      (this.isRobotGame && this.game.turn() === this.robotColor) || this.thinking;
  }

  showGameOver(status) {
    let resultText = '';
    let reasonText = '';

    if (status.result === '1-0') {
      resultText = 'Checkmate — White wins';
      reasonText = '';
    } else if (status.result === '0-1') {
      resultText = 'Checkmate — Black wins';
      reasonText = '';
    } else if (status.result === '1/2-1/2') {
      if (status.reason === 'stalemate') {
        resultText = 'Stalemate';
        reasonText = 'Game drawn by stalemate';
      } else if (status.reason === 'insufficient') {
        resultText = 'Draw by insufficient material';
        reasonText = '';
      } else if (status.reason === 'fifty') {
        resultText = 'Draw by fifty-move rule';
        reasonText = '';
      } else if (status.reason === 'repetition') {
        resultText = 'Draw by threefold repetition';
        reasonText = '';
      }
    }

    this.elements.gameResult.textContent = resultText;
    this.elements.gameReason.textContent = reasonText;
    this.elements.gameOverModal.classList.remove('hidden');
  }

  squareToIndex(square) {
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = 8 - parseInt(square[1]);
    return rank * 8 + file;
  }

  playSound(move) {
    if (!this.isSoundOn) return;

    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    if (move.captured) {
      // Capture sound
      oscillator.type = 'sawtooth';
      oscillator.frequency.value = 440;
      gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
    } else {
      // Move sound
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gainNode.gain.setValueAtTime(0.05, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
    }

    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.2);
  }

  vibrate(move) {
    if (navigator.vibrate) {
      if (move.captured) {
        navigator.vibrate(50);
      } else {
        navigator.vibrate(20);
      }
    }
  }

  toggleSound() {
    this.isSoundOn = !this.isSoundOn;
    this.updateSoundButton();
    this.saveSettings();
  }

  updateSoundButton() {
    const svgPath = this.elements.soundToggle.querySelector('svg path');
    if (this.isSoundOn) {
      svgPath.setAttribute('d', 'M14.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM19 12c0 1.66-1.34 3-3 3v-6c1.66 0 3 1.34 3 3zM3 9v6h4l5 5V4L7 9H3z');
    } else {
      svgPath.setAttribute('d', 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z');
    }
  }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.chessApp = new ChessApp();
});
