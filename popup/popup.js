const STORE_KEY = "cch_targets"; // { uid: { color, nick } }
const listEl = document.getElementById("list");

function load(cb) {
  chrome.storage.local.get(STORE_KEY, (r) => cb(r[STORE_KEY] || {}));
}
function save(map) {
  chrome.storage.local.set({ [STORE_KEY]: map });
}

function render(map) {
  const uids = Object.keys(map);
  listEl.innerHTML = "";
  if (uids.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "아직 강조한 유저가 없어요.";
    listEl.appendChild(li);
    return;
  }
  for (const uid of uids) {
    const entry = map[uid] || {};
    const li = document.createElement("li");

    const color = document.createElement("input");
    color.type = "color";
    color.value = entry.color || "#ffd54f";
    color.addEventListener("input", () => {
      map[uid].color = color.value;
      save(map);
    });

    const name = document.createElement("span");
    name.className = "nick";
    name.textContent = entry.nick || uid;
    name.title = `${entry.nick || ""}\n${uid}`;

    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "×";
    del.title = "삭제";
    del.addEventListener("click", () => {
      delete map[uid];
      save(map);
      render(map);
    });

    li.append(color, name, del);
    listEl.appendChild(li);
  }
}

load(render);

// 채팅 우클릭/닉네임 갱신 등으로 바뀌면 팝업이 열려있을 때도 갱신
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === "local" && ch[STORE_KEY]) render(ch[STORE_KEY].newValue || {});
});
