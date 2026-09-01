from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/System/Library/Fonts/STHeiti Medium.ttc" if bold else "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/PingFang.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc" if bold else "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size=size)
    raise RuntimeError("No CJK font found")


w, h = 1200, 675
img = Image.new("RGB", (w, h), "#09131d")
d = ImageDraw.Draw(img)

for radius, alpha in [(430, 24), (340, 20), (250, 16)]:
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.ellipse((770 - radius, 337 - radius, 770 + radius, 337 + radius), outline=(104, 167, 163, alpha), width=2)
    img = Image.alpha_composite(img.convert("RGBA"), layer)
d = ImageDraw.Draw(img)

d.polygon([(810, 510), (1180, 510), (1135, 570), (855, 570)], fill="#050b11")
d.line((960, 180, 960, 510), fill="#8e7550", width=7)
d.polygon([(960, 215), (965, 455), (1120, 420)], fill="#233d43")
d.ellipse((1010, 105, 1084, 179), fill="#e9cc83")
d.rectangle((898, 278, 925, 505), fill="#192c31")
d.rectangle((905, 298, 919, 316), fill="#e1ae52")
d.polygon([(919, 298), (520, 342), (919, 316)], fill="#8f7a4640")

d.text((90, 72), "回响引擎  ECHOFORGE", font=font(25, bold=True), fill="#d8b16a")
d.text((90, 168), "别急着找答案。", font=font(72, bold=True), fill="#f2efe6")
d.text((90, 260), "先进去看看。", font=font(72, bold=True), fill="#e0b66a")
d.text((94, 382), "把困惑编译成一个由固定人格角色共同运行的世界", font=font(30), fill="#a8b5b4")
d.line((94, 448, 590, 448), fill="#5e746f", width=2)
d.text((94, 485), "结构化世界  ·  多 Agent 角色  ·  先状态，后叙事", font=font(23), fill="#829393")

img.convert("RGB").save("cover.png", quality=95)
