# Costruisce una STL binaria della stazza segnalata (~130 MB, cioe' circa
# 2,6 milioni di triangoli) per riprodurre il rallentamento.
import struct, math, sys

# sfera a bande: righe x colonne, 2 triangoli per cella
righe = 1150
colonne = 1150
tris = righe * colonne * 2
print("triangoli:", tris, "-> MB stimati:", round((84 + tris * 50) / 1e6, 1))

def punto(i, j):
    fi = math.pi * i / righe
    th = 2 * math.pi * j / colonne
    r = 50.0 + 6.0 * math.sin(8 * fi) * math.cos(8 * th)   # superficie mossa
    return (r * math.sin(fi) * math.cos(th), r * math.sin(fi) * math.sin(th), r * math.cos(fi))

out = open(sys.argv[1], "wb")
out.write(b"\0" * 80)
out.write(struct.pack("<I", tris))
buf = bytearray()
for i in range(righe):
    for j in range(colonne):
        a = punto(i, j); b = punto(i + 1, j); c = punto(i + 1, j + 1); d = punto(i, j + 1)
        for t in ((a, b, c), (a, c, d)):
            ux, uy, uz = (t[1][k] - t[0][k] for k in range(3))
            vx, vy, vz = (t[2][k] - t[0][k] for k in range(3))
            nx, ny, nz = uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx
            L = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
            buf += struct.pack("<12fH", nx / L, ny / L, nz / L,
                               *t[0], *t[1], *t[2], 0)
    if len(buf) > 8 << 20:
        out.write(buf); buf = bytearray()
out.write(buf)
out.close()
print("fatto")
