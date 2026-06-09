import { getTodayMatchesPayload } from "./src/lib/matches/getTodayMatches.js";

const MATCH_DURATION_MS = 2 * 60 * 60 * 1000;
const DEFAULT_HOT_LIMIT = 3;
const THEME_STORAGE_KEY = "football-theme-mode";
const THEME_LABELS = {
  light: "日间模式",
  dark: "夜间模式",
  system: "跟随系统",
  sun: "跟随日出日落",
};
const SOURCE_STATUS_LABELS = {
  api: "API 实时",
  cache: "Supabase 缓存",
  mock: "演示数据",
  error: "数据异常",
};
const STATUS_LABELS = {
  not_started: "未开赛",
  live: "进行中",
  finished: "已结束",
  postponed: "已延期",
  unknown: "未开赛",
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "long",
  day: "numeric",
  weekday: "long",
});

const kickoffFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  hour: "2-digit",
  minute: "2-digit",
});

const matchDateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
});

const updatedAtFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  hour: "2-digit",
  minute: "2-digit",
});

const fullUpdatedAtFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const todayLabel = document.querySelector("#todayLabel");
const heroSubtitle = document.querySelector("#heroSubtitle");
const matchCountLabel = document.querySelector("#matchCountLabel");
const dataUpdatedLabel = document.querySelector("#dataUpdatedLabel");
const dataSourceLabel = document.querySelector("#dataSourceLabel");
const todayMatchStat = document.querySelector("#todayMatchStat");
const hotMatchStat = document.querySelector("#hotMatchStat");
const updatedStat = document.querySelector("#updatedStat");
const scheduleCountLabel = document.querySelector("#scheduleCountLabel");
const notice = document.querySelector("#notice");
const featuredTitle = document.querySelector("#featured-title");
const scheduleTitle = document.querySelector("#schedule-title");
const featuredMatches = document.querySelector("#featuredMatches");
const matchGroups = document.querySelector("#matchGroups");
const filterTabs = document.querySelector("#filterTabs");
const navToggle = document.querySelector("#navToggle");
const siteNav = document.querySelector("#siteNav");
const themeButton = document.querySelector("#themeButton");
const themeButtonLabel = document.querySelector("#themeButtonLabel");
const themeMenu = document.querySelector("#themeMenu");
const qrFrame = document.querySelector("#qrFrame");
const qrImage = document.querySelector("#qrImage");
const qrPlaceholder = document.querySelector("#qrPlaceholder");
const qrDialog = document.querySelector("#qrDialog");
const qrDialogClose = document.querySelector("#qrDialogClose");
const qrDialogImage = document.querySelector("#qrDialogImage");
const qrSaveButton = document.querySelector("#qrSaveButton");
const mobileChatButton = document.querySelector("#mobileChatButton");

let currentMatches = [];
let currentPayload = null;
let activeFilter = "all";
let themeMode = getStoredThemeMode();
let systemThemeQuery = null;
let sunThemeFallback = null;

initTheme();
updateTodayLabel();
renderLoadingState();
window.setInterval(updateTodayLabel, 60 * 1000);
window.setInterval(refreshMatchClock, 60 * 1000);
window.setInterval(() => applyThemeMode(themeMode), 10 * 60 * 1000);

navToggle?.addEventListener("click", () => {
  const isOpen = siteNav.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

siteNav?.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    siteNav.classList.remove("is-open");
    navToggle?.setAttribute("aria-expanded", "false");
  }
});

themeButton?.addEventListener("click", () => {
  const isOpen = themeMenu.hidden;
  themeMenu.hidden = !isOpen;
  themeButton.setAttribute("aria-expanded", String(isOpen));
});

themeMenu?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-theme-mode]");

  if (!button) {
    return;
  }

  setThemeMode(button.dataset.themeMode || "system");
  themeMenu.hidden = true;
  themeButton.setAttribute("aria-expanded", "false");
});

document.addEventListener("click", (event) => {
  if (!themeMenu || themeMenu.hidden) {
    return;
  }

  if (!event.target.closest(".theme-switcher")) {
    themeMenu.hidden = true;
    themeButton?.setAttribute("aria-expanded", "false");
  }
});

filterTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");

  if (!button) {
    return;
  }

  activeFilter = button.dataset.filter || "all";
  updateFilterTabs();
  renderMatchSections();
});

qrImage.addEventListener("error", () => {
  if (!qrImage.dataset.fallbackTried && qrImage.dataset.saveSrc) {
    qrImage.dataset.fallbackTried = "true";
    qrImage.src = qrImage.dataset.saveSrc;
    return;
  }

  qrFrame.classList.remove("qr-frame--loaded");
  qrFrame.classList.remove("qr-frame--interactive");
  qrFrame.style.removeProperty("--qr-aspect");
  qrFrame.removeAttribute("tabindex");
  qrFrame.removeAttribute("role");
  qrImage.hidden = true;
  qrPlaceholder.hidden = false;
});

qrImage.addEventListener("load", () => {
  delete qrImage.dataset.fallbackTried;

  if (qrImage.naturalWidth && qrImage.naturalHeight) {
    qrFrame.style.setProperty(
      "--qr-aspect",
      `${qrImage.naturalWidth} / ${qrImage.naturalHeight}`,
    );
  }

  qrFrame.classList.add("qr-frame--loaded");
  qrImage.hidden = false;
  qrPlaceholder.hidden = true;
  qrFrame.classList.add("qr-frame--interactive");
  qrFrame.setAttribute("tabindex", "0");
  qrFrame.setAttribute("role", "button");
});

qrFrame.addEventListener("click", () => {
  if (qrImage.hidden) {
    return;
  }

  openQrDialog();
});

qrFrame.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && !qrImage.hidden) {
    event.preventDefault();
    openQrDialog();
  }
});

mobileChatButton?.addEventListener("click", openQrDialog);

qrDialogClose.addEventListener("click", () => {
  qrDialog.close();
});

qrDialog.addEventListener("click", (event) => {
  if (event.target === qrDialog) {
    qrDialog.close();
  }
});

qrSaveButton.addEventListener("click", saveQrImage);

loadMatches();

function updateTodayLabel() {
  todayLabel.textContent = `北京时间 ${dateFormatter.format(new Date())}`;
}

async function loadMatches() {
  try {
    const payload = await getTodayMatchesPayload();
    const matches = normalizeMatches(payload.matches);

    currentPayload = payload;
    currentMatches = matches;
    renderMeta(payload, matches);
    renderNotice(getNoticeMessage(payload, matches));
    renderMatchSections();
  } catch (error) {
    currentPayload = {
      success: false,
      sourceStatus: "error",
      updatedAt: null,
      matches: [],
      message: "数据暂时不可用，请稍后再试",
    };
    currentMatches = [];
    renderMeta(currentPayload, currentMatches);
    renderNotice("数据暂时不可用，请稍后再试");
    renderMatchSections();
  }
}

function normalizeMatches(matches = []) {
  return matches
    .filter((match) => match.homeTeam && match.awayTeam)
    .map((match, index) => {
      const matchState = getMatchState(match);
      return {
        ...match,
        normalizedStatus: matchState.status,
        isHot: Boolean(match.hot || match.isHot || index < DEFAULT_HOT_LIMIT || matchState.status === "live"),
      };
    })
    .sort((a, b) => {
      const first = Date.parse(a.kickoffTime || "");
      const second = Date.parse(b.kickoffTime || "");

      if (Number.isNaN(first) && Number.isNaN(second)) {
        return 0;
      }

      if (Number.isNaN(first)) {
        return 1;
      }

      if (Number.isNaN(second)) {
        return -1;
      }

      return first - second;
    });
}

function renderMeta(payload, matches) {
  const hotCount = getHotMatches(matches).length;
  const updatedAt = formatUpdatedAt(payload.updatedAt);
  const sourceLabel =
    payload.sourceStatus === "cache"
      ? "Supabase 缓存"
      : payload.sourceLabel || formatSourceStatus(payload.sourceStatus);
  const statusPrefix = payload.sourceStatus === "mock" ? "当前展示演示数据" : "数据已同步";
  const displayTitle = payload.displayTitle || "今日热门赛事";

  heroSubtitle.textContent = `北京时间 ${dateFormatter.format(new Date())} · 已同步 ${matches.length} 场赛事`;
  featuredTitle.textContent = displayTitle;
  scheduleTitle.textContent = payload.displaySource === "friendly" ? "友谊赛程" : "今日赛程";
  matchCountLabel.textContent = `${matches.length} 场赛事`;
  todayMatchStat.textContent = `${matches.length} 场`;
  hotMatchStat.textContent = `${hotCount} 场`;
  updatedStat.textContent = updatedAt.short;
  scheduleCountLabel.textContent = `${matches.length} 场全部赛事`;
  dataUpdatedLabel.textContent = `最近更新 ${updatedAt.full}`;
  dataSourceLabel.textContent = `${statusPrefix} · 来自 ${sourceLabel}`;
}

function initTheme() {
  systemThemeQuery = window.matchMedia?.("(prefers-color-scheme: dark)") || null;
  applyThemeMode(themeMode);
  updateThemeButton();

  systemThemeQuery?.addEventListener?.("change", () => {
    if (themeMode === "system" || themeMode === "sun") {
      applyThemeMode(themeMode);
    }
  });
}

function getStoredThemeMode() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return ["light", "dark", "system", "sun"].includes(stored) ? stored : "system";
}

function setThemeMode(mode) {
  themeMode = ["light", "dark", "system", "sun"].includes(mode) ? mode : "system";
  localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  applyThemeMode(themeMode);
  updateThemeButton();
}

function applyThemeMode(mode) {
  if (mode === "light" || mode === "dark") {
    setTheme(mode);
    return;
  }

  if (mode === "sun") {
    applySunTheme();
    return;
  }

  setTheme(resolveSystemTheme());
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function resolveSystemTheme() {
  if (systemThemeQuery) {
    return systemThemeQuery.matches ? "dark" : "light";
  }

  return resolveThemeByClock();
}

function applySunTheme() {
  const fallbackTheme = sunThemeFallback || resolveSystemTheme();

  if (!navigator.geolocation) {
    setTheme(fallbackTheme);
    return;
  }

  setTheme(fallbackTheme);

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const sunTheme = resolveSunTheme(
        position.coords.latitude,
        position.coords.longitude,
        new Date(),
      );
      sunThemeFallback = sunTheme;
      setTheme(sunTheme);
    },
    () => {
      sunThemeFallback = resolveSystemTheme();
      setTheme(sunThemeFallback);
    },
    {
      enableHighAccuracy: false,
      maximumAge: 60 * 60 * 1000,
      timeout: 3200,
    },
  );
}

function resolveThemeByClock(date = new Date()) {
  const hour = date.getHours();
  return hour >= 6 && hour < 18 ? "light" : "dark";
}

function resolveSunTheme(latitude, longitude, date) {
  const times = getSunTimes(date, latitude, longitude);
  const now = date.getTime();

  if (!times) {
    return resolveThemeByClock(date);
  }

  return now >= times.sunrise.getTime() && now < times.sunset.getTime() ? "light" : "dark";
}

function getSunTimes(date, latitude, longitude) {
  const zenith = 90.833;
  const dayOfYear = Math.floor(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
      Date.UTC(date.getFullYear(), 0, 0)) /
      86400000,
  );
  const lngHour = longitude / 15;
  const sunriseUtc = calculateSunTime(dayOfYear, latitude, lngHour, zenith, true);
  const sunsetUtc = calculateSunTime(dayOfYear, latitude, lngHour, zenith, false);

  if (sunriseUtc === null || sunsetUtc === null) {
    return null;
  }

  const sunrise = new Date(date);
  sunrise.setUTCHours(0, 0, 0, 0);
  sunrise.setUTCMinutes(sunriseUtc * 60);

  const sunset = new Date(date);
  sunset.setUTCHours(0, 0, 0, 0);
  sunset.setUTCMinutes(sunsetUtc * 60);

  return { sunrise, sunset };
}

function calculateSunTime(dayOfYear, latitude, lngHour, zenith, isSunrise) {
  const t = dayOfYear + ((isSunrise ? 6 : 18) - lngHour) / 24;
  const meanAnomaly = 0.9856 * t - 3.289;
  let trueLongitude =
    meanAnomaly +
    1.916 * Math.sin(toRadians(meanAnomaly)) +
    0.02 * Math.sin(toRadians(2 * meanAnomaly)) +
    282.634;
  trueLongitude = normalizeDegrees(trueLongitude);

  let rightAscension = toDegrees(Math.atan(0.91764 * Math.tan(toRadians(trueLongitude))));
  rightAscension = normalizeDegrees(rightAscension);
  rightAscension += Math.floor(trueLongitude / 90) * 90 - Math.floor(rightAscension / 90) * 90;
  rightAscension /= 15;

  const sinDeclination = 0.39782 * Math.sin(toRadians(trueLongitude));
  const cosDeclination = Math.cos(Math.asin(sinDeclination));
  const cosHour =
    (Math.cos(toRadians(zenith)) - sinDeclination * Math.sin(toRadians(latitude))) /
    (cosDeclination * Math.cos(toRadians(latitude)));

  if (cosHour > 1 || cosHour < -1) {
    return null;
  }

  const hourAngle = isSunrise
    ? 360 - toDegrees(Math.acos(cosHour))
    : toDegrees(Math.acos(cosHour));
  const localMeanTime =
    hourAngle / 15 + rightAscension - 0.06571 * t - 6.622;

  return normalizeHours(localMeanTime - lngHour);
}

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function normalizeHours(value) {
  return ((value % 24) + 24) % 24;
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians) {
  return (radians * 180) / Math.PI;
}

function updateThemeButton() {
  if (!themeButtonLabel || !themeMenu) {
    return;
  }

  themeButtonLabel.textContent = THEME_LABELS[themeMode] || THEME_LABELS.system;

  for (const button of themeMenu.querySelectorAll("[data-theme-mode]")) {
    button.classList.toggle("is-active", button.dataset.themeMode === themeMode);
  }
}

function renderNotice(message) {
  if (!message) {
    notice.hidden = true;
    notice.textContent = "";
    return;
  }

  notice.hidden = false;
  notice.textContent = message;
}

function getNoticeMessage(payload, matches) {
  if (payload.displayNotice) {
    return payload.displayNotice;
  }

  if (payload.message) {
    return payload.message;
  }

  if (payload.sourceStatus === "cache" && matches.length) {
    return "";
  }

  if (payload.sourceStatus === "error" && matches.length) {
    return "当前展示缓存数据";
  }

  if (payload.sourceStatus === "error") {
    return "数据暂时不可用，请稍后再试";
  }

  return "";
}

function renderMatchSections() {
  renderFeaturedMatches(currentMatches);
  renderTimeline(getFilteredMatches(currentMatches));
}

function renderFeaturedMatches(matches) {
  featuredMatches.innerHTML = "";
  const hotMatches = getHotMatches(matches).slice(0, DEFAULT_HOT_LIMIT);

  if (!hotMatches.length) {
    featuredMatches.append(createEmptyState("今日暂无焦点赛事", "请稍后刷新或查看缓存数据"));
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const match of hotMatches) {
    fragment.append(createFeaturedCard(match));
  }

  featuredMatches.append(fragment);
}

function renderTimeline(matches) {
  matchGroups.innerHTML = "";
  scheduleCountLabel.textContent = `${matches.length} 场${getFilterLabel(activeFilter)}赛事`;

  if (!currentMatches.length) {
    matchGroups.append(createEmptyState("今日暂无赛事数据", "请稍后刷新或查看缓存数据"));
    return;
  }

  if (!matches.length) {
    matchGroups.append(createEmptyState("当前筛选暂无赛事", "可以切换到全部赛程继续查看"));
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const match of matches) {
    fragment.append(createTimelineItem(match));
  }

  matchGroups.append(fragment);
}

function createFeaturedCard(match) {
  const matchState = getMatchState(match);
  const card = document.createElement("article");
  card.className = "featured-card";

  const meta = document.createElement("div");
  meta.className = "featured-card__meta";
  meta.append(
    createPill(match.displayLeague || match.league || "足球赛事", "pill--muted"),
    createPill(
      match.competitionType === "friendly"
        ? "友谊赛"
        : match.isHot
          ? "热门"
          : getStatusLabel(matchState.status),
      match.competitionType === "friendly" || match.isHot ? "pill--gold" : "",
    ),
  );

  const title = document.createElement("h3");
  title.textContent = `${match.homeTeam} vs ${match.awayTeam}`;

  const detail = document.createElement("p");
  detail.textContent = `${formatMatchDateTime(match.kickoffTime)} · ${getStatusLabel(matchState.status)}`;

  const focus = document.createElement("span");
  focus.className = "featured-card__tag";
  focus.textContent = matchState.status === "live" ? "正在进行" : "今日焦点";

  card.append(meta, title, detail, focus);
  return card;
}

function createTimelineItem(match) {
  const matchState = getMatchState(match);
  const item = document.createElement("article");
  item.className = match.isHot ? "timeline-item timeline-item--hot" : "timeline-item";

  const time = document.createElement("time");
  time.className = "timeline-time";
  time.dateTime = match.kickoffTime || "";
  time.textContent = formatKickoff(match.kickoffTime);

  const content = document.createElement("div");
  content.className = "timeline-content";

  const league = document.createElement("div");
  league.className = "timeline-league";
  const matchNo = getMatchNo(match);
  league.append(
    createMetaChip(matchNo),
    createMetaChip(shortenText(match.displayLeague || match.league || "足球赛事", 8), "timeline-meta__league"),
  );

  const teams = document.createElement("div");
  teams.className = "timeline-teams";
  teams.append(
    createTeamName(match.homeTeam),
    createScoreBadge(match, matchState),
    createTeamName(match.awayTeam),
  );

  const details = document.createElement("div");
  details.className = "timeline-details";
  details.append(
    createDetailItem("开赛", formatMatchDateTime(match.kickoffTime)),
    createDetailItem("进度", formatCountdown(matchState), "countdown"),
  );

  if (match.round) {
    details.append(createDetailItem(isMatchNo(match.round) ? "编号" : "轮次", match.round));
  }

  content.append(league, teams, details);

  const status = document.createElement("span");
  status.className = `status ${getStatusClass(matchState.status)}`;
  status.textContent = match.isHot && matchState.status === "not_started" ? "热门" : getStatusLabel(matchState.status);

  item.append(time, content, status);
  return item;
}

function createDetailItem(label, value, variant = "") {
  const span = document.createElement("span");
  span.className = variant ? `match-detail match-detail--${variant}` : "match-detail";
  span.textContent = `${label} ${value}`;
  return span;
}

function createTeamName(teamName) {
  const span = document.createElement("span");
  span.className = "team-name";
  span.textContent = teamName;
  return span;
}

function createScoreBadge(match, matchState) {
  const span = document.createElement("span");
  span.className = "versus";

  if (
    matchState.status !== "not_started" &&
    match.homeScore !== null &&
    match.homeScore !== undefined &&
    match.awayScore !== null &&
    match.awayScore !== undefined
  ) {
    span.textContent = `${match.homeScore} - ${match.awayScore}`;
    return span;
  }

  span.textContent = "VS";
  return span;
}

function createPill(text, className = "") {
  const span = document.createElement("span");
  span.className = className ? `pill ${className}` : "pill";
  span.textContent = text;
  return span;
}

function createMetaChip(text, className = "") {
  const span = document.createElement("span");
  span.className = className ? `timeline-meta ${className}` : "timeline-meta";
  span.textContent = text;
  return span;
}

function createEmptyState(title, description) {
  const empty = document.createElement("div");
  empty.className = "empty-state";

  const strong = document.createElement("strong");
  strong.textContent = title;

  const text = document.createElement("span");
  text.textContent = description;

  empty.append(strong, text);
  return empty;
}

function renderLoadingState() {
  featuredMatches.innerHTML = "";
  matchGroups.innerHTML = "";

  for (let index = 0; index < 3; index += 1) {
    featuredMatches.append(createSkeletonCard("featured"));
  }

  for (let index = 0; index < 5; index += 1) {
    matchGroups.append(createSkeletonCard("timeline"));
  }
}

function createSkeletonCard(type) {
  const card = document.createElement("div");
  card.className = type === "featured" ? "skeleton-card skeleton-card--featured" : "skeleton-card";
  card.setAttribute("aria-hidden", "true");

  const lines = type === "featured" ? 4 : 3;

  for (let index = 0; index < lines; index += 1) {
    const line = document.createElement("span");
    line.className = `skeleton-line skeleton-line--${index + 1}`;
    card.append(line);
  }

  return card;
}

function getFilteredMatches(matches) {
  if (activeFilter === "all") {
    return matches;
  }

  if (activeFilter === "hot") {
    return getHotMatches(matches);
  }

  return matches.filter((match) => getMatchState(match).status === activeFilter);
}

function getHotMatches(matches) {
  return matches.filter((match) => match.isHot);
}

function updateFilterTabs() {
  for (const button of filterTabs.querySelectorAll("[data-filter]")) {
    const isActive = button.dataset.filter === activeFilter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  }
}

function getFilterLabel(filter) {
  if (filter === "hot") {
    return "热门";
  }

  if (filter === "not_started") {
    return "未开赛";
  }

  if (filter === "live") {
    return "进行中";
  }

  if (filter === "finished") {
    return "已结束";
  }

  return "全部";
}

function formatKickoff(kickoffTime) {
  const date = new Date(kickoffTime);

  if (Number.isNaN(date.getTime())) {
    return "待定";
  }

  return kickoffFormatter.format(date);
}

function formatMatchDateTime(kickoffTime) {
  const date = new Date(kickoffTime);

  if (Number.isNaN(date.getTime())) {
    return "待定";
  }

  return matchDateTimeFormatter.format(date);
}

function getStatusClass(status = "") {
  if (status === "live") {
    return "status--live";
  }

  if (status === "finished") {
    return "status--finished";
  }

  if (status === "postponed") {
    return "status--postponed";
  }

  return "";
}

function getMatchState(match) {
  const fetchedStatus = String(
    match.status || match.match_status || match.state || "unknown",
  );
  const kickoffTime = Date.parse(match.kickoffTime || match.matchTime || match.startTime || "");

  if (
    fetchedStatus === "finished" ||
    fetchedStatus === "live" ||
    fetchedStatus === "postponed" ||
    fetchedStatus === "not_started"
  ) {
    return { status: fetchedStatus, kickoffTime };
  }

  if (Number.isNaN(kickoffTime)) {
    return { status: "not_started", kickoffTime };
  }

  const now = Date.now();

  if (now < kickoffTime) {
    return { status: "not_started", kickoffTime };
  }

  if (now < kickoffTime + MATCH_DURATION_MS) {
    return { status: "live", kickoffTime };
  }

  return { status: "finished", kickoffTime };
}

function formatCountdown(matchState) {
  if (matchState.status === "live") {
    return "比赛进行中";
  }

  if (matchState.status === "finished") {
    return "比赛已结束";
  }

  if (matchState.status === "postponed") {
    return "等待官方更新";
  }

  if (Number.isNaN(matchState.kickoffTime)) {
    return "待确认";
  }

  const remainingMs = Math.max(0, matchState.kickoffTime - Date.now());
  const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));

  if (remainingMinutes <= 0) {
    return "即将开始";
  }

  const days = Math.floor(remainingMinutes / (24 * 60));
  const hours = Math.floor((remainingMinutes % (24 * 60)) / 60);
  const minutes = remainingMinutes % 60;

  if (days > 0) {
    return `${days}天${hours}小时`;
  }

  if (hours > 0) {
    return `${hours}小时${minutes}分`;
  }

  return `${minutes}分钟`;
}

function refreshMatchClock() {
  updateTodayLabel();

  if (currentMatches.length) {
    currentMatches = normalizeMatches(currentMatches);
    renderMeta(currentPayload || {}, currentMatches);
    renderMatchSections();
  }
}

function openQrDialog() {
  qrDialogImage.src = qrImage.currentSrc || qrImage.src || "assets/qr-display.png";
  qrDialogImage.dataset.saveSrc = qrImage.dataset.saveSrc || qrImage.src || "assets/qr.PNG";
  qrDialog.showModal();
}

async function saveQrImage() {
  const imageUrl = qrDialogImage.dataset.saveSrc || qrDialogImage.src;

  qrSaveButton.disabled = true;

  try {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error("二维码读取失败");
    }

    const blob = await response.blob();
    const file = new File([blob], "qr.png", { type: blob.type || "image/png" });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "二维码" });
    } else {
      downloadQrImage(imageUrl);
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      downloadQrImage(imageUrl);
    }
  } finally {
    qrSaveButton.disabled = false;
  }
}

function downloadQrImage(imageUrl) {
  const link = document.createElement("a");
  link.href = imageUrl;
  link.download = "qr.png";
  document.body.append(link);
  link.click();
  link.remove();
}

function formatUpdatedAt(updatedAt) {
  const date = new Date(updatedAt);

  if (Number.isNaN(date.getTime())) {
    return {
      short: "待同步",
      full: "待同步",
    };
  }

  return {
    short: updatedAtFormatter.format(date),
    full: fullUpdatedAtFormatter.format(date),
  };
}

function formatSourceStatus(sourceStatus) {
  return SOURCE_STATUS_LABELS[sourceStatus] || "数据参考";
}

function getStatusLabel(status) {
  return STATUS_LABELS[status] || STATUS_LABELS.not_started;
}

function isMatchNo(value) {
  return /^周[一二三四五六日]\d{3}$/.test(String(value || ""));
}

function getMatchNo(match) {
  if (isMatchNo(match.round)) {
    return match.round;
  }

  if (isMatchNo(match.matchNo)) {
    return match.matchNo;
  }

  const index = currentMatches.findIndex((item) => item.id === match.id);
  return `赛${String(Math.max(index + 1, 1)).padStart(2, "0")}`;
}

function shortenText(value, maxLength) {
  const text = String(value || "");
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}
