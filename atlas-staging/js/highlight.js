/* Line-based syntax colouring for the Code Theater (HTML + CSS inside <style> + JS inside <script>).
   Small and fast: each finished line is coloured once, with the mode (html/css/js/comment) carried to the next line. */
(function () {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const KW = /^(const|let|var|function|return|if|else|for|while|of|in|new|class|extends|import|from|export|default|async|await|try|catch|finally|throw|switch|case|break|continue|this|true|false|null|undefined|typeof|instanceof|document|window)$/;
  const sp = (c, s) => `<span class="hl-${c}">${esc(s)}</span>`;

  function js(line, st) {
    let out = "", i = 0;
    while (i < line.length) {
      if (st.jsCom) {
        const e = line.indexOf("*/", i);
        if (e < 0) { out += sp("com", line.slice(i)); return out; }
        out += sp("com", line.slice(i, e + 2)); i = e + 2; st.jsCom = false; continue;
      }
      const rest = line.slice(i);
      let m;
      if (rest.startsWith("</script")) { st.mode = "html"; return out + html(rest, st); }
      if (rest.startsWith("//")) { out += sp("com", rest); return out; }
      if (rest.startsWith("/*")) { st.jsCom = true; continue; }
      if ((m = rest.match(/^(["'`])(?:\\.|(?!\1).)*\1?/))) { out += sp("str", m[0]); i += m[0].length; continue; }
      if ((m = rest.match(/^\d+(\.\d+)?/))) { out += sp("num", m[0]); i += m[0].length; continue; }
      if ((m = rest.match(/^[A-Za-z_$][\w$]*/))) { out += KW.test(m[0]) ? sp("kw", m[0]) : (rest[m[0].length] === "(" ? sp("attr", m[0]) : esc(m[0])); i += m[0].length; continue; }
      out += esc(line[i]); i++;
    }
    return out;
  }
  function css(line, st) {
    let out = "", i = 0;
    while (i < line.length) {
      if (st.cssCom) {
        const e = line.indexOf("*/", i);
        if (e < 0) { out += sp("com", line.slice(i)); return out; }
        out += sp("com", line.slice(i, e + 2)); i = e + 2; st.cssCom = false; continue;
      }
      const rest = line.slice(i);
      let m;
      if (rest.startsWith("</style")) { st.mode = "html"; return out + html(rest, st); }
      if (rest.startsWith("/*")) { st.cssCom = true; continue; }
      if (st.depth > 0 && (m = rest.match(/^([\w-]+)(\s*:)/)) && !/^[\d.]/.test(m[1])) { out += sp("prop", m[1]) + esc(m[2]); i += m[0].length; continue; }
      if ((m = rest.match(/^(["'])(?:\\.|(?!\1).)*\1?/))) { out += sp("str", m[0]); i += m[0].length; continue; }
      if ((m = rest.match(/^#[0-9a-fA-F]{3,8}\b|^-?\d+(\.\d+)?(px|rem|em|vh|vw|%|s|ms|deg|fr|ch)?/))) { out += sp("num", m[0]); i += m[0].length; continue; }
      if (rest[0] === "{") { st.depth++; out += sp("punc", "{"); i++; continue; }
      if (rest[0] === "}") { st.depth = Math.max(0, st.depth - 1); out += sp("punc", "}"); i++; continue; }
      if (st.depth === 0 && (m = rest.match(/^[^{};]+/))) { out += sp("sel", m[0]); i += m[0].length; continue; }
      out += esc(line[i]); i++;
    }
    return out;
  }
  function html(line, st) {
    let out = "", i = 0;
    while (i < line.length) {
      if (st.mode === "css") return out + css(line.slice(i), st);
      if (st.mode === "js") return out + js(line.slice(i), st);
      if (st.htmlCom) {
        const e = line.indexOf("-->", i);
        if (e < 0) { out += sp("com", line.slice(i)); return out; }
        out += sp("com", line.slice(i, e + 3)); i = e + 3; st.htmlCom = false; continue;
      }
      const rest = line.slice(i);
      let m;
      if (rest.startsWith("<!--")) { st.htmlCom = true; continue; }
      if ((m = rest.match(/^<\/?[A-Za-z!][\w-]*/))) {
        const name = m[0].replace(/[<\/!]/g, "").toLowerCase();
        out += sp("tag", m[0]); i += m[0].length;
        // attributes up to the end of the tag (or the line)
        let am;
        while (i < line.length && line[i] !== ">") {
          const r2 = line.slice(i);
          if ((am = r2.match(/^\s+/))) { out += am[0]; i += am[0].length; continue; }
          if ((am = r2.match(/^[\w:-]+/))) { out += sp("attr", am[0]); i += am[0].length; continue; }
          if ((am = r2.match(/^=\s*("[^"]*"?|'[^']*'?|[^\s>]+)/))) { out += esc("=") + sp("str", am[0].slice(1).trimStart()); i += am[0].length; continue; }
          out += esc(line[i]); i++;
        }
        if (line[i] === ">") {
          out += sp("tag", ">"); i++;
          if (!m[0].startsWith("</") && name === "style") st.mode = "css";
          if (!m[0].startsWith("</") && name === "script") st.mode = "js";
        }
        continue;
      }
      const next = rest.search(/<|$/);
      out += esc(rest.slice(0, next || 1)); i += next || 1;
    }
    return out;
  }
  window.Highlight = {
    state: () => ({ mode: "html", depth: 0, cssCom: false, jsCom: false, htmlCom: false }),
    /** colours one line; `st` is updated for the next line. `peek` = true leaves st untouched (the line still growing). */
    line(text, st, peek) {
      const s = peek ? { ...st } : st;
      return s.mode === "css" ? css(text, s) : s.mode === "js" ? js(text, s) : html(text, s);
    },
  };
})();
