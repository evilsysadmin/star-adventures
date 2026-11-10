#!/usr/bin/env python3
"""Original K-47 west-archive GLB candidate. No network or third-party assets.

This is a reproducible art study, not published R2 content. It is deliberately
one connected rear architectural silhouette, with a textured industrial facade,
rather than one box per grid cell. Generate bytes to stdout for the browser
preview; scene/collisions/fog remain authoritative in the game.
"""
import json
import math
import random
import struct
import sys
import zlib

rng = random.Random(470047)
PALETTE = [
    (106, 117, 111),  # poured concrete with carbon stains
    (40, 58, 65),     # dark structural steel
    (115, 93, 69),    # oxidised warm steel
    (40, 107, 113),   # blue photovoltaic glazing
    (177, 140, 83),   # bronze edging
    (84, 87, 82),     # dark foundation
    (58, 77, 78),     # battered roof metal
    (221, 170, 96),   # luminaire glass
    (125, 69, 49),    # rust
    (22, 38, 45),     # deep recessed channels
    (178, 184, 162),  # faded stencil
    (55, 94, 99),     # machinery panels
]
# Painted metal/roughness uses real embedded bitmap grain and abrasion, not
# a dozen flat-color procedural boxes. The texture is deterministic and CC-free.
TEX = 512
TILE = 128
pixels = bytearray()
for y in range(TEX):
    iy = min(3, y // TILE)
    row = bytearray()
    for x in range(TEX):
        ix = min(3, x // TILE)
        material = iy * 4 + ix
        base = PALETTE[material] if material < len(PALETTE) else PALETTE[0]
        noise = rng.randrange(-19, 20)
        scratch = (x * 17 + y * 97) % 149 in (0, 1)
        seam = x % TILE in (6, 7) or y % TILE in (9, 10)
        stain = ((x * 7 + y * 13) % 251 < 10)
        if material == 3:
            noise = rng.randrange(-8, 9)
            if y % TILE in (24, 25, 68, 69, 102): noise += 25
        if material == 7: noise = rng.randrange(-11, 12)
        if scratch: noise += 27 if material != 9 else 9
        if stain: noise -= 21
        if seam: noise -= 13
        row.extend(max(0, min(255, v + noise)) for v in base)
    pixels.extend(b"\x00" + row)

def chunk(tag, raw):
    return struct.pack(">I", len(raw)) + tag + raw + struct.pack(">I", zlib.crc32(tag + raw) & 0xffffffff)

png = b"\x89PNG\r\n\x1a\n"
png += chunk(b"IHDR", struct.pack(">IIBBBBB", TEX, TEX, 8, 2, 0, 0, 0))
png += chunk(b"IDAT", zlib.compress(pixels, 9))
png += chunk(b"IEND", b"")

# The canonical west archive slot occupies exactly x=0, z=3..5, y=[0,4.9].
# The model's rotated local bounds are x=[-.475,.475], z=[-1.4,1.4],
# y=[0,3.04]. A low rear hangar is preferable to the first 4.9-unit tower.
# The canvas renderer adds the world anchor [0,0,4].
# The authored base spans five world units along its *original* long axis.
# Rotate and proportionally fit it into three real blocked cells at x=0,
# z=3..5. It is now a backdrop behind the active landing yard, never a
# tall foreground wall between the player and the crew.
surfaces = {i: {"p": [], "n": [], "uv": []} for i in range(12)}

def west_space(vertex):
    x,y,z=vertex
    # Low archive/hangar profile: vertical engineering volumes must remain
    # clearly *behind* the landing party, not become a tower in the HUD.
    return (z*.95,y*.62,-x*.56)

def uv_for(mat):
    x, y = mat % 4, mat // 4
    # Inset the tile to avoid bleeding into the next texture family.
    u0, v0 = (x*TILE+5)/TEX, 1-(y*TILE+5)/TEX
    u1, v1 = ((x+1)*TILE-5)/TEX, 1-((y+1)*TILE-5)/TEX
    return ((u0,v0),(u1,v0),(u1,v1),(u0,v1))

def tri(mat, a, b, c, tex):
    a,b,c=west_space(a),west_space(b),west_space(c)
    cross = (
        (b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),
        (b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),
        (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),
    )
    mag = math.sqrt(sum(v*v for v in cross)) or 1
    n = [v/mag for v in cross]
    target = surfaces[mat]
    for vertex, uv in zip((a,b,c), tex):
        target["p"].extend(vertex)
        target["n"].extend(n)
        target["uv"].extend(uv)

def quad(mat, a, b, c, d):
    t = uv_for(mat)
    tri(mat,a,b,c,(t[0],t[1],t[2]))
    tri(mat,a,c,d,(t[0],t[2],t[3]))

def box(mat, x,y,z, w,h,d):
    if min(w,h,d) <= 0: raise ValueError("Invalid architecture element")
    x0,x1=x-w/2,x+w/2
    y0,y1=y-h/2,y+h/2
    z0,z1=z-d/2,z+d/2
    if not (-2.5<=x0<=x1<=2.5 and -.5<=z0<=z1<=.5 and 0<=y0<=y1<=4.9):
        raise ValueError("Candidate would breach south-wall footprint")
    quad(mat,(x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1))
    quad(mat,(x1,y0,z0),(x0,y0,z0),(x0,y1,z0),(x1,y1,z0))
    quad(mat,(x0,y0,z0),(x0,y0,z1),(x0,y1,z1),(x0,y1,z0))
    quad(mat,(x1,y0,z1),(x1,y0,z0),(x1,y1,z0),(x1,y1,z1))
    quad(mat,(x0,y1,z1),(x1,y1,z1),(x1,y1,z0),(x0,y1,z0))
    quad(mat,(x0,y0,z0),(x1,y0,z0),(x1,y0,z1),(x0,y0,z1))

def brace(mat, x0,y0,x1,y1,z,width=.045,depth=.04):
    dx,dy=x1-x0,y1-y0
    length=math.hypot(dx,dy)
    if length<=0:return
    px,py=-dy/length*width/2,dx/length*width/2
    a=(x0+px,y0+py,z);b=(x1+px,y1+py,z)
    c=(x1-px,y1-py,z);d=(x0-px,y0-py,z)
    quad(mat,a,b,c,d)
    quad(mat,(a[0],a[1],z-depth),(b[0],b[1],z-depth),
         (c[0],c[1],z-depth),(d[0],d[1],z-depth))

# Structural continuity: a single foundation and four differently raised
# engineering masses, not identical blocks repeated along grid squares.
box(5, 0,.12,0,4.96,.23,.96)
box(1, 0,.28,.02,4.90,.12,.84)
for x, width, height, shade in [
    (-1.71,1.45,2.52,0),(-.57,1.04,3.40,6),
    (.60,1.30,3.75,0),(1.83,1.14,2.84,2)]:
    box(shade,x,height/2+.22,-.09,width,height,.72)
    box(1,x,height+.22,-.08,width+.07,.11,.80)
    # Recessed roof and top parapet: a broader industrial silhouette.
    box(6,x,height+.35,-.11,width+.12,.12,.78)
    box(1,x,height+.48,-.41,width+.12,.20,.11)
    box(4,x,height+.44,.30,width+.11,.11,.10)
    # Vertical wall-channel ribs taper the facade by shadow and relief.
    for rx in (x-width*.43,x+width*.43):
        box(1,rx,height*.51+.22,.319,.075,height*.90,.095)
        box(4,rx,height*.68+.20,.387,.023,height*.46,.027)
    for wy in [v for v in (.86,1.50,2.13,2.79) if v < height-.24]:
        for wx in (x-width*.30,x,x+width*.30):
            if abs(wx)>2.32:continue
            box(9,wx,wy,.304,width*.215,.39,.027)
            box(3,wx,wy,.33,width*.187,.32,.023)
            # Heavy recessed horizontal and vertical window mullions.
            box(1,wx,wy,.352,.021,.35,.025)
            box(4,wx,wy-.183,.358,width*.20,.020,.026)
    # Actual rooftop plant volumes, low below the y<=4.9 envelope.
    if height < 3.65:
        box(1,x,height+.68,-.16,width*.35,.31,.41)
        for i in range(4):
            xx=x-width*.13+i*width*.086
            box(2,xx,height+.863,-.13,.033,.07,.43)

# Forward service apron of a sealed building, not an invented walkable exit.
for x in (-2.17,-1.35,-.60,.33,1.28,2.15):
    box(4,x,.37,.426,.055,.50,.07)
    box(9,x,.15,.43,.17,.10,.06)
    # Tall structural brackets join a single long industrial wall.
    brace(1,x-.15,.52,x+.16,1.12,.41,.07)
for y in (.41,.65):
    box(2,0,y,.428,4.74,.045,.060)
for x in (-1.15,.10,1.28):
    for y in (1.24,1.76):
        # Cable trunking and interlocking cross-plates add industrial scale.
        box(1,x,y,.426,.34,.105,.072)
        box(4,x,y,.471,.22,.017,.029)
        box(2,x,y,.475,.025,.13,.030)

# Architectural signature: a raised enclosed utility bridge, angled braces,
# segmented louvres and warning-painted gantry with no false interactive door.
box(1,.10,3.03,.355,2.40,.30,.25)
box(4,.10,3.24,.369,2.48,.045,.21)
for x in (-.99,-.52,-.05,.42,.89,1.12):
    brace(4,x,2.66,x+.21,3.06,.493,.048)
    box(9,x,2.62,.462,.24,.055,.045)
for x in (-1.89,1.78):
    brace(2,x-.21,1.10,x+.20,2.00,.44,.11)
    brace(1,x-.16,1.75,x+.18,1.20,.445,.07)

# Roof skyline, pipes, HVAC grilles and amber industrial fixtures.
for x,y in [(-1.92,2.89),(-.30,3.75),(.68,4.13),(1.9,3.20)]:
    box(1,x,y,-.11,.34,.31,.46)
    box(4,x,y+.17,-.11,.41,.045,.46)
    for i in range(6):
        box(9,x-.12+i*.048,y+.19,.12,.018,.014,.16)
for x,y in [(-2.28,1.85),(-.96,2.48),(.58,2.65),(2.28,1.90)]:
    box(9,x,y,.416,.21,.29,.06)
    box(7,x,y,.45,.12,.17,.035)
    box(4,x,y+.16,.45,.28,.028,.044)

# Small antenna/conduit cluster above the lower west block, never above 4.9.
for x,height in [(-1.98,.57),(-1.77,.38),(-1.53,.49)]:
    box(1,x,3.09+height/2,-.12,.035,height,.035)
    box(4,x,3.09+height,-.12,.11,.07,.11)
# Broken rust patches and panel fasteners avoid mathematically pristine skins.
for i in range(88):
    x=rng.uniform(-2.30,2.30)
    y=rng.uniform(.33,2.15)
    if -1.02 < x < -.04 and y>2.0:continue
    box(8,x,y,.460,rng.uniform(.018,.070),rng.uniform(.012,.095),.012)

data=bytearray()
views=[]
accessors=[]
def align():
    while len(data)%4:data.append(0)
def view(raw,target=None):
    align()
    offset=len(data);data.extend(raw)
    v={"buffer":0,"byteOffset":offset,"byteLength":len(raw)}
    if target:v["target"]=target
    views.append(v)
    return len(views)-1
def accessor(values,arity):
    if len(values)%arity:raise ValueError("Bad vertex attributes")
    packed=struct.pack("<"+"f"*len(values),*values)
    idx=view(packed,34962)
    mins=[min(values[j::arity]) for j in range(arity)]
    maxs=[max(values[j::arity]) for j in range(arity)]
    accessors.append({"bufferView":idx,"componentType":5126,"count":len(values)//arity,
                      "type":{2:"VEC2",3:"VEC3"}[arity],"min":mins,"max":maxs})
    return len(accessors)-1
primitives=[]
for mat,g in surfaces.items():
    if not g["p"]:continue
    primitives.append({"attributes":{"POSITION":accessor(g["p"],3),
                        "NORMAL":accessor(g["n"],3),
                        "TEXCOORD_0":accessor(g["uv"],2)},
                       "mode":4,"material":mat})
image_view=view(png)
materials=[]
for i in range(12):
    materials.append({
      "name":("Concrete","Structural-steel","Oxidised-shell","Industrial-glazing",
              "Brass-joints","Foundation","Roof","Amber-lamp","Rust","Recess",
              "Stencil","Machinery")[i],
      "doubleSided":True,
      "pbrMetallicRoughness":{"baseColorTexture":{"index":0},
        "metallicFactor":(.08 if i in (0,5,8) else .62),
        "roughnessFactor":(.35 if i in (3,7) else .84)},
      **({"emissiveFactor":[.16,.62,.63]} if i==3 else {}),
      **({"emissiveFactor":[1.0,.48,.15]} if i==7 else {}),
    })
scene={
 "asset":{"version":"2.0","generator":"ShadowOps original K-47 west industrial archive candidate"},
 "scene":0,"scenes":[{"nodes":[0]}],"nodes":[{"name":"K47-west-authored-industrial-archive","mesh":0}],
 "meshes":[{"name":"K47-west-connected-industrial-architecture","primitives":primitives}],
 "buffers":[{"byteLength":len(data)}],"bufferViews":views,"accessors":accessors,
 "images":[{"bufferView":image_view,"mimeType":"image/png"}],
 "samplers":[{"magFilter":9729,"minFilter":9729,"wrapS":33071,"wrapT":33071}],
 "textures":[{"sampler":0,"source":0}],
 "materials":materials,
}
raw=json.dumps(scene,separators=(",",":")).encode("utf-8")
json_chunk=raw+b" " * ((4-len(raw)%4)%4)
align()
bin_chunk=bytes(data)
total=12+8+len(json_chunk)+8+len(bin_chunk)
glb=(struct.pack("<III",0x46546c67,2,total)+
     struct.pack("<II",len(json_chunk),0x4e4f534a)+json_chunk+
     struct.pack("<II",len(bin_chunk),0x004e4942)+bin_chunk)
if not (32<=len(glb)<=4*1024*1024):
    raise SystemExit("Candidate exceeds strict 4 MiB budget")
print("K47_AUTHORED_CANDIDATE bytes=%d vertices=%d png=%d"%
      (len(glb),sum(len(g["p"])//3 for g in surfaces.values()),len(png)),
      file=sys.stderr)
sys.stdout.buffer.write(glb)
