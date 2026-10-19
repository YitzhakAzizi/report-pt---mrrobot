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

function buildBackup() {
  var data = {};
  BACKUP_KEYS.forEach(function(key) {
    var value = localStorage.getItem(key);
    if (value !== null) data[key] = value;
  });
  return {app: BACKUP_APP_ID, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data: data};
}

function exportBackup() {
  closeSideMenu();
  var backup;
  try {
    backup = buildBackup();
  } catch(e) {
    alert("לא הצלחנו לקרוא את הנתונים מהמכשיר לצורך גיבוי.");
    return;
  }
  var fileName = "shlita-finansit-backup-" + calendarDateValue(new Date()) + ".json";
  var blob = new Blob([JSON.stringify(backup, null, 2)], {type: "application/json"});
  var file = typeof File === "function" ? new File([blob], fileName, {type: blob.type}) : null;

  if (file && navigator.share && navigator.canShare && navigator.canShare({files: [file]})) {
    navigator.share({title: "גיבוי שליטה פיננסית", files: [file]}).catch(function() {});
    return;
  }

  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
}

function chooseBackupFile() {
  closeSideMenu();
  var input = el("backup-file-input");
  if (!input) return;
  input.value = "";
  input.click();
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
  if (file.size > 5 * 1024 * 1024) {
    alert("הקובץ גדול מדי לגיבוי של שליטה פיננסית.");
    return;
  }
  var reader = new FileReader();
  reader.onload = function() {
    var backup;
    try { backup = JSON.parse(reader.result); } catch(e) { backup = null; }
    var checked = validateBackup(backup);
    if (checked.error) {
      alert(checked.error);
      return;
    }
    var exportedAt = new Date(backup.exportedAt);
    var dateText = isNaN(exportedAt.getTime()) ? "" : " מתאריך " + exportedAt.toLocaleDateString("he-IL");
    var message = "השחזור יחליף את כל נתוני התקציב וההגדרות במכשיר הזה בנתונים מהגיבוי" + dateText +
      " (" + checked.monthCount + " חודשים). תלושי שכר שמורים לא ישתנו.\n\nלהמשיך?";
    if (!window.confirm(message)) return;
    if (!restoreBackupData(checked.data)) {
      alert("השחזור נכשל, והנתונים הקודמים נשארו כפי שהיו. ייתכן שהאחסון בדפדפן מלא.");
      return;
    }
    window.location.reload();
  };
  reader.onerror = function() { alert("לא הצלחנו לקרוא את הקובץ."); };
  reader.readAsText(file);
}
