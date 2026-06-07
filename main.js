const DATA_URL = "data/matches.json";
const MATCH_DURATION_MS = 2 * 60 * 60 * 1000;

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

const todayLabel = document.querySelector("#todayLabel");
const matchCountLabel = document.querySelector("#matchCountLabel");
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
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`赛程数据读取失败：${response.status}`);
    }

    const payload = await response.json();
    const matches = normalizeMatches(payload.matches);

    currentMatches = matches;
    renderMeta(payload, matches);
    renderMatches(matches);
  } catch (error) {
    const fallback = getFallbackPayload();
    const matches = normalizeMatches(fallback.matches);

    currentMatches = matches;
    renderMeta(fallback, matches);
    showNotice("暂时无法读取赛程文件，正在展示示例赛程。");
    renderMatches(matches);
  }
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
}

function renderMatches(matches) {
  if (!matches.length) {
    renderEmpty("今日暂无热门赛事");
    return;
  }

  const groups = groupByCompetition(matches);
  matchGroups.innerHTML = "";

  for (const [competition, competitionMatches] of groups) {
    const group = document.createElement("section");
    group.className = "competition-group";

    const title = document.createElement("h3");
    title.className = "competition-title";
    title.textContent = competition;
    group.append(title);

    for (const match of competitionMatches) {
      group.append(createMatchCard(match));
    }

    matchGroups.append(group);
  }
}

function groupByCompetition(matches) {
  return matches.reduce((groups, match) => {
    const competition = match.competition || "其他赛事";

    if (!groups.has(competition)) {
      groups.set(competition, []);
    }

    groups.get(competition).push(match);
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
    createDetailItem("编号", match.matchNo || "待定"),
    createDetailItem("开赛", formatMatchDateTime(match.kickoffTime)),
    createDetailItem("距开赛", formatCountdown(match, matchState), "countdown"),
  );

  const teamsLine = document.createElement("div");
  teamsLine.className = "teams__line";
  teamsLine.append(
    createTeamName(match.homeTeam),
    createVersus(),
    createTeamName(match.awayTeam),
  );
  teams.append(detailLine, teamsLine);

  const marketLine = createMarketLine(match);

  if (marketLine) {
    teams.append(marketLine);
  }

  if (match.sourceUrl) {
    const link = document.createElement("a");
    link.className = "match-link";
    link.href = match.sourceUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "查看来源";
    teams.append(link);
  }

  const status = document.createElement("span");
  status.className = `status ${getStatusClass(matchState.status)}`;
  status.textContent = matchState.status;

  card.append(kickoff, teams, status);
  return card;
}

function createTeamName(teamName) {
  const span = document.createElement("span");
  span.className = "team-name";
  span.textContent = teamName;
  return span;
}

function createVersus() {
  const span = document.createElement("span");
  span.className = "versus";
  span.textContent = "VS";
  return span;
}

function createDetailItem(label, value, variant = "") {
  const span = document.createElement("span");
  span.className = variant ? `match-detail match-detail--${variant}` : "match-detail";
  span.textContent = `${label} ${value}`;
  return span;
}

function createMarketLine(match) {
  const hasOdds = match.odds?.win || match.odds?.draw || match.odds?.lose;
  const hasHandicap = match.handicap || match.handicapOdds?.win;

  if (!hasOdds && !hasHandicap) {
    return null;
  }

  const line = document.createElement("div");
  line.className = "market-line";

  if (match.handicap) {
    line.append(createMarketItem("让球", match.handicap));
  }

  if (hasOdds) {
    line.append(
      createMarketItem("胜", match.odds.win || "-"),
      createMarketItem("平", match.odds.draw || "-"),
      createMarketItem("负", match.odds.lose || "-"),
    );
  }

  if (!hasOdds && match.handicapOdds?.win) {
    line.append(
      createMarketItem("让胜", match.handicapOdds.win || "-"),
      createMarketItem("让平", match.handicapOdds.draw || "-"),
      createMarketItem("让负", match.handicapOdds.lose || "-"),
    );
  }

  return line;
}

function createMarketItem(label, value) {
  const span = document.createElement("span");
  span.className = "market-item";
  const labelNode = document.createElement("b");
  labelNode.textContent = label;
  span.append(labelNode, ` ${value}`);
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
  if (status === "进行中") {
    return "status--live";
  }

  if (status === "已结束") {
    return "status--finished";
  }

  return "";
}

function getMatchState(match) {
  const fetchedStatus = normalizeStatus(match.status);
  const kickoffTime = Date.parse(match.kickoffTime || "");

  if (fetchedStatus === "已结束" || fetchedStatus === "进行中") {
    return { status: fetchedStatus, kickoffTime };
  }

  if (Number.isNaN(kickoffTime)) {
    return { status: fetchedStatus, kickoffTime };
  }

  const now = Date.now();

  if (now < kickoffTime) {
    return { status: "未开始", kickoffTime };
  }

  if (now < kickoffTime + MATCH_DURATION_MS) {
    return { status: "进行中", kickoffTime };
  }

  return { status: "已结束", kickoffTime };
}

function normalizeStatus(status = "") {
  if (/完场|结束|已结束|取消|延期/.test(status)) {
    return "已结束";
  }

  if (/直播|进行|上半场|下半场|中场|加时|点球/.test(status)) {
    return "进行中";
  }

  return "未开始";
}

function formatCountdown(match, matchState = getMatchState(match)) {
  if (matchState.status === "进行中") {
    return "比赛进行中";
  }

  if (matchState.status === "已结束") {
    return "比赛已结束";
  }

  if (Number.isNaN(matchState.kickoffTime)) {
    return "待定";
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

function getFallbackPayload() {
  return {
    date: "2026-06-07",
    timezone: "Asia/Shanghai",
    source: "示例数据",
    updatedAt: "2026-06-07T08:00:00.000Z",
    matches: [
      {
        competition: "国际友谊赛",
        matchNo: "示例 001",
        kickoffTime: "2026-06-07T11:00:00.000Z",
        homeTeam: "英格兰",
        awayTeam: "葡萄牙",
        status: "未开始",
        handicap: "-1",
        odds: { win: "1.80", draw: "3.20", lose: "4.10" },
        handicapOdds: { win: "2.20", draw: "3.35", lose: "2.75" },
        sourceUrl: "",
      },
      {
        competition: "中超",
        matchNo: "示例 002",
        kickoffTime: "2026-06-07T11:35:00.000Z",
        homeTeam: "上海海港",
        awayTeam: "山东泰山",
        status: "未开始",
        handicap: "-0.5",
        odds: { win: "2.05", draw: "3.05", lose: "3.30" },
        handicapOdds: { win: "2.58", draw: "3.10", lose: "2.30" },
        sourceUrl: "",
      },
      {
        competition: "国际友谊赛",
        matchNo: "示例 003",
        kickoffTime: "2026-06-07T18:45:00.000Z",
        homeTeam: "法国",
        awayTeam: "德国",
        status: "未开始",
        handicap: "0",
        odds: { win: "2.30", draw: "3.10", lose: "2.85" },
        handicapOdds: { win: "2.30", draw: "3.10", lose: "2.85" },
        sourceUrl: "",
      },
    ],
  };
}
