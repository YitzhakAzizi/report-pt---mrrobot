"use strict";

function renderLandingMonth() {
  var monthIcon = el("landing-month");
  if (!monthIcon) return;
  var monthName = MONTHS[new Date().getMonth()];
  monthIcon.textContent = monthName;
  monthIcon.setAttribute("aria-label", "החודש הנוכחי: " + monthName);
}

function showLandingConfetti() {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var landing = el("landing-screen");
  if (!landing) return;

  var layer = document.createElement("div");
  layer.className = "landing-confetti";
  layer.setAttribute("aria-hidden", "true");

  var colors = ["#22c55e", "#163a5f", "#d4af37", "#94a3b8"];
  for (var i = 0; i < 20; i++) {
    var piece = document.createElement("span");
    piece.className = "landing-confetti-piece";
    piece.style.setProperty("--confetti-x", (8 + Math.random() * 84) + "%");
    piece.style.setProperty("--confetti-delay", (-Math.random() * 6) + "s");
    piece.style.setProperty("--confetti-duration", (5 + Math.random() * 2.5) + "s");
    piece.style.setProperty("--confetti-drift", (-34 + Math.random() * 68) + "px");
    piece.style.setProperty("--confetti-turn", (180 + Math.random() * 420) + "deg");
    piece.style.backgroundColor = colors[i % colors.length];
    layer.appendChild(piece);
  }

  landing.appendChild(layer);
}

function startBudgetMeeting() {
  var landing = el("landing-screen");
  var profileSetup = el("profile-setup-screen");
  if (!landing || !profileSetup) return;

  landing.classList.add("landing-screen-exit");

  setTimeout(function() {
    landing.hidden = true;
    profileSetup.hidden = false;
    profileSetup.setAttribute("aria-hidden", "false");
    profileSetup.classList.add("profile-setup-screen-visible");
    var firstStatus = profileSetup.querySelector("input[type='checkbox']");
    syncProfileSetupChoices();
    if (firstStatus) firstStatus.focus({preventScroll: true});
  }, 320);
}

function syncProfileSetupChoices() {
  var choices = document.querySelectorAll(".profile-status-grid input[type='checkbox']");
  Array.prototype.forEach.call(choices, function(choice) {
    choice.checked = AppState.profile[choice.value] === true;
  });
  var confirmation = el("profile-review-confirmation");
  if (confirmation) confirmation.checked = false;
  updateProfileConfirmation();
}

function updateProfileConfirmation() {
  var confirmation = el("profile-review-confirmation");
  var confirmButton = el("profile-confirm-button");
  if (confirmButton) confirmButton.disabled = !confirmation || !confirmation.checked;
}

function confirmProfileSetup() {
  var confirmation = el("profile-review-confirmation");
  if (!confirmation || !confirmation.checked) return;
  var choices = document.querySelectorAll(".profile-status-grid input[type='checkbox']");
  Array.prototype.forEach.call(choices, function(choice) {
    AppState.profile[choice.value] = choice.checked;
  });
  saveProfileSettings();
  pipeline();
  continueFromProfileSetup();
}

function continueFromProfileSetup() {
  var profileSetup = el("profile-setup-screen");
  var calculator = el("calculator-app");
  if (!profileSetup || !calculator) return;

  profileSetup.classList.add("profile-setup-screen-exit");
  calculator.classList.add("calculator-app-visible");
  calculator.setAttribute("aria-hidden", "false");

  setTimeout(function() {
    profileSetup.hidden = true;
    calculator.classList.add("calculator-app-entered");
    startBudgetFlow();
  }, 320);
}

renderLandingMonth();
showLandingConfetti();
