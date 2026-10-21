"use strict";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   BACKUP & RESTORE
   גיבוי של כל נתוני התקציב וההגדרות לקובץ JSON, ושחזור ממנו.
   תלושי השכר (IndexedDB) אינם נכללים בגיבוי.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var BACKUP_APP_ID = "shlita-finansit";
var BACKUP_VERSION = 1;
var BACKUP_KEYS = [
  STORAGE_KEY, GOALS_KEY, MAASER_ACCOUNT_KEY, MAASER_KEY, DREAMS_KEY, MAASER_PERCENTAGE_KEY,
  ALLOCATION_PERCENTAGES_KEY, LIABILITIES_KEY, PROFILE_SETTINGS_KEY, INVESTMENTS_OVERVIEW_KEY
];

var BACKUP_MIGRATION_FLAGS = ["addedCarTest_v1", "addedPlainFixedItems_v1", "fixedDefaults_v2"];

function buildBackup() {
  var data = {};
  BACKUP_KEYS.forEach(function(key) {
    var value = localStorage.getItem(key);
    if (value !== null) data[key] = value;
  });
  return {app: BACKUP_APP_ID, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data: data};
}

/* גיבוי: חלון עם שתי דרכים - שמירה/שיתוף כקובץ, או העתקה כטקסט (עובד גם כשהורדת קבצים חסומה) */
function exportBackup() {
  closeSideMenu();
  var backup;
  try {
    backup = buildBackup();
  } catch(e) {
    showBackupDialog("גיבוי הנתונים", '<p class="backup-error">לא הצלחנו לקרוא את הנתונים מהמכשיר לצורך גיבוי.</p>');
    return;
  }
  var text = JSON.stringify(backup);
  var fileName = "shlita-finansit-backup-" + calendarDateValue(new Date()) + ".json";
  var box = showBackupDialog("גיבוי הנתונים",
    '<p class="backup-hint">שמרו את הגיבוי כקובץ (למשל בקבצים או בוואטסאפ לעצמכם), או העתיקו את הטקסט והדביקו אותו בפתק.</p>' +
    '<button type="button" class="backup-action" id="backup-save-file"><span class="material-symbols-rounded" aria-hidden="true">ios_share</span><span>שמירה / שיתוף כקובץ</span></button>' +
    '<button type="button" class="backup-action backup-action-light" id="backup-copy-text"><span class="material-symbols-rounded" aria-hidden="true">content_copy</span><span>העתקה כטקסט</span></button>' +
    '<textarea class="backup-text" readonly aria-label="טקסט הגיבוי"></textarea><p class="backup-status" id="backup-status" role="status"></p>');
  var area = box.querySelector(".backup-text");
  area.value = text;
  box.querySelector("#backup-save-file").onclick = function() { saveBackupFile(text, fileName); };
  box.querySelector("#backup-copy-text").onclick = function() { copyBackupText(area); };
}

function saveBackupFile(text, fileName) {
  var blob = new Blob([text], {type: "application/json"});
  var file = typeof File === "function" ? new File([blob], fileName, {type: blob.type}) : null;
  if (file && navigator.share && navigator.canShare && navigator.canShare({files: [file]})) {
    navigator.share({title: "גיבוי שליטה פיננסית", files: [file]}).catch(function(error) {
      if (!error || error.name !== "AbortError") downloadBackupBlob(blob, fileName);
    });
    return;
  }
  downloadBackupBlob(blob, fileName);
  setBackupStatus("אם הקובץ לא נשמר, השתמשו ב״העתקה כטקסט״.");
}

function copyBackupText(area) {
  area.focus();
  area.select();
  area.setSelectionRange(0, area.value.length);
  var done = function() { setBackupStatus("✓ הועתק. הדביקו בפתק או שלחו לעצמכם בוואטסאפ."); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(area.value).then(done, function() {
      try { document.execCommand("copy"); done(); } catch(e) { setBackupStatus("הטקסט מסומן: לחצו עליו לחיצה ארוכה ובחרו ״העתק״."); }
    });
    return;
  }
  try { document.execCommand("copy"); done(); } catch(e) { setBackupStatus("הטקסט מסומן: לחצו עליו לחיצה ארוכה ובחרו ״העתק״."); }
}

function setBackupStatus(message) {
  var status = el("backup-status");
  if (status) status.textContent = message;
}

function showBackupDialog(title, html) {
  closeBackupDialog();
  var overlay = mk("div", "history-overlay");
  overlay.id = "backup-overlay";
  overlay.onclick = function(event) { if (event.target === overlay) closeBackupDialog(); };
  var box = mk("div", "history-box backup-box");
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.innerHTML = '<button type="button" class="history-close material-symbols-rounded" aria-label="סגירה">close</button>' +
    '<h2 class="history-title">' + escapeHtml(title) + '</h2>' + html;
  box.querySelector(".history-close").onclick = closeBackupDialog;
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  return box;
}

function closeBackupDialog() {
  var overlay = el("backup-overlay");
  if (overlay) overlay.remove();
}

function downloadBackupBlob(blob, fileName) {
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
}

/* שחזור: מקובץ, או מהדבקת טקסט הגיבוי */
function chooseBackupFile() {
  closeSideMenu();
  var box = showBackupDialog("שחזור מגיבוי",
    '<p class="backup-hint">השחזור מחליף את כל נתוני התקציב וההגדרות במכשיר הזה בנתונים מהגיבוי.</p>' +
    '<button type="button" class="backup-action" id="backup-pick-file"><span class="material-symbols-rounded" aria-hidden="true">upload_file</span><span>בחירת קובץ גיבוי</span></button>' +
    '<textarea class="backup-text" placeholder="או הדביקו כאן את טקסט הגיבוי" aria-label="טקסט הגיבוי"></textarea>' +
    '<button type="button" class="backup-action backup-action-light" id="backup-restore-text"><span class="material-symbols-rounded" aria-hidden="true">restore</span><span>שחזור מהטקסט</span></button>' +
    '<p class="backup-status" id="backup-status" role="status"></p>');
  box.querySelector("#backup-pick-file").onclick = function() {
    var input = el("backup-file-input");
    if (!input) return;
    input.value = "";
    input.click();
  };
  box.querySelector("#backup-restore-text").onclick = function() {
    restoreBackupText(box.querySelector(".backup-text").value);
  };
}

/* מחזיר את נתוני הגיבוי אם הקובץ תקין, אחרת הודעת שגיאה */
function validateBackup(backup) {
  if (!backup || typeof backup !== "object" || backup.app !== BACKUP_APP_ID) {
    return {error: "הקובץ אינו גיבוי של שליטה פיננסית."};
  }
  if (backup.version !== BACKUP_VERSION) {
    return {error: "גרסת הגיבוי אינה נתמכת."};
  }
  if (!backup.data || typeof backup.data !== "object" || Array.isArray(backup.data)) {
    return {error: "קובץ הגיבוי פגום."};
  }
  var keys = Object.keys(backup.data);
  if (!keys.length) return {error: "קובץ הגיבוי ריק."};
  for (var i = 0; i < keys.length; i++) {
    var value = backup.data[keys[i]];
    if (BACKUP_KEYS.indexOf(keys[i]) < 0 || typeof value !== "string") return {error: "קובץ הגיבוי פגום."};
    try { JSON.parse(value); } catch(e) { return {error: "קובץ הגיבוי פגום."}; }
  }
  var months;
  try { months = JSON.parse(backup.data[STORAGE_KEY] || "{}"); } catch(e) { months = null; }
  if (!months || typeof months !== "object" || Array.isArray(months)) return {error: "קובץ הגיבוי פגום."};
  return {data: backup.data, monthCount: Object.keys(months).length};
}

/* כותב את כל הנתונים מהגיבוי. אם כתיבה נכשלת באמצע, הנתונים הקודמים מוחזרים */
function restoreBackupData(data) {
  var previous = {};
  BACKUP_KEYS.forEach(function(key) { previous[key] = localStorage.getItem(key); });
  try {
    BACKUP_KEYS.forEach(function(key) {
      if (Object.prototype.hasOwnProperty.call(data, key)) localStorage.setItem(key, data[key]);
      else localStorage.removeItem(key);
    });
    /* נתונים משוחזרים כבר משקפים את מה שהמשתמשים בחרו: עדכוני ברירת מחדל חד־פעמיים לא ירוצו עליהם
       (אחרת סעיף שנמחק, כמו "טסט לרכב", היה חוזר) */
    BACKUP_MIGRATION_FLAGS.forEach(function(flag) { localStorage.setItem(flag, "1"); });
    return true;
  } catch(e) {
    BACKUP_KEYS.forEach(function(key) {
      try {
        if (previous[key] === null) localStorage.removeItem(key);
        else localStorage.setItem(key, previous[key]);
      } catch(restoreError) {}
    });
    return false;
  }
}

function importBackupFile(file) {
  if (!file) return;
  if (!el("backup-overlay")) chooseBackupFile();
  if (file.size > 5 * 1024 * 1024) {
    setBackupStatus("הקובץ גדול מדי לגיבוי של שליטה פיננסית.");
    return;
  }
  var reader = new FileReader();
  reader.onload = function() { restoreBackupText(reader.result); };
  reader.onerror = function() { setBackupStatus("לא הצלחנו לקרוא את הקובץ."); };
  reader.readAsText(file);
}

/* בודק את הגיבוי, מבקש אישור בחלון של האפליקציה (חלונות מערכת נחסמים בתוך Claude) ומשחזר */
function restoreBackupText(text) {
  var backup;
  try { backup = JSON.parse(String(text || "").trim()); } catch(e) { backup = null; }
  var checked = validateBackup(backup);
  if (checked.error) {
    setBackupStatus(checked.error);
    return;
  }
  var exportedAt = new Date(backup.exportedAt);
  var dateText = isNaN(exportedAt.getTime()) ? "" : " מתאריך " + exportedAt.toLocaleDateString("he-IL");
  var box = el("backup-overlay").querySelector(".backup-box");
  box.querySelectorAll(".backup-confirm").forEach(function(item) { item.remove(); });
  var confirmBox = mk("div", "backup-confirm");
  confirmBox.innerHTML = '<p>להחליף את הנתונים בגיבוי' + escapeHtml(dateText) + ' (' + checked.monthCount + ' חודשים)?</p>' +
    '<div class="backup-confirm-actions"><button type="button" class="backup-action" id="backup-confirm-yes">כן, לשחזר</button>' +
    '<button type="button" class="backup-action backup-action-light" id="backup-confirm-no">ביטול</button></div>';
  box.appendChild(confirmBox);
  confirmBox.querySelector("#backup-confirm-no").onclick = function() { confirmBox.remove(); };
  confirmBox.querySelector("#backup-confirm-yes").onclick = function() {
    if (!restoreBackupData(checked.data)) {
      setBackupStatus("השחזור נכשל, והנתונים הקודמים נשארו כפי שהיו. ייתכן שהאחסון בדפדפן מלא.");
      return;
    }
    window.location.reload();
  };
  confirmBox.scrollIntoView({block: "nearest"});
}
