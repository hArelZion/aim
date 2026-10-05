var PIECES = (function() {
  var d = {
    bSh: '<path d="M9 39c0-1.1 1.8-2 13.5-2s13.5.9 13.5 2-1.8 2-13.5 2S9 40.1 9 39z" fill="#000" opacity=".28" filter="blur(.8px)"/>',
    bPl: '<path d="M12 36.5h21v2.5H12z" rx="1.2"/>',
    bMid: '<path d="M13.5 33.5h18l-1 3h-16z"/>',
    cCol: '<path d="M16 33.5l1.5-12h15l1.5 12z"/>',
    kCr: '<path d="M21 5.5h3v7h-3zm-2.5 2h8v2.5h-8z"/>'
  };

  function grad(id, c) {
    if (c === 'w') {
      return '<defs>' +
        '<linearGradient id="' + id + '-b" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#ffffff"/>' +
          '<stop offset="60%" stop-color="#f0ebe0"/>' +
          '<stop offset="100%" stop-color="#d4c8b2"/>' +
        '</linearGradient>' +
        '<linearGradient id="' + id + '-h" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0%" stop-color="#ffffff" stop-opacity=".85"/>' +
          '<stop offset="45%" stop-color="#ffffff" stop-opacity=".1"/>' +
          '<stop offset="100%" stop-color="#ab9e88" stop-opacity=".45"/>' +
        '</linearGradient>' +
        '<linearGradient id="' + id + '-d" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#91826d"/>' +
          '<stop offset="100%" stop-color="#4d4233"/>' +
        '</linearGradient>' +
      '</defs>';
    }
    return '<defs>' +
      '<linearGradient id="' + id + '-b" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#404552"/>' +
        '<stop offset="55%" stop-color="#262930"/>' +
        '<stop offset="100%" stop-color="#141619"/>' +
      '</linearGradient>' +
      '<linearGradient id="' + id + '-h" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0%" stop-color="#737d8d" stop-opacity=".75"/>' +
        '<stop offset="50%" stop-color="#ffffff" stop-opacity="0"/>' +
        '<stop offset="100%" stop-color="#000000" stop-opacity=".8"/>' +
      '</linearGradient>' +
      '<linearGradient id="' + id + '-d" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#1e2024"/>' +
        '<stop offset="100%" stop-color="#050607"/>' +
      '</linearGradient>' +
    '</defs>';
  }

  function svg(id, c, inner) {
    var strk = c === 'w' ? '#5a4f3f' : '#0c0d0e';
    var rim = c === 'w' ? '#ffffff' : '#8893a4';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">' +
      grad(id, c) +
      d.bSh +
      '<g fill="url(#' + id + '-b)" stroke="' + strk + '" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round">' +
        inner +
      '</g>' +
      '<g fill="url(#' + id + '-h)" pointer-events="none">' +
        inner +
      '</g>' +
      '<g fill="none" stroke="' + rim + '" stroke-width="0.75" opacity=".55" pointer-events="none">' +
        inner +
      '</g>' +
    '</svg>';
  }

  function pawn(c) {
    var id = c + 'p';
    var b = d.bPl + d.bMid +
      '<path d="M15 33.5c1-6 3.5-8.5 4-13h7c.5 4.5 3 7 4 13z"/>' +
      '<path d="M17 19.5h11v2H17z" rx="1"/>' +
      '<circle cx="22.5" cy="13.5" r="5.5"/>';
    return svg(id, c, b);
  }

  function rook(c) {
    var id = c + 'r';
    var b = d.bPl + d.bMid +
      '<path d="M15.5 33.5l1.5-14h16l1.5 14z"/>' +
      '<path d="M14 16.5h17v3H14z" rx="1"/>' +
      '<path d="M14.5 10.5h3.5v4.5h3.5v-4.5h2v4.5h3.5v-4.5h3.5v7h-16z"/>';
    return svg(id, c, b);
  }

  function knight(c) {
    var id = c + 'n';
    var b = d.bPl + d.bMid +
      '<path d="M14.5 33.5c-.2-4.5 1-9 3.5-12.5.5-.7-.2-2-.9-1.6-1.5.9-2.8 2.2-3.6 4.1-1.2-2.1-.2-5.5 1.5-8 1.8-2.6 4.5-4.5 7.5-5 3.8-.7 6 .8 7.5 3.2 2 3.1 3 6.8 1.5 10.8l-1.5 1.2c-1.8.8-3.6-.8-3.5-2.2 0-1.8 1.5-3 1.5-3s-2.5-.2-4.2 1.5c-2.3 2.3-3.8 6.5-4.3 11.5z"/>' +
      '<circle cx="20.5" cy="15" r="1.2" fill="url(#' + id + '-d)"/>';
    return svg(id, c, b);
  }

  function bishop(c) {
    var id = c + 'b';
    var b = d.bPl + d.bMid +
      '<path d="M15 33.5c.8-5 2.5-8 4-11.5h7c1.5 3.5 3.2 6.5 4 11.5z"/>' +
      '<circle cx="22.5" cy="8" r="1.8"/>' +
      '<path d="M16 21c-1.5-4 .5-10 6.5-11.5 6 1.5 8 7.5 6.5 11.5-1.5 4-4.5 5.5-6.5 5.5s-5-1.5-6.5-5.5z"/>' +
      '<path d="M21 14l5 4.5m-3-6.5l-3.5 5" fill="none" stroke="url(#' + id + '-d)" stroke-width="1.2"/>';
    return svg(id, c, b);
  }

  function queen(c) {
    var id = c + 'q';
    var b = d.bPl + d.bMid +
      '<path d="M14.5 33.5l2-13.5h12l2 13.5z"/>' +
      '<path d="M15 19h15v2.5H15z" rx="1"/>' +
      '<path d="M13.5 13l3.5 7h11l3.5-7-5.5 4-3.5-6.5-3.5 6.5z"/>' +
      '<circle cx="13" cy="11.5" r="1.5"/>' +
      '<circle cx="17.8" cy="13.5" r="1.2"/>' +
      '<circle cx="22.5" cy="9.5" r="1.5"/>' +
      '<circle cx="27.2" cy="13.5" r="1.2"/>' +
      '<circle cx="32" cy="11.5" r="1.5"/>';
    return svg(id, c, b);
  }

  function king(c) {
    var id = c + 'k';
    var b = d.bPl + d.bMid +
      '<path d="M14.5 33.5l2-13.5h12l2 13.5z"/>' +
      '<path d="M14.5 19h16v2.5h-16z" rx="1"/>' +
      '<path d="M15 19c-1-4 1.5-6.5 4.5-6.5h6c3 0 5.5 2.5 4.5 6.5z"/>' +
      d.kCr;
    return svg(id, c, b);
  }

  return {
    wp: pawn('w'),
    wn: knight('w'),
    wb: bishop('w'),
    wr: rook('w'),
    wq: queen('w'),
    wk: king('w'),
    bp: pawn('b'),
    bn: knight('b'),
    bb: bishop('b'),
    br: rook('b'),
    bq: queen('b'),
    bk: king('b')
  };
})();
