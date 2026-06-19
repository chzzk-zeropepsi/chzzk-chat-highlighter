# 치지직 채팅 하이라이터 (chzzk-chat-highlighter)

[![total downloads](https://img.shields.io/github/downloads/chzzk-zeropepsi/chzzk-chat-highlighter/total?label=total%20downloads&color=00b377)](https://github.com/chzzk-zeropepsi/chzzk-chat-highlighter/releases)
[![latest release downloads](https://img.shields.io/github/downloads/chzzk-zeropepsi/chzzk-chat-highlighter/latest/total?label=latest%20downloads&color=00b377)](https://github.com/chzzk-zeropepsi/chzzk-chat-highlighter/releases/latest)
[![latest version](https://img.shields.io/github/v/release/chzzk-zeropepsi/chzzk-chat-highlighter?label=version&color=00b377)](https://github.com/chzzk-zeropepsi/chzzk-chat-highlighter/releases/latest)

치지직 채팅창에서 특정 유저의 채팅만 유저별 색상으로 강조해주는 크롬 확장 (MV3).

> 배지의 다운로드 수는 GitHub Releases에 올린 zip 자산의 누적/최신 릴리스 다운로드 횟수입니다. (shields.io 제공, 약간의 캐시 지연 있음)

## 사용법

1. `chrome://extensions` → 우상단 **개발자 모드** ON
2. **압축해제된 확장 프로그램을 로드** → 이 폴더 선택
3. 치지직 라이브 페이지에서 **채팅 메시지를 우클릭** → 그 작성자가 하이라이트 목록에 추가/해제
4. 확장 아이콘(팝업)에서 관리:
   - 유저별 **색 변경**, 삭제
   - **폴더**로 묶기 (폴더 생성/이름변경/삭제, 유저를 드롭다운으로 폴더 이동)
   - 📝 **메모** — 강조한 이유 기록. 메모가 있으면 채팅 위에 hover 시 툴팁으로 표시
   - **도네이션 채팅 숨기기** 토글 — 도네가 많이 터져 채팅이 가릴 때 도네 메시지만 숨김

## 식별 방식 (hash 기준)

닉네임이 아니라 유저 고유 ID(`uid`, 치지직 hash)로 사람을 기억한다. 그래서:

- 닉네임을 바꿔도 계속 강조됨
- 동명이인(닉네임 같은 다른 사람)도 구분됨
- 어느 방송 채널에 가도 같은 사람이면 강조됨

`uid`는 DOM에 노출되지 않으므로 **채팅 WebSocket 프레임**에서 읽는다.
`content/inject.js`(MAIN world, document_start)가 `WebSocket`을 후킹해
각 채팅의 `{uid, 닉네임, 본문}`을 뽑아 `postMessage` → `content/content.js`(격리 월드)가
`(닉네임+본문)→uid` 매핑을 만들어 채팅 줄에 `data-cch-uid`를 부여하고 강조한다.

## 구조

- `manifest.json` — MV3, `storage` 권한, content script 2개(MAIN/격리)
- `content/inject.js` — MAIN world. WebSocket 후킹 → uid/nick/msg 추출
- `content/content.js` — 격리 월드. WS 매핑 + DOM 관찰 + 우클릭 토글 + 강조
- `content/content.css` — 토스트 스타일
- `popup/` — 관리 UI: uid별 색/삭제, 폴더 그룹화, 메모
  - 저장: `chrome.storage.local` — `cch_targets`(`{uid:{color,nick,memo,folder}}`), `cch_folders`(`[{id,name}]`)

## 주의

- 치지직 CSS 모듈 해시 클래스명을 `[class*="..."]` 부분 일치로 잡는다 (2026-06 실제 DOM 기준).
  - 행: `_item_`, 닉네임: `_nickname_`, 본문: `_chatting_message_ > _text_`
  - 도네 행: `_item_ + _small_padding_` (또는 내부 `_is_donation_` 마커)
  - 치지직이 클래스 규칙을 바꾸면 `content/content.js`의 `SEL` / `DONATION_SEL` 갱신.
- WebSocket 프레임 구조(`bdy[].uid`, `bdy[].profile`(JSON, `nickname`), `bdy[].msg`)에
  의존한다. 치지직이 프로토콜을 바꾸면 `content/inject.js`의 파싱부를 갱신.
- 본문이 이모티콘뿐이면 (닉네임+본문) 정밀 매칭이 어긋날 수 있어, 닉네임→uid 폴백으로 보정.
