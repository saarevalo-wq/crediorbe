const screens = {
  inbox: document.getElementById("screen-inbox"),
  procesos: document.getElementById("screen-procesos"),
  calendario: document.getElementById("screen-calendario"),
  settings: document.getElementById("screen-settings"),
  detail: document.getElementById("screen-detail"),
};
const tabButtons = [...document.querySelectorAll(".tabbar button")];
const tabbar = document.querySelector(".tabbar");
const TABS = ["inbox", "procesos", "calendario", "settings"];

let current = "inbox";

function show(name) {
  current = name;
  Object.entries(screens).forEach(([key, el]) => el.classList.toggle("active", key === name));
  const isTab = TABS.includes(name);
  tabbar.style.display = isTab ? "flex" : "none";
  if (isTab) {
    tabButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === name));
  }
  window.scrollTo(0, 0);
}

export function initRouter() {
  tabButtons.forEach((btn) => btn.addEventListener("click", () => show(btn.dataset.tab)));
  show("inbox");
}

export function goTo(name) {
  show(name);
}

export function currentScreen() {
  return current;
}
