import { getTodayMatchesPayload } from "./src/lib/matches/getTodayMatches.js";

const MATCH_DURATION_MS = 2 * 60 * 60 * 1000;
const SOURCE_STATUS_LABELS = {
  api: "API 实时",
  cache: "缓存可用",
  mock: "演示数据",
  error: "数据异常",
};
const STATUS_LABELS = {
  not_started: "未开始",
  live: "进行中",
  finished: "已结束",
  postponed: "已延期",
  unknown: "待确认",
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
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
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const todayLabel = document.querySelector("#todayLabel");
const matchCountLabel = document.querySelector("#matchCountLabel");
const dataUpdatedLabel = document.querySelector("#dataUpdatedLabel");
const dataSourceLabel = document.querySelector("#dataSourceLabel");
const notice = document.querySelector("#notice");
const matchGroups = document.querySelector("#matchGroups");
const qrFrame = document.querySelector("#qrFrame");
const qrImage = document.querySelector("#qrImage");
const qrPlaceholder = document.querySelector("#qrPlaceholder");
const qrDialog = document.querySelector("#qrDialog");
const qrDialogClose = document.querySelector("#qrDialogClose");
const qrDialogImage = document.querySelector("#qrDialogImage");
const qrSaveButton = document.querySelector("#qrSaveButton");

let currentMatches = [];

updateTodayLabel();
window.setInterval(updateTodayLabel, 60 * 1000);
window.setInterval(refreshMatchClock, 60 * 1000);

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

  qrDialogImage.src = qrImage.currentSrc || qrImage.src;
  qrDialogImage.dataset.saveSrc = qrImage.dataset.saveSrc || qrImage.src;
  qrDialog.showModal();
});

qrFrame.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && !qrImage.hidden) {
    event.preventDefault();
    qrFrame.click();
  }
});

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
  todayLabel.textContent = dateFormatter.format(new Date());
}

async function loadMatches() {
  const payload = await getTodayMatchesPayload();
  const matches = normalizeMatches(payload.matches);

  currentMatches = matches;
  renderMeta(payload, matches);
  renderNotice(payload.message);
  renderMatches(matches);
}

function normalizeMatches(matches = []) {
  return matches
    .filter((match) => match.homeTeam && match.awayTeam)
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
  matchCountLabel.textContent = `${matches.length} 场热门赛事`;
  dataUpdatedLabel.textContent = `数据更新时间 ${formatUpdatedAt(payload.updatedAt)}`;
  dataSourceLabel.textContent = `数据状态 ${formatSourceStatus(payload.sourceStatus)}`;
}

function renderNotice(message) {
  if (!message) {
    notice.hidden = true;
    notice.textContent = "";
    return;
  }

  showNotice(message);
}

function renderMatches(matches) {
  if (!matches.length) {
    renderEmpty("赛事数据暂时不可用，请稍后查看。");
    return;
  }

  const groups = groupByLeague(matches);
  matchGroups.innerHTML = "";

  for (const [league, leagueMatches] of groups) {
    const group = document.createElement("section");
    group.className = "competition-group";

    const title = document.createElement("h3");
    title.className = "competition-title";
    title.textContent = league;
    group.append(title);

    for (const match of leagueMatches) {
      group.append(createMatchCard(match));
    }

    matchGroups.append(group);
  }
}

function groupByLeague(matches) {
  return matches.reduce((groups, match) => {
    const league = match.league || "其他赛事";

    if (!groups.has(league)) {
      groups.set(league, []);
    }

    groups.get(league).push(match);
    return groups;
  }, new Map());
}

function createMatchCard(match) {
  const matchState = getMatchState(match);
  const card = document.createElement("article");
  card.className = "match-card";

  const kickoff = document.createElement("time");
  kickoff.className = "kickoff";
  kickoff.dateTime = match.kickoffTime || "";
  kickoff.textContent = formatKickoff(match.kickoffTime);

  const teams = document.createElement("div");
  teams.className = "teams";

  const detailLine = document.createElement("div");
  detailLine.className = "match-details";
  detailLine.append(
    createDetailItem("联赛", match.league || "待定"),
    createDetailItem("开赛", formatMatchDateTime(match.kickoffTime)),
    createDetailItem("状态", getStatusLabel(matchState.status)),
    createDetailItem("进度", formatCountdown(matchState), "countdown"),
  );

  if (match.round) {
    detailLine.append(createDetailItem("轮次", match.round));
  }

  const teamsLine = document.createElement("div");
  teamsLine.className = "teams__line";
  teamsLine.append(
    createTeamName(match.homeTeam),
    createScoreBadge(match, matchState),
    createTeamName(match.awayTeam),
  );

  teams.append(detailLine, teamsLine);

  const status = document.createElement("span");
  status.className = `status ${getStatusClass(matchState.status)}`;
  status.textContent = getStatusLabel(matchState.status);

  card.append(kickoff, teams, status);
  return card;
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

function formatKickoff(kickoffTime) {
  const date = new Date(kickoffTime);

  if (Number.isNaN(date.getTime())) {
    return "待定";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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
  const fetchedStatus = String(match.status || "unknown");
  const kickoffTime = Date.parse(match.kickoffTime || "");

  if (
    fetchedStatus === "finished" ||
    fetchedStatus === "live" ||
    fetchedStatus === "postponed"
  ) {
    return { status: fetchedStatus, kickoffTime };
  }

  if (Number.isNaN(kickoffTime)) {
    return { status: "unknown", kickoffTime };
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

  if (matchState.status === "unknown" || Number.isNaN(matchState.kickoffTime)) {
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
    renderMatches(currentMatches);
  }
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

function renderEmpty(message) {
  matchGroups.innerHTML = "";
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = message;
  matchGroups.append(empty);
}

function showNotice(message) {
  notice.hidden = false;
  notice.textContent = message;
}

function formatUpdatedAt(updatedAt) {
  const date = new Date(updatedAt);

  if (Number.isNaN(date.getTime())) {
    return "待同步";
  }

  return updatedAtFormatter.format(date);
}

function formatSourceStatus(sourceStatus) {
  return SOURCE_STATUS_LABELS[sourceStatus] || "状态待确认";
}

function getStatusLabel(status) {
  return STATUS_LABELS[status] || STATUS_LABELS.unknown;
}
