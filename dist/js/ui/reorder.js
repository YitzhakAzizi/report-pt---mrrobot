"use strict";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   REORDER ROWS
   גרירת הידית (≡) בשורה מעלה או מטה משנה את סדר ההוצאות.
   הסדר נשמר על הפריט עצמו (order), ולכן עובר גם לחודש הבא.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/* מיון לפי הסדר שנבחר; פריט בלי סדר נשאר במקומו המקורי, אחרי הפריטים שסודרו */
function sortByUserOrder(entries, itemOf) {
  return entries.map(function(entry, index) {
    var order = itemOf(entry).order;
    return {entry: entry, key: typeof order === "number" ? order : 100000 + index};
  }).sort(function(a, b) { return a.key - b.key; }).map(function(wrapped) { return wrapped.entry; });
}

function dragHandle(label) {
  var handle = mkText("span", "drag-handle material-symbols-rounded", "drag_indicator");
  handle.setAttribute("role", "button");
  handle.setAttribute("aria-label", "גרירה לשינוי הסדר של " + label);
  return handle;
}

/* כל שורה ברשימה מחזיקה את הפריט שלה ב־row._item. בסיום הגרירה הסדר החדש נשמר */
function enableRowReorder(list) {
  if (list._reorderReady) return;
  list._reorderReady = true;
  list.addEventListener("pointerdown", function(event) {
    var handle = event.target.closest(".drag-handle");
    if (!handle || !list.contains(handle)) return;
    var row = handle.closest(".flat-expense-row");
    if (!row) return;
    event.preventDefault();
    /* מאזינים על כל הדף: השורה זזה במסמך תוך כדי גרירה, ואז "לכידת" האצבע על הידית הייתה הולכת לאיבוד */
    var pointerId = event.pointerId;
    row.classList.add("is-dragging");
    var moved = false;

    var onMove = function(moveEvent) {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      var y = moveEvent.clientY;
      for (var guard = 0; guard < 50; guard++) {
        var previous = row.previousElementSibling;
        var next = row.nextElementSibling;
        if (previous && previous.classList.contains("flat-expense-row") && y < previous.getBoundingClientRect().top + previous.getBoundingClientRect().height / 2) {
          list.insertBefore(row, previous);
        } else if (next && next.classList.contains("flat-expense-row") && y > next.getBoundingClientRect().top + next.getBoundingClientRect().height / 2) {
          list.insertBefore(next, row);
        } else {
          break;
        }
        moved = true;
      }
    };
    var onEnd = function(endEvent) {
      if (endEvent.pointerId !== pointerId) return;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onEnd);
      document.removeEventListener("pointercancel", onEnd);
      row.classList.remove("is-dragging");
      if (!moved) return;
      Array.prototype.forEach.call(list.querySelectorAll(".flat-expense-row"), function(item, index) {
        if (item._item) item._item.order = index;
      });
      saveData();
      flashSaved();
    };
    document.addEventListener("pointermove", onMove, {passive: false});
    document.addEventListener("pointerup", onEnd);
    document.addEventListener("pointercancel", onEnd);
  });
}
