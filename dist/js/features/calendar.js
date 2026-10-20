"use strict";

function getNextMonthRange() {
  var now = new Date();
  var first = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  var last = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  return {first: first, last: last};
}

function renderNextMeetingLabel() {
  var range = getNextMonthRange();
  var monthName = MONTHS[range.first.getMonth()];
  var label = el("next-meeting-label");
  var button = el("calendar-topbar-button");
  if (label) label.textContent = "קבע פגישה ל" + monthName;
  if (button) {
    button.setAttribute("aria-label", "קביעת פגישה לחודש " + monthName);
    button.title = "קביעת פגישה לחודש " + monthName;
  }
}

function calendarDateValue(date) {
  var year = date.getFullYear();
  var month = String(date.getMonth() + 1).padStart(2, "0");
  var day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function icsDateValue(date) {
  return calendarDateValue(date).replace(/-/g, "");
}

function openCalendarModal() {
  var range = getNextMonthRange();
  var input = el("calendar-date-input");
  var custom = el("calendar-custom-date");
  if (input) {
    input.min = calendarDateValue(range.first);
    input.max = calendarDateValue(range.last);
    input.value = calendarDateValue(range.first);
  }
  if (custom) custom.hidden = true;
  var overlay = el("calendar-overlay");
  if (overlay) overlay.className = "overlay open";
}

function closeCalendarModal() {
  var overlay = el("calendar-overlay");
  if (overlay) overlay.className = "overlay";
}

function showCustomCalendarDate() {
  var custom = el("calendar-custom-date");
  var input = el("calendar-date-input");
  if (custom) custom.hidden = false;
  if (input) input.focus();
}

function scheduleNextMeeting(day) {
  var range = getNextMonthRange();
  addMonthlyMeetingToCalendar(new Date(range.first.getFullYear(), range.first.getMonth(), day));
}

function scheduleCustomMeeting() {
  var input = el("calendar-date-input");
  if (!input || !input.value) return;
  var parts = input.value.split("-");
  addMonthlyMeetingToCalendar(new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
}

var MEETING_TITLE = "פגישת התקציב החודשית";
var MEETING_DETAILS = "זמן לעדכן הכנסות, לבדוק הוצאות ולבנות תוכנית ברורה לחודש הקרוב.";

function isAppleMobile() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function icsText(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/* אירוע של יום שלם, עם תזכורת בשעה 9:00 בבוקר של יום הפגישה */
function meetingIcs(date) {
  var endDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  var stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Financial Control//Monthly Budget Meeting//HE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:monthly-budget-" + icsDateValue(date) + "@financial-control.local",
    "DTSTAMP:" + stamp,
    "DTSTART;VALUE=DATE:" + icsDateValue(date),
    "DTEND;VALUE=DATE:" + icsDateValue(endDate),
    "SUMMARY:" + icsText(MEETING_TITLE),
    "DESCRIPTION:" + icsText(MEETING_DETAILS),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:" + icsText(MEETING_TITLE),
    "TRIGGER;RELATED=START:PT9H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}

function googleCalendarUrl(date) {
  var endDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    "&text=" + encodeURIComponent(MEETING_TITLE) +
    "&dates=" + icsDateValue(date) + "/" + icsDateValue(endDate) +
    "&details=" + encodeURIComponent(MEETING_DETAILS);
}

function addMonthlyMeetingToCalendar(date) {
  var useGoogle = el("calendar-use-google") && el("calendar-use-google").checked;
  closeCalendarModal();

  if (useGoogle) {
    window.open(googleCalendarUrl(date), "_blank", "noopener");
    return;
  }

  var ics = meetingIcs(date);
  /* באייפון האירוע נפתח ישירות במסך "הוסף ליומן" של המכשיר, בלי הורדת קובץ */
  if (isAppleMobile()) {
    window.location.href = "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
    return;
  }

  /* במחשב: קובץ שנפתח ב־Outlook, ביומן של Mac או בכל יומן אחר */
  var blob = new Blob(["\ufeff" + ics], {type: "text/calendar;charset=utf-8"});
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.href = url;
  link.download = "monthly-budget-meeting-" + calendarDateValue(date) + ".ics";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
}
