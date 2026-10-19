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

function addMonthlyMeetingToCalendar(date) {
  var endDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  var stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  var uid = "monthly-budget-" + icsDateValue(date) + "@financial-control.local";
  var lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Financial Control//Monthly Budget Meeting//HE",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    "UID:" + uid,
    "DTSTAMP:" + stamp,
    "DTSTART;VALUE=DATE:" + icsDateValue(date),
    "DTEND;VALUE=DATE:" + icsDateValue(endDate),
    "SUMMARY:פגישת התקציב החודשית",
    "DESCRIPTION:זמן לעדכן הכנסות, לבדוק הוצאות ולבנות תוכנית ברורה לחודש הקרוב.",
    "END:VEVENT",
    "END:VCALENDAR"
  ];
  var fileName = "monthly-budget-meeting-" + calendarDateValue(date) + ".ics";
  var blob = new Blob(["\ufeff" + lines.join("\r\n")], {type: "text/calendar;charset=utf-8"});
  var file = typeof File === "function" ? new File([blob], fileName, {type: blob.type}) : null;

  closeCalendarModal();

  if (file && navigator.share && navigator.canShare && navigator.canShare({files: [file]})) {
    navigator.share({title: "פגישת התקציב החודשית", files: [file]}).catch(function() {});
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
