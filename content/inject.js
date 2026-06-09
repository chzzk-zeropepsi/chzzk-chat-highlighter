// inject.js — MAIN world. 치지직 채팅 WebSocket을 후킹해서
// 각 채팅의 유저 hash(uid)·닉네임·본문을 격리 월드(content.js)로 넘긴다.
// content script(격리 월드)는 페이지의 WebSocket 객체를 가로챌 수 없어서
// 이 스크립트가 MAIN world / document_start 로 먼저 실행되어 패치한다.
(function () {
  const TAG = "__CCH_WS__";
  const Native = window.WebSocket;
  if (!Native || Native.__cchPatched) return;

  function parseProfileNick(p) {
    if (!p) return "";
    if (typeof p === "object") return p.nickname || "";
    if (typeof p === "string") {
      try {
        return JSON.parse(p).nickname || "";
      } catch (e) {
        return "";
      }
    }
    return "";
  }

  // 이모티콘 placeholder({:d_94:}) 제거 — DOM에는 이미지로 렌더되어 텍스트가 다르므로
  function cleanMsg(s) {
    return typeof s === "string" ? s.replace(/\{:[^}]*:\}/g, "").trim() : "";
  }

  function pushItem(out, it) {
    if (!it || typeof it !== "object") return;
    // 실시간(93101): userId / content, 기존채팅(15101): messageList[].userId / content
    const uid = it.userId || it.uid;
    if (!uid || uid === "anonymous") return; // 익명/시스템 제외
    const nick = parseProfileNick(it.profile);
    const msg = cleanMsg(typeof it.content === "string" ? it.content : it.msg);
    out.push({ uid: String(uid), nick, msg });
  }

  function handle(data) {
    if (typeof data !== "string") return;
    if (data.indexOf("bdy") < 0) return;
    let obj;
    try {
      obj = JSON.parse(data);
    } catch (e) {
      return;
    }
    const bdy = obj && obj.bdy;
    if (!bdy) return;
    const items = [];
    if (Array.isArray(bdy)) {
      // 실시간 채팅/도네 프레임 (cmd 93101 등)
      for (const it of bdy) pushItem(items, it);
    } else if (Array.isArray(bdy.messageList)) {
      // 입장 시 기존 채팅 묶음 (cmd 15101)
      for (const it of bdy.messageList) pushItem(items, it);
    } else if (typeof bdy === "object") {
      pushItem(items, bdy);
    }
    if (items.length) {
      window.postMessage({ source: TAG, items }, window.location.origin);
    }
  }

  function hook(ws) {
    try {
      ws.addEventListener("message", (ev) => {
        try {
          handle(ev.data);
        } catch (e) {}
      });
    } catch (e) {}
    return ws;
  }

  // 채팅 WS만 후킹 (채널 입장 시 치지직이 채널정보로 여는 *.chat.naver.com 소켓)
  function isChatUrl(url) {
    if (typeof url !== "string") {
      url = url && url.url; // URL 객체 대응
    }
    if (typeof url !== "string") return false;
    return /(^|\.)chat\.naver\.com/i.test(url) || /\/chat(\b|\/|\?)/i.test(url);
  }

  window.WebSocket = new Proxy(Native, {
    construct(target, args) {
      const ws = new target(...args);
      try {
        if (isChatUrl(args[0])) hook(ws);
      } catch (e) {}
      return ws;
    },
  });
  window.WebSocket.__cchPatched = true;
  window.WebSocket.prototype = Native.prototype;
})();
