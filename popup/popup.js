const STORE_KEY = "cch_targets"; // { uid: { color, nick, memo, folder } }
const FOLDER_KEY = "cch_folders"; // [ { id, name } ]

const listEl = document.getElementById("list");
const newFolderInput = document.getElementById("new-folder");

let targets = {};
let folders = [];

function loadAll(cb) {
  chrome.storage.local.get([STORE_KEY, FOLDER_KEY], (r) => {
    targets = r[STORE_KEY] || {};
    folders = r[FOLDER_KEY] || [];
    cb && cb();
  });
}
// 우리가 직접 저장해서 발생하는 onChanged는 무시(자기 쓰기로 인한 re-render 방지 →
// 메모 입력 중 textarea 포커스 끊김 방지). set 1회당 onChanged 1회로 1:1 상쇄.
let selfWrites = 0;
function saveTargets() {
  selfWrites++;
  chrome.storage.local.set({ [STORE_KEY]: targets });
}
function saveFolders() {
  selfWrites++;
  chrome.storage.local.set({ [FOLDER_KEY]: folders });
}
function genId() {
  return "f" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
}

function folderName(id) {
  const f = folders.find((x) => x.id === id);
  return f ? f.name : "";
}

// uid → 어떤 폴더에 속하는지 (없거나 모르는 폴더면 "" = 미분류)
function effectiveFolder(uid) {
  const fid = targets[uid] && targets[uid].folder;
  if (fid && folders.some((f) => f.id === fid)) return fid;
  return "";
}

function moveSelect(uid) {
  const sel = document.createElement("select");
  sel.className = "move";
  const optNone = document.createElement("option");
  optNone.value = "";
  optNone.textContent = "미분류";
  sel.appendChild(optNone);
  for (const f of folders) {
    const o = document.createElement("option");
    o.value = f.id;
    o.textContent = f.name;
    sel.appendChild(o);
  }
  sel.value = effectiveFolder(uid);
  sel.title = "폴더 이동";
  sel.addEventListener("change", () => {
    targets[uid].folder = sel.value;
    saveTargets();
    render();
  });
  return sel;
}

function userRow(uid) {
  const entry = targets[uid] || {};
  const li = document.createElement("li");

  const row = document.createElement("div");
  row.className = "row";

  const color = document.createElement("input");
  color.type = "color";
  color.value = entry.color || "#ffd54f";
  color.addEventListener("input", () => {
    targets[uid].color = color.value;
    saveTargets();
  });

  const name = document.createElement("span");
  name.className = "nick";
  name.textContent = entry.nick || uid;
  name.title = `${entry.nick || ""}\n${uid}`;

  const memoBtn = document.createElement("button");
  memoBtn.className = "icon-btn memo-btn" + (entry.memo ? " has-memo" : "");
  memoBtn.textContent = "📝";
  memoBtn.title = "메모";

  const del = document.createElement("button");
  del.className = "icon-btn del";
  del.textContent = "×";
  del.title = "삭제";
  del.addEventListener("click", () => {
    delete targets[uid];
    saveTargets();
    render();
  });

  const memo = document.createElement("textarea");
  memo.className = "memo" + (entry.memo ? " open" : "");
  memo.placeholder = "이 유저를 강조한 이유 메모…";
  memo.value = entry.memo || "";
  memo.addEventListener("input", () => {
    targets[uid].memo = memo.value;
    saveTargets();
    memoBtn.classList.toggle("has-memo", !!memo.value.trim());
  });

  memoBtn.addEventListener("click", () => {
    memo.classList.toggle("open");
    if (memo.classList.contains("open")) memo.focus();
  });

  row.append(color, name, moveSelect(uid), memoBtn, del);
  li.append(row, memo);
  return li;
}

function folderHeader(id, name, count, unfiled) {
  const head = document.createElement("div");
  head.className = "folder-head";

  const label = document.createElement("span");
  label.className = "folder-name" + (unfiled ? " unfiled" : "");
  label.textContent = name;

  const cnt = document.createElement("span");
  cnt.className = "folder-count";
  cnt.textContent = `(${count})`;

  head.append(label, cnt);

  if (!unfiled) {
    const spacer = document.createElement("span");
    spacer.className = "spacer";

    const rename = document.createElement("button");
    rename.className = "icon-btn";
    rename.textContent = "✎";
    rename.title = "이름 변경";
    rename.addEventListener("click", () => startRename(head, label, id));

    const fdel = document.createElement("button");
    fdel.className = "icon-btn";
    fdel.textContent = "🗑";
    fdel.title = "폴더 삭제 (유저는 미분류로 이동)";
    fdel.addEventListener("click", () => {
      folders = folders.filter((f) => f.id !== id);
      for (const uid in targets) {
        if (targets[uid].folder === id) targets[uid].folder = "";
      }
      saveFolders();
      saveTargets();
      render();
    });

    head.append(spacer, rename, fdel);
  }
  return head;
}

function startRename(head, label, id) {
  const input = document.createElement("input");
  input.className = "folder-name-input";
  input.value = folderName(id);
  input.maxLength = 20;
  const commit = () => {
    const v = input.value.trim();
    const f = folders.find((x) => x.id === id);
    if (f && v) {
      f.name = v;
      saveFolders();
    }
    render();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") commit();
    else if (e.key === "Escape") render();
  });
  input.addEventListener("blur", commit);
  head.replaceChild(input, label);
  input.focus();
  input.select();
}

function folderSection(id, name, uids, unfiled) {
  const wrap = document.createElement("div");
  wrap.className = "folder";
  wrap.appendChild(folderHeader(id, name, uids.length, unfiled));
  const ul = document.createElement("ul");
  for (const uid of uids) ul.appendChild(userRow(uid));
  wrap.appendChild(ul);
  return wrap;
}

function render() {
  listEl.innerHTML = "";

  const uids = Object.keys(targets);
  if (uids.length === 0 && folders.length === 0) {
    const d = document.createElement("div");
    d.className = "empty";
    d.textContent = "아직 강조한 유저가 없어요.";
    listEl.appendChild(d);
    return;
  }

  // 폴더별 그룹
  const byFolder = {};
  const unfiled = [];
  for (const uid of uids) {
    const fid = effectiveFolder(uid);
    if (fid) (byFolder[fid] = byFolder[fid] || []).push(uid);
    else unfiled.push(uid);
  }

  // 정의된 폴더 순서대로 (비어 있어도 표시)
  for (const f of folders) {
    listEl.appendChild(folderSection(f.id, f.name, byFolder[f.id] || [], false));
  }
  // 미분류는 유저가 있을 때만
  if (unfiled.length) {
    listEl.appendChild(folderSection("", "미분류", unfiled, true));
  }
}

document.getElementById("add-folder").addEventListener("click", () => {
  const name = newFolderInput.value.trim();
  if (!name) {
    newFolderInput.focus();
    return;
  }
  folders.push({ id: genId(), name });
  saveFolders();
  newFolderInput.value = "";
  render();
});
newFolderInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("add-folder").click();
});

// 다른 곳(채팅 우클릭 등)에서 바뀌면 갱신
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== "local") return;
  if (!ch[STORE_KEY] && !ch[FOLDER_KEY]) return;
  if (ch[STORE_KEY]) targets = ch[STORE_KEY].newValue || {};
  if (ch[FOLDER_KEY]) folders = ch[FOLDER_KEY].newValue || [];
  if (selfWrites > 0) {
    selfWrites--; // 우리가 만든 변경 → 메모리만 갱신, re-render 생략
    return;
  }
  render();
});

loadAll(render);
