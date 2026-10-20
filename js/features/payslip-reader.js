"use strict";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PAYSLIP READER
   קריאת תלוש PDF דיגיטלי במכשיר בלבד (pdf.js, ללא שרת וללא AI).
   הזיהוי מבוסס על התוויות שבתלוש: לכל תווית לוקחים את הסכום בעמודה
   או בשורה שלה, ולא לפי סדר הופעה. כרגע נבנה ונבדק מול תבנית מלם שכר.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var PDFJS_SRC = "assets/vendor/pdfjs/pdf.min.js";
var PDFJS_WORKER_SRC = "assets/vendor/pdfjs/pdf.worker.min.js";
var PAYSLIP_MONTH_PATTERN = /^(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s+\d{4}$/;
var _pdfjsLoading = null;

function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (_pdfjsLoading) return _pdfjsLoading;
  _pdfjsLoading = new Promise(function(resolve, reject) {
    var script = document.createElement("script");
    script.src = PDFJS_SRC;
    script.onload = function() {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
      resolve(window.pdfjsLib);
    };
    script.onerror = function() { _pdfjsLoading = null; reject(new Error("pdf.js failed to load")); };
    document.head.appendChild(script);
  });
  return _pdfjsLoading;
}

/* מחזיר את פריטי הטקסט בעמוד הראשון: {s: טקסט, x, y, w} */
function readPdfTextItems(file) {
  return Promise.all([loadPdfJs(), file.arrayBuffer()]).then(function(results) {
    /* isEvalSupported: false חוסם הרצת קוד מגופנים בקובץ (CVE-2024-4367) */
    return results[0].getDocument({data: new Uint8Array(results[1]), isEvalSupported: false}).promise;
  }).then(function(doc) {
    return doc.getPage(1);
  }).then(function(page) {
    return page.getTextContent();
  }).then(function(content) {
    return content.items.filter(function(item) { return item.str && item.str.trim(); }).map(function(item) {
      return {s: item.str.trim(), x: item.transform[4], y: item.transform[5], w: item.width};
    });
  });
}

function payslipAmount(text) {
  var value = String(text).trim();
  return /^-?(\d{1,3}(,\d{3})+|\d+)\.\d{2}$/.test(value) ? Number(value.replace(/,/g, "")) : null;
}

function findPayslipLabel(items, pattern) {
  return items.filter(function(item) {
    return typeof pattern === "string" ? item.s === pattern : pattern.test(item.s);
  })[0] || null;
}

function amountItemsOnLine(items, y) {
  return items.filter(function(item) { return Math.abs(item.y - y) <= 3 && payslipAmount(item.s) !== null; });
}

/* טבלת הסיכום בתחתית התלוש: הערך נמצא מתחת לתווית, באותה עמודה */
function payslipColumnValue(items, label) {
  var head = findPayslipLabel(items, label);
  if (!head) return null;
  var center = head.x + head.w / 2;
  var best = null;
  items.forEach(function(item) {
    var value = payslipAmount(item.s);
    var drop = head.y - item.y;
    if (value === null || drop < 8 || drop > 45) return;
    var distance = Math.abs(item.x + item.w / 2 - center);
    if (distance <= 25 && (!best || distance < best.distance)) best = {distance: distance, value: value};
  });
  return best ? best.value : null;
}

/* שורת ניכוי: הסכום הכולל הוא המספר השמאלי ביותר בשורה, משמאל לתווית */
function payslipRowTotal(items, label) {
  var head = typeof label === "object" ? label : findPayslipLabel(items, label);
  if (!head) return null;
  var amounts = amountItemsOnLine(items, head.y).filter(function(item) { return item.x < head.x; });
  if (!amounts.length) return null;
  amounts.sort(function(a, b) { return a.x - b.x; });
  return payslipAmount(amounts[0].s);
}

function isPensionFund(name) { return /פנס|גמל/.test(name) && !/השתלמות|קה"ש/.test(name); }
function isStudyFund(name) { return /השתלמות|קה"ש/.test(name); }

/* הפקדות העובד: שורות הקופות בין "קופות גמל" ל"סה"כ ניכויים שוטף" */
function payslipEmployeeFunds(items) {
  var start = findPayslipLabel(items, /קופות גמל/);
  var end = findPayslipLabel(items, /סה"כ ניכויים שוטף/);
  var employer = findPayslipLabel(items, /הפרשות מעסיק לגמל/);
  var result = {pension: null, study: null};
  if (!start || !end) return result;
  items.forEach(function(item) {
    if (item.y >= start.y || item.y <= end.y || payslipAmount(item.s) !== null) return;
    if (employer && item.x >= employer.x - 40) return;
    var key = isStudyFund(item.s) ? "study" : isPensionFund(item.s) ? "pension" : null;
    if (!key) return;
    var amount = payslipRowTotal(items, item);
    if (amount !== null) result[key] = (result[key] || 0) + amount;
  });
  return result;
}

/* הפקדות המעסיק: השורות שמתחת ל"הפרשות מעסיק לגמל", עם הסכום משמאל לשם הקופה */
function payslipEmployerFunds(items) {
  var head = findPayslipLabel(items, /הפרשות מעסיק לגמל/);
  var result = {pension: null, study: null};
  if (!head) return result;
  items.forEach(function(item) {
    var drop = head.y - item.y;
    if (drop <= 2 || drop > 45 || item.x < head.x - 10 || /^בסיס/.test(item.s)) return;
    var key = isStudyFund(item.s) ? "study" : isPensionFund(item.s) ? "pension" : null;
    if (!key) return;
    var amounts = amountItemsOnLine(items, item.y).filter(function(a) { return a.x < item.x && a.x > item.x - 70; });
    if (!amounts.length) return;
    amounts.sort(function(a, b) { return b.x - a.x; });
    result[key] = (result[key] || 0) + payslipAmount(amounts[0].s);
  });
  return result;
}

function roundMoney(value) { return Math.round(value * 100) / 100; }

function parsePayslipItems(items) {
  var monthItem = items.filter(function(item) { return PAYSLIP_MONTH_PATTERN.test(item.s); })[0];
  var employee = payslipEmployeeFunds(items);
  var employer = payslipEmployerFunds(items);
  var result = {
    month: monthItem ? monthItem.s : "",
    gross: payslipColumnValue(items, "סך תשלומים"),
    incomeTax: payslipRowTotal(items, "מס הכנסה"),
    nationalInsurance: payslipRowTotal(items, "ביטוח לאומי"),
    health: payslipRowTotal(items, "ביטוח בריאות"),
    mandatory: payslipColumnValue(items, "ניכויי חובה"),
    net: payslipColumnValue(items, "שכר נטו"),
    savings: payslipColumnValue(items, 'ניכויי חו"ז'),
    otherDeductions: payslipColumnValue(items, "ניכויי משרד"),
    bank: payslipColumnValue(items, "סכום בבנק"),
    pensionEmployee: employee.pension,
    studyEmployee: employee.study,
    pensionEmployer: employer.pension === null ? null : roundMoney(employer.pension),
    studyEmployer: employer.study === null ? null : roundMoney(employer.study)
  };
  /* בדיקת התאמה: ברוטו פחות ניכויי חובה = נטו, ונטו פחות חיסכון וניכויים אחרים = סכום בבנק */
  var checks = [];
  if (result.gross !== null && result.mandatory !== null && result.net !== null) {
    checks.push(Math.abs(result.gross - result.mandatory - result.net) < 1);
  }
  if (result.net !== null && result.bank !== null) {
    checks.push(Math.abs(result.net - (result.savings || 0) - (result.otherDeductions || 0) - result.bank) < 1);
  }
  result.consistent = checks.length > 0 && checks.every(Boolean);
  result.found = result.bank !== null || result.net !== null;
  return result;
}

/* ── UI: the "what we found in the payslip" card under the payslip file ── */
var PAYSLIP_ROWS = [
  {key: "gross", label: "ברוטו", note: "כל התשלומים לפני ניכויים: שכר, שעות נוספות, תוספות ונסיעות."},
  {key: "incomeTax", label: "מס הכנסה", note: "לפי מדרגות המס ונקודות הזיכוי.", deduction: true},
  {key: "nationalInsurance", label: "ביטוח לאומי", note: "ניכוי חובה.", deduction: true},
  {key: "health", label: "ביטוח בריאות", note: "מס בריאות, ניכוי חובה.", deduction: true},
  {key: "net", label: "שכר נטו", note: "אחרי ניכויי החובה. ממנו יורדים עוד החיסכון והניכויים האחרים."},
  {key: "pensionEmployee", label: "פנסיה (החלק שלך)", note: "חיסכון לפנסיה שיורד מהשכר.", deduction: true},
  {key: "studyEmployee", label: "קרן השתלמות (החלק שלך)", note: "חיסכון לטווח בינוני, יורד מהשכר.", deduction: true},
  {key: "otherDeductions", label: "ניכויים אחרים", note: "ניכויים של המעסיק, כמו ועד או ארוחות.", deduction: true, hideZero: true}
];

function renderPayslipFindings(container, result, person, errorDetail) {
  container.innerHTML = "";
  if (!result || !result.found) {
    container.appendChild(mkText("p", "payslip-findings-empty",
      "לא הצלחנו לקרוא נתונים מהקובץ הזה. כרגע הזיהוי עובד על תלוש PDF דיגיטלי, ואפשר תמיד להזין את הסכום ידנית." + (errorDetail || "")));
    return;
  }
  var card = mk("section", "payslip-findings");
  card.appendChild(mkText("h3", "", "מה זיהינו בתלוש" + (result.month ? " · " + result.month : "")));

  var list = mk("div", "payslip-findings-list");
  PAYSLIP_ROWS.forEach(function(row) {
    var value = result[row.key];
    if (value === null || (row.hideZero && !value)) return;
    var line = mk("div", "payslip-finding");
    var text = mk("div", "payslip-finding-text");
    text.appendChild(mkText("strong", "", row.label));
    text.appendChild(mkText("small", "", row.note));
    line.appendChild(text);
    line.appendChild(mkText("span", "payslip-finding-amount" + (row.deduction ? " is-deduction" : ""), (row.deduction ? "−" : "") + money(value)));
    list.appendChild(line);
  });
  card.appendChild(list);

  if (result.bank !== null) {
    var bank = mk("div", "payslip-bank");
    var bankText = mk("div", "payslip-finding-text");
    bankText.appendChild(mkText("strong", "", "נכנס לחשבון בפועל"));
    bankText.appendChild(mkText("small", "", "זה הסכום שכדאי להזין בתקציב."));
    bank.appendChild(bankText);
    bank.appendChild(mkText("span", "payslip-bank-amount", money(result.bank)));
    card.appendChild(bank);

    var use = mkText("button", "payslip-use-btn", "השתמש בסכום כ" + salaryLabel(person));
    use.type = "button";
    use.onclick = function() {
      updateState((person === 2 ? "income2" : "income1") + ".0.val", result.bank);
      use.textContent = "✓ עודכן: " + salaryLabel(person) + " " + money(result.bank);
      use.disabled = true;
    };
    card.appendChild(use);
  }

  card.appendChild(mkText("p", "payslip-check" + (result.consistent ? "" : " is-warning"), result.consistent
    ? "✓ הסכומים בתלוש מתאימים זה לזה."
    : "חלק מהסכומים לא הסתדרו בבדיקה. כדאי להשוות מול התלוש לפני שמשתמשים בהם."));

  var hasEmployer = result.pensionEmployer !== null || result.studyEmployer !== null;
  if (hasEmployer) {
    var employer = mk("div", "payslip-employer");
    employer.appendChild(mkText("strong", "", "המעסיק הפקיד לטובתך (לא יורד מהשכר)"));
    if (result.pensionEmployer !== null) employer.appendChild(mkText("span", "", "פנסיה: " + money(result.pensionEmployer)));
    if (result.studyEmployer !== null) employer.appendChild(mkText("span", "", "קרן השתלמות: " + money(result.studyEmployer)));
    var toInvestments = mkText("button", "payslip-invest-btn", "עדכן את ההפקדות בעמוד ההשקעות");
    toInvestments.type = "button";
    toInvestments.onclick = function() {
      applyPayslipToInvestments(result);
      toInvestments.textContent = "✓ ההפקדות עודכנו בעמוד ההשקעות";
      toInvestments.disabled = true;
    };
    employer.appendChild(toInvestments);
    card.appendChild(employer);
  }
  container.appendChild(card);
}

/* מעדכן רק את ההפקדות החודשיות (עובד ומעסיק). הסכום המצטבר ודמי הניהול לא משתנים */
function applyPayslipToInvestments(result) {
  [["pension", result.pensionEmployee, result.pensionEmployer], ["training", result.studyEmployee, result.studyEmployer]].forEach(function(entry) {
    if (entry[1] === null && entry[2] === null) return;
    var record = AppState.investments[entry[0]] || normalizeInvestmentOverview({});
    if (entry[1] !== null) record.personalDeposit = entry[1];
    if (entry[2] !== null) record.employerDeposit = entry[2];
    AppState.investments[entry[0]] = record;
  });
  saveInvestmentsOverview();
  flashSaved();
}

function payslipErrorDetail(error) {
  return error && error.message ? " (פירוט: " + String(error.message).slice(0, 120) + ")" : "";
}

/* מציג את העמוד הראשון של ה־PDF כתמונה בתוך החלון */
function renderPdfPreview(file, container) {
  return Promise.all([loadPdfJs(), file.arrayBuffer()]).then(function(results) {
    return results[0].getDocument({data: new Uint8Array(results[1]), isEvalSupported: false}).promise;
  }).then(function(doc) {
    return doc.getPage(1);
  }).then(function(page) {
    var width = Math.max(240, container.clientWidth || 320);
    var base = page.getViewport({scale: 1});
    var ratio = Math.min(2, window.devicePixelRatio || 1);
    var viewport = page.getViewport({scale: (width / base.width) * ratio});
    var canvas = document.createElement("canvas");
    canvas.className = "payslip-preview-image";
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    return page.render({canvasContext: canvas.getContext("2d"), viewport: viewport}).promise.then(function() {
      container.innerHTML = "";
      container.appendChild(canvas);
    });
  });
}

function showPayslipFindings(record, person) {
  var container = el("payslip-findings");
  if (!container) return;
  container.innerHTML = "";
  if (!record) return;
  /* תלוש שנשמר בגרסה קודמת לא נקרא אוטומטית: קובץ כזה עלול להיות פגום ב־iOS */
  if (record.legacy || !record.file) {
    container.appendChild(mkText("p", "payslip-findings-empty", "התלוש נשמר בגרסה קודמת של האפליקציה. כדי לקרוא אותו, מחקו והעלו אותו שוב."));
    return;
  }
  var isPdf = record.type === "application/pdf" || /\.pdf$/i.test(record.name || "");
  if (!isPdf) {
    container.appendChild(mkText("p", "payslip-findings-empty", "התלוש נשמר. זיהוי סכומים אוטומטי זמין כרגע לתלוש PDF דיגיטלי."));
    return;
  }
  container.appendChild(mkText("p", "payslip-findings-empty", "קוראים את התלוש במכשיר…"));
  readPdfTextItems(record.file).then(function(items) {
    renderPayslipFindings(container, parsePayslipItems(items), person);
  }).catch(function(error) {
    renderPayslipFindings(container, null, person, payslipErrorDetail(error));
  });
}
