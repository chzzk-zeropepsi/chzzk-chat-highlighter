// content.js — 격리 월드. WebSocket(inject.js)에서 받은 uid로 채팅 줄을 식별하고
// 지정 유저(uid 기준)의 채팅을 유저별 색상으로 강조한다.
(function () {
  const STORE_KEY = "cch_targets"; // { "<uid>": { color: "#rrggbb", nick: "<표시닉>" } }
  const WS_TAG = "__CCH_WS__";

  const PALETTE = [
    "#ffd54f", "#4fc3f7", "#81c784", "#ff8a65",
    "#ba68c8", "#f06292", "#4db6ac", "#fff176",
    "#9575cd", "#aed581", "#7986cb", "#ffb74d",
  ];

  // 치지직 CSS 모듈 해시 클래스 → 부분 일치 셀렉터
  const SEL = {
    container: '[class*="live_chatting_message_container"]',
    nickname:
      '[class*="username_nickname"], [class*="user_nickname"], [class*="name_text"]',
    text: '[class*="message_text"], [class*="chatting_message_text"]',
  };

  let targets = {}; // uid -> {color, nick}

  // WS에서 받은 매핑. nick+본문 → uid (정밀), nick → uid (폴백)
  const SEP = "";
  const keyToUid = new Map(); // "nickmsg" -> uid
  const nickToUid = new Map(); // "nick" -> uid (최근값)
  const MAX_MAP = 600;

  function load(cb) {
    chrome.storage.local.get(STORE_KEY, (r) => {
      targets = r[STORE_KEY] || {};
      cb && cb();
    });
  }
  function save() {
    chrome.storage.local.set({ [STORE_KEY]: targets });
  }

  function getNick(container) {
    const el = container.querySelector(SEL.nickname);
    return el ? el.textContent.trim() : "";
  }
  function getText(container) {
    const el = container.querySelector(SEL.text);
    return el ? el.textContent.trim() : "";
  }

  function hexToRgba(hex, a) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  // WS 매핑으로 채팅 줄에 uid 부여. 성공 시 data-cch-uid 세팅.
  function stampUid(container) {
    if (container.dataset.cchUid) return container.dataset.cchUid;
    const nick = getNick(container);
    if (!nick) return "";
    const text = getText(container);
    let uid = keyToUid.get(nick + SEP + text);
    if (!uid) uid = nickToUid.get(nick); // 이모티콘 등으로 본문이 안 맞을 때 폴백
    if (uid) container.dataset.cchUid = uid;
    return uid || "";
  }

  function applyTo(container) {
    const uid = container.dataset.cchUid || stampUid(container);
    const t = uid && targets[uid];
    if (t && t.color) {
      container.style.background = hexToRgba(t.color, 0.18);
      container.style.borderLeft = `3px solid ${t.color}`;
      container.style.borderRadius = "4px";
      container.title = t.memo || ""; // 메모가 있으면 hover 툴팁
      container.dataset.cchOn = "1";
    } else if (container.dataset.cchOn) {
      container.style.background = "";
      container.style.borderLeft = "";
      container.style.borderRadius = "";
      container.removeAttribute("title");
      delete container.dataset.cchOn;
    }
  }

  function scanAll() {
    document.querySelectorAll(SEL.container).forEach(applyTo);
  }

  function pickColor() {
    const used = new Set(Object.values(targets).map((t) => t.color));
    const free = PALETTE.find((c) => !used.has(c));
    if (free) return free;
    return PALETTE[Object.keys(targets).length % PALETTE.length];
  }

  // --- WS 데이터 수신 (inject.js → postMessage) ---
  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.source !== WS_TAG || !Array.isArray(d.items)) return;
    for (const it of d.items) {
      if (!it.uid) continue;
      if (it.nick) {
        nickToUid.set(it.nick, it.uid);
        keyToUid.set(it.nick + SEP + (it.msg || ""), it.uid);
        // 지정된 유저면 최신 닉네임을 저장에 반영
        if (targets[it.uid] && targets[it.uid].nick !== it.nick) {
          targets[it.uid].nick = it.nick;
          save();
        }
      }
      if (keyToUid.size > MAX_MAP) keyToUid.delete(keyToUid.keys().next().value);
      if (nickToUid.size > MAX_MAP) nickToUid.delete(nickToUid.keys().next().value);
    }
    // 아직 uid가 안 붙은 줄들을 다시 시도 + 강조 적용
    document.querySelectorAll(SEL.container + ":not([data-cch-uid])").forEach(applyTo);
  });

  // 새 채팅 줄 강조
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.matches && n.matches(SEL.container)) applyTo(n);
        if (n.querySelectorAll) n.querySelectorAll(SEL.container).forEach(applyTo);
      }
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  // 채팅 우클릭 → 해당 유저(uid) 하이라이트 토글
  document.addEventListener(
    "contextmenu",
    (e) => {
      const container = e.target.closest && e.target.closest(SEL.container);
      if (!container) return;
      const uid = container.dataset.cchUid || stampUid(container);
      const nick = getNick(container);
      if (!uid) {
        e.preventDefault();
        toast("아직 이 채팅의 유저 정보를 못 읽었어요. 잠시 후 다시 우클릭해 주세요.");
        return;
      }
      e.preventDefault();
      if (targets[uid]) {
        delete targets[uid];
        toast(`"${nick || uid}" 하이라이트 해제`);
      } else {
        targets[uid] = { color: pickColor(), nick: nick || "", memo: "", folder: "" };
        toast(`"${nick || uid}" 하이라이트 추가`, targets[uid].color);
      }
      save();
      scanAll();
    },
    true
  );

  // 팝업에서 변경 시 즉시 반영
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === "local" && ch[STORE_KEY]) {
      targets = ch[STORE_KEY].newValue || {};
      scanAll();
    }
  });

  // 토스트
  let toastEl = null,
    toastTimer = null;
  function toast(msg, color) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.id = "cch-toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.borderLeft = `4px solid ${color || "#00ffa3"}`;
    toastEl.classList.add("cch-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("cch-show"), 1800);
  }

  load(scanAll);
})();
