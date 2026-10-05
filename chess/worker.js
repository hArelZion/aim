importScripts('chess-engine.js');

self.onmessage = function(e) {
  const { id, moves, level } = e.data;

  // Create a fresh game and replay the moves
  const game = ChessEngine.createGame();
  moves.forEach(move => {
    game.move({
      from: move.slice(0, 2),
      to: move.slice(2, 4),
      promotion: move[4]
    });
  });

  // Get the best move
  const bestMove = ChessEngine.bestMove(game, level);

  // Send the result back to the main thread
  self.postMessage({
    id: id,
    move: bestMove
  });
};
