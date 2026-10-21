"use strict";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SWIPE TO DELETE (touch screens)
   גרירה ימינה על שורה חושפת "מחיקה". הקשה עליה מפעילה את כפתור המחיקה הקיים
   של השורה, כך שכל אישור או לוגיקת מחיקה נשארים כפי שהם.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var SWIPE_ROWS = [
  {row: "#budget-main .irow", remove: ".custom-category-remove, .income-extra-remove, .salary-remove"},
  {row: ".expense-detail-row", remove: ".expense-detail-remove"},
  {row: ".insurance-edit-row", remove: ".insurance-edit-delete"},
  {row: ".liability-editor-row", remove: ".liability-remove-btn"},
  {row: ".dream-row", remove: ".del-btn"}
];
var SWIPE_OPEN_WIDTH = 92;
var _swipe = null;
var _swipeOpenRow = null;
var _swipeBlockClickUntil = 0;

function swipeTarget(element) {
  for (var i = 0; i < SWIPE_ROWS.length; i++) {
    var row = element.closest(SWIPE_ROWS[i].row);
    if (!row) continue;
    var remove = row.querySelector(SWIPE_ROWS[i].remove);
    if (remove) return {row: row, remove: remove};
  }
  return null;
}

function isEditingText(target) {
  var active = document.activeElement;
  if (!active || !/^(INPUT|TEXTAREA)$/.test(active.tagName) || active.readOnly) return false;
  if (active.tagName === "INPUT" && ["text", "search", ""].indexOf(active.type) < 0) return false;
  var row = active.closest(SWIPE_ROWS.map(function(item) { return item.row; }).join(","));
  return target === active || (row && row.contains(target));
}

function setSwipeOffset(row, offset) {
  row.style.setProperty("--swipe", offset + "px");
  row.classList.toggle("swipe-active", offset > 0);
}

function closeOpenSwipe() {
  if (_swipeOpenRow) setSwipeOffset(_swipeOpenRow, 0);
  _swipeOpenRow = null;
}

document.addEventListener("touchstart", function(event) {
  var touch = event.touches[0];
  /* הקשה על אזור "מחיקה" שנחשף */
  if (_swipeOpenRow) {
    var box = _swipeOpenRow.getBoundingClientRect();
    if (_swipeOpenRow.contains(event.target) && touch.clientX <= box.left + SWIPE_OPEN_WIDTH) {
      var target = swipeTarget(_swipeOpenRow);
      closeOpenSwipe();
      _swipeBlockClickUntil = 0; /* פעולת המחיקה עצמה לא נחסמת */
      if (target) target.remove.click();
      /* אחרי המחיקה: ההקשה עצמה לא תלחץ על מה שמופיע מתחתיה (למשל חלון האישור) */
      _swipeBlockClickUntil = Date.now() + 400;
      return;
    }
    closeOpenSwipe();
  }
  /* בזמן עריכת שם (בחירת טקסט בשדה) הגרירה לא מוחקת */
  if (isEditingText(event.target)) { _swipe = null; return; }
  var found = swipeTarget(event.target);
  _swipe = found ? {row: found.row, x: touch.clientX, y: touch.clientY, horizontal: null, offset: 0} : null;
}, {passive: true});

document.addEventListener("touchmove", function(event) {
  if (!_swipe) return;
  var touch = event.touches[0];
  var dx = touch.clientX - _swipe.x;
  var dy = touch.clientY - _swipe.y;
  if (_swipe.horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) _swipe.horizontal = Math.abs(dx) > Math.abs(dy) && dx > 0;
  if (!_swipe.horizontal) return;
  _swipe.offset = Math.max(0, Math.min(dx, SWIPE_OPEN_WIDTH + 30));
  setSwipeOffset(_swipe.row, _swipe.offset);
}, {passive: true});

document.addEventListener("touchend", function() {
  if (!_swipe) return;
  if (_swipe.horizontal) {
    _swipeBlockClickUntil = Date.now() + 400;
    if (_swipe.offset > SWIPE_OPEN_WIDTH * 0.6) {
      setSwipeOffset(_swipe.row, SWIPE_OPEN_WIDTH);
      _swipeOpenRow = _swipe.row;
    } else {
      setSwipeOffset(_swipe.row, 0);
    }
  }
  _swipe = null;
}, {passive: true});

/* גרירה לא נחשבת הקשה: חוסמים את ה־click שהדפדפן שולח אחריה */
document.addEventListener("click", function(event) {
  if (Date.now() < _swipeBlockClickUntil) {
    event.stopPropagation();
    event.preventDefault();
  }
}, true);
