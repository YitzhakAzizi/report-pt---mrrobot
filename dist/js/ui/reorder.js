"use strict";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   REORDER ROWS (like the iPhone)
   מחזיקים את הידית (☰) מימין לשורה, "מרימים" את הסעיף ומזיזים אותו;
   השורות האחרות זזות הצידה ומפנות לו מקום. הסדר נשמר על הפריט (order)
   ולכן עובר גם לחודש הבא.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/* מיון לפי הסדר שנבחר; פריט בלי סדר נשאר במקומו המקורי, אחרי הפריטים שסודרו */
function sortByUserOrder(entries, itemOf) {
  return entries.map(function(entry, index) {
    var order = itemOf(entry).order;
    return {entry: entry, key: typeof order === "number" ? order : 100000 + index};
  }).sort(function(a, b) { return a.key - b.key; }).map(function(wrapped) { return wrapped.entry; });
}

function dragHandle(label) {
  var handle = mkText("span", "drag-handle material-symbols-rounded", "menu");
  handle.setAttribute("role", "button");
  handle.setAttribute("aria-label", "גרירה לשינוי הסדר של " + label);
  handle.title = "החזיקו וגררו לשינוי הסדר";
  return handle;
}

/* כל שורה ברשימה מחזיקה את הפריט שלה ב־row._item */
/* rowSelector: אילו שורות נגררות (ברירת מחדל שורות ההוצאות); onDone: מה לעשות אחרי שינוי סדר */
function enableRowReorder(list, rowSelector, onDone) {
  if (list._reorderReady) return;
  list._reorderReady = true;
  rowSelector = rowSelector || ".flat-expense-row";
  list.addEventListener("pointerdown", function(event) {
    var handle = event.target.closest(".drag-handle");
    if (!handle || !list.contains(handle)) return;
    var row = handle.closest(rowSelector);
    if (!row) return;
    event.preventDefault();
    startRowDrag(list, row, event, rowSelector, onDone);
  });
  /* באייפון: נגיעה בידית לא מגלגלת את הדף או את החלון שמאחור */
  list.addEventListener("touchstart", function(event) {
    if (event.target.closest(".drag-handle")) event.preventDefault();
  }, {passive: false});
}

function startRowDrag(list, row, event, rowSelector, onDone) {
  var rows = Array.prototype.slice.call(list.querySelectorAll(rowSelector));
  var from = rows.indexOf(row);
  /* מיקומים במסמך (לא במסך), כדי שגלילה תוך כדי גרירה לא תשבש את החישוב */
  var tops = rows.map(function(item) { return item.getBoundingClientRect().top + window.scrollY; });
  var heights = rows.map(function(item) { return item.getBoundingClientRect().height; });
  var startY = event.clientY + window.scrollY;
  var lastClientY = event.clientY;
  var to = from;
  var pointerId = event.pointerId;
  var scrollTimer = null;

  rows.forEach(function(item) { item.classList.add("reorder-active"); });
  /* כל עוד גוררים, שום דבר אחר לא נגלל */
  var blockScroll = function(touchEvent) { touchEvent.preventDefault(); };
  document.addEventListener("touchmove", blockScroll, {passive: false});
  row.classList.add("is-dragging");

  var layout = function() {
    var dy = lastClientY + window.scrollY - startY;
    row.style.transform = "translateY(" + dy + "px) scale(1.03)";
    var center = tops[from] + heights[from] / 2 + dy;
    /* המקום החדש = כמה שורות אחרות נמצאות מעל מרכז השורה המורמת */
    to = 0;
    for (var i = 0; i < rows.length; i++) {
      if (i !== from && tops[i] + heights[i] / 2 < center) to++;
    }
    rows.forEach(function(item, j) {
      if (j === from) return;
      var shift = 0;
      if (from < to && j > from && j <= to) shift = -heights[from];
      if (from > to && j < from && j >= to) shift = heights[from];
      item.style.transform = shift ? "translateY(" + shift + "px)" : "";
    });
  };

  /* גלילה אוטומטית כשמגיעים לקצה המסך */
  var autoScroll = function() {
    var edge = 90;
    var speed = lastClientY < edge ? -8 : lastClientY > window.innerHeight - edge ? 8 : 0;
    /* בתוך חלון גוללים את החלון, לא את הדף */
    var scroller = list.closest(".modal-body");
    if (speed && !scroller) { window.scrollBy(0, speed); layout(); }
    scrollTimer = requestAnimationFrame(autoScroll);
  };
  scrollTimer = requestAnimationFrame(autoScroll);

  var onMove = function(moveEvent) {
    if (moveEvent.pointerId !== pointerId) return;
    moveEvent.preventDefault();
    lastClientY = moveEvent.clientY;
    layout();
  };
  var onEnd = function(endEvent) {
    if (endEvent.pointerId !== pointerId) return;
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onEnd);
    document.removeEventListener("pointercancel", onEnd);
    cancelAnimationFrame(scrollTimer);
    document.removeEventListener("touchmove", blockScroll, {passive: false});
    /* "נחיתה" במקום החדש, ואז הסדר נקבע במסמך */
    var target = 0;
    if (to > from) for (var a = from + 1; a <= to; a++) target += heights[a];
    if (to < from) for (var b = to; b < from; b++) target -= heights[b];
    row.classList.add("is-dropping");
    row.style.transform = "translateY(" + target + "px)";
    setTimeout(function() {
      rows.forEach(function(item) {
        item.style.transform = "";
        item.classList.remove("reorder-active", "is-dragging", "is-dropping");
      });
      if (to === from) return;
      var reference = to > from ? rows[to].nextSibling : rows[to];
      list.insertBefore(row, reference);
      if (onDone) { onDone(); return; }
      Array.prototype.forEach.call(list.querySelectorAll(rowSelector), function(item, index) {
        if (item._item) item._item.order = index;
      });
      saveData();
      flashSaved();
    }, 180);
  };
  document.addEventListener("pointermove", onMove, {passive: false});
  document.addEventListener("pointerup", onEnd);
  document.addEventListener("pointercancel", onEnd);
}
