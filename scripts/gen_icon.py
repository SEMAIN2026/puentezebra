#!/usr/bin/env python3
"""Genera el icono de PuenteZebra (.ico multi-tamaño) y un PNG 256 para docs."""
from PIL import Image, ImageDraw
import os

SIZE = 256
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# --- fondo: placa redondeada con degradado simulado (dos tonos) ---
def rr(box, r, fill):
    d.rounded_rectangle(box, radius=r, fill=fill)

# placa base
rr((12, 12, 244, 244), 56, (28, 60, 96, 255))          # azul oscuro
rr((12, 12, 244, 128), 56, (38, 82, 130, 255))         # tono superior (efecto luz)
d.rectangle((12, 100, 244, 150), fill=(0, 0, 0, 0))    # no... recorte transparente no

# corregir: redibujar placa completa y franja superior
img2 = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
d2 = ImageDraw.Draw(img2)
d2.rounded_rectangle((12, 12, 244, 244), radius=56, fill=(30, 64, 102, 255))
# brillo superior
mask = Image.new("L", (SIZE, SIZE), 0)
dm = ImageDraw.Draw(mask)
dm.rounded_rectangle((12, 12, 244, 244), radius=56, fill=255)
grad = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
dg = ImageDraw.Draw(grad)
for y in range(SIZE):
    a = max(0, int(60 * (1 - y / SIZE)))
    dg.line([(12, y), (244, y)], fill=(120, 170, 220, a))
img2.paste(grad, (0, 0), mask)

d = ImageDraw.Draw(img2)

# --- papel saliendo arriba ---
d.rounded_rectangle((78, 30, 178, 96), radius=10, fill=(245, 247, 250, 255))
d.rectangle((94, 48, 162, 54), fill=(160, 175, 195, 255))
d.rectangle((94, 64, 150, 70), fill=(160, 175, 195, 255))

# --- cuerpo de impresora ---
d.rounded_rectangle((44, 96, 212, 190), radius=22, fill=(235, 240, 246, 255))
d.rounded_rectangle((44, 96, 212, 190), radius=22, outline=(90, 105, 125, 255), width=4)
# ranura de salida
d.rounded_rectangle((70, 160, 186, 178), radius=8, fill=(60, 74, 92, 255))
# luz de estado
d.ellipse((178, 110, 196, 128), fill=(64, 190, 96, 255))
d.ellipse((178, 110, 196, 128), outline=(30, 120, 60, 255), width=2)

# --- etiqueta saliendo abajo con "Z" ---
d.rounded_rectangle((88, 186, 168, 226), radius=8, fill=(255, 255, 255, 255))
d.rectangle((88, 186, 168, 226), outline=(120, 135, 155, 255), width=3)

# letra Z
try:
    from PIL import ImageFont
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 44)
except Exception:
    font = None
if font:
    bbox = d.textbbox((0, 0), "Z", font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text((128 - w / 2 - bbox[0], 204 - h / 2 - bbox[1]), "Z", font=font, fill=(30, 64, 102, 255))
else:
    d.line((108, 190, 148, 190), fill=(30, 64, 102, 255), width=8)
    d.line((148, 190, 108, 222), fill=(30, 64, 102, 255), width=8)
    d.line((108, 222, 148, 222), fill=(30, 64, 102, 255), width=8)

# --- flecha de conexión (puente) arriba a la derecha ---
d.pieslice((150, 34, 246, 130), 0, 360, fill=(0, 0, 0, 0))  # limpiar zona no necesaria

img2.save("/home/z/my-project/puentezebra/assets/icon.png")

img2.save(
    "/home/z/my-project/puentezebra/assets/icon.ico",
    format="ICO",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
print("icono generado OK")
