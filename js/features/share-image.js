"use strict";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SHARE AS IMAGE
   מצייר תמונת סיכום של החודש (PNG) במכשיר עצמו ופותח את תפריט השיתוף של האייפון
   (וואטסאפ, הודעות, שמירה לתמונות). אם השיתוף חסום, התמונה מוצגת במסך
   ולחיצה ארוכה עליה מאפשרת לשמור או לשתף.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function monthSummaryRows() {
  var r = AppState.result;
  var fixed = (r.fixedExpenses || 0) + (r.subscriptionExpenses || 0) + (r.healthBeautyExpenses || 0) +
    (r.childrenExpenses || 0) + (r.insurance || 0) + (r.liabilityPayments || 0);
  var rows = [
    {label: "הכנסות", value: r.total || 0, color: "#16a34a"},
    {label: "הוצאות קבועות", value: fixed, color: "#dc2626"},
    {label: "הוצאות משתנות", value: r.variableExpenses || 0, color: "#dc2626"}
  ];
  if (r.oneTimeExpenses > 0) rows.push({label: "הוצאות מיוחדות", value: r.oneTimeExpenses, color: "#dc2626"});
  if (r.maaser > 0) rows.push({label: "תרומות", value: r.maaser, color: "#d97706"});
  return rows;
}

function drawMonthImage() {
  var scale = 2, width = 720;
  var balance = Math.max(0, AppState.result.balance || 0);
  var amounts = allocationAmounts(balance);
  var rows = monthSummaryRows();
  var split = [
    {label: "השקעות", value: amounts.invest},
    {label: "קרן החלומות", value: amounts.qualityOfLife},
    {label: "בזבוזים", value: amounts.spending}
  ];
  var height = 300 + (rows.length + split.length) * 58; /* בדיוק לפי התוכן, עם שוליים קטנים למטה */
  var canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  var ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.direction = "rtl";
  var font = function(weight, size) { ctx.font = weight + " " + size + "px -apple-system, 'Heebo', 'Segoe UI', sans-serif"; };
  var roundRect = function(x, y, w, h, radius, fill) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };

  ctx.fillStyle = "#f3f6f4";
  ctx.fillRect(0, 0, width, height);
  roundRect(24, 24, width - 48, 120, 22, "#163a5f");
  ctx.fillStyle = "#fff";
  ctx.textAlign = "right";
  font("800", 34);
  ctx.fillText("תקציב " + MONTHS[AppState.period.month] + " " + AppState.period.year, width - 52, 84);
  font("600", 18);
  ctx.fillStyle = "rgba(255,255,255,.8)";
  ctx.fillText("שליטה פיננסית", width - 52, 118);

  var y = 172;
  var line = function(label, value, color) {
    roundRect(24, y, width - 48, 48, 14, "#fff");
    ctx.textAlign = "right";
    ctx.fillStyle = "#0f172a";
    font("600", 20);
    ctx.fillText(label, width - 46, y + 31);
    ctx.textAlign = "left";
    ctx.fillStyle = color || "#163a5f";
    font("800", 22);
    ctx.fillText(money(value), 46, y + 32);
    y += 58;
  };
  rows.forEach(function(row) { line(row.label, row.value, row.color); });

  y += 10;
  roundRect(24, y, width - 48, 64, 16, "#eaf2fb");
  ctx.textAlign = "right";
  ctx.fillStyle = "#163a5f";
  font("700", 21);
  ctx.fillText("סה״כ יתרה", width - 46, y + 40);
  ctx.textAlign = "left";
  font("800", 26);
  ctx.fillText(money(AppState.result.balance || 0), 46, y + 42);
  y += 86;

  ctx.textAlign = "right";
  ctx.fillStyle = "#64748b";
  font("700", 18);
  ctx.fillText("חלוקת היתרה", width - 46, y);
  y += 16;
  split.forEach(function(row) { line(row.label, row.value, "#163a5f"); });
  return canvas;
}

function shareMonthImage() {
  var canvas = drawMonthImage();
  var fileName = "תקציב-" + MONTHS[AppState.period.month] + "-" + AppState.period.year + ".png";
  canvas.toBlob(function(blob) {
    if (!blob) return;
    var file = null;
    try { file = new File([blob], fileName, {type: "image/png"}); } catch (e) {}
    if (file && navigator.canShare && navigator.canShare({files: [file]})) {
      navigator.share({files: [file], title: fileName}).catch(function(error) {
        /* ביטול מצד המשתמש אינו שגיאה; כל דבר אחר מציג את התמונה לשמירה ידנית */
        if (!error || error.name !== "AbortError") showShareImage(canvas);
      });
      return;
    }
    showShareImage(canvas);
  }, "image/png");
}

/* כשאין תפריט שיתוף: התמונה מוצגת, ולחיצה ארוכה עליה שומרת או משתפת */
function showShareImage(canvas) {
  closeShareImage();
  var overlay = mk("div", "history-overlay share-overlay");
  overlay.id = "share-overlay";
  overlay.onclick = function(event) { if (event.target === overlay) closeShareImage(); };
  var box = mk("div", "history-box share-box");
  var close = mkText("button", "history-close material-symbols-rounded", "close");
  close.type = "button";
  close.setAttribute("aria-label", "סגירה");
  close.onclick = closeShareImage;
  var image = document.createElement("img");
  image.className = "share-image";
  image.alt = "סיכום החודש";
  image.src = canvas.toDataURL("image/png");
  box.appendChild(close);
  box.appendChild(mkText("p", "share-hint", "לחצו לחיצה ארוכה על התמונה ובחרו ״שיתוף״ או ״שמירה בתמונות״"));
  box.appendChild(image);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function closeShareImage() {
  var overlay = el("share-overlay");
  if (overlay) overlay.remove();
}
