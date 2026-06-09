"""치지직 채팅 하이라이터 아이콘 생성 (assets/icon{16,32,48,128}.png).
다크 라운드 배경 + 치지직 그린 말풍선 + 노란 하이라이트 줄."""
import os
from PIL import Image, ImageDraw

BG = (24, 24, 27, 255)        # #18181b
GREEN = (0, 255, 163, 255)    # #00ffa3 치지직 그린
YELLOW = (255, 213, 79, 255)  # #ffd54f 하이라이트
GREY = (90, 92, 100, 255)     # 일반 채팅 줄

SS = 8  # 슈퍼샘플 배율
OUT = os.path.join(os.path.dirname(__file__), "assets")
os.makedirs(OUT, exist_ok=True)


def draw(size):
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 라운드 배경
    r = int(S * 0.22)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=r, fill=BG)

    # 말풍선
    pad = int(S * 0.16)
    bx0, by0 = pad, int(S * 0.18)
    bx1, by1 = S - pad, int(S * 0.70)
    br = int(S * 0.12)
    bw = max(2, int(S * 0.045))  # 외곽선 두께
    d.rounded_rectangle([bx0, by0, bx1, by1], radius=br, outline=GREEN, width=bw)

    # 말풍선 꼬리
    tx = bx0 + int((bx1 - bx0) * 0.30)
    ty = by1 - 1
    tw = int(S * 0.09)
    th = int(S * 0.12)
    d.polygon([(tx, ty - bw), (tx + tw, ty - bw), (tx, ty + th)], fill=GREEN)
    # 꼬리 안쪽을 배경색으로 덮어 외곽선처럼 보이게(단순화: 채워진 삼각형 유지)

    # 채팅 줄 3개 — 가운데 줄은 노랑 하이라이트 바 위에 얹음
    lx0 = bx0 + int((bx1 - bx0) * 0.16)
    lx1 = bx1 - int((bx1 - bx0) * 0.16)
    lh = max(2, int(S * 0.05))
    rows_y = [by0 + int((by1 - by0) * f) for f in (0.30, 0.52, 0.74)]

    # 가운데 하이라이트 바
    hy = rows_y[1]
    hpad = int(S * 0.025)
    d.rounded_rectangle(
        [lx0 - hpad, hy - lh, lx1 + hpad, hy + lh * 2 + hpad],
        radius=int(lh), fill=YELLOW,
    )

    line_colors = [GREY, BG, GREY]  # 가운데 줄은 노랑 위라서 어둡게
    line_w = [0.62, 0.80, 0.46]
    for y, col, w in zip(rows_y, line_colors, line_w):
        d.rounded_rectangle(
            [lx0, y, lx0 + int((lx1 - lx0) * w), y + lh],
            radius=int(lh / 2), fill=col,
        )

    return img.resize((size, size), Image.LANCZOS)


for s in (16, 32, 48, 128):
    draw(s).save(os.path.join(OUT, f"icon{s}.png"))
    print("wrote", f"assets/icon{s}.png")
