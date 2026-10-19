"use strict";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   UTILITIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function el(id) { return document.getElementById(id); }

function money(n) {
  var r = Math.round(n);
  var neg = r < 0;
  var s = Math.abs(r).toString();
  var res = "", c = 0;
  for (var i = s.length - 1; i >= 0; i--) {
    if (c > 0 && c % 3 === 0) res = "," + res;
    res = s[i] + res;
    c++;
  }
  return (neg ? "-" : "") + "₪" + res;
}

function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

function mk(tag, cls) {
  var d = document.createElement(tag);
  if (cls) d.className = cls;
  return d;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, function(ch) {
    return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch];
  });
}

function mkText(tag, cls, text) {
  var d = mk(tag, cls);
  d.textContent = text;
  return d;
}

