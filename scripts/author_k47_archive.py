#!/usr/bin/env python3
"""Original K-47 archive campus. Deterministic GLB; real footprint 0,3..5.

The significant volume projects WEST into out-of-world terrain (negative x).
The east facade must never reach a walkable tile. Reuses the South Industrial
PBR material authoring catalog to maintain consistent art direction.
No licensed art, no CDN requests, no binary files in Git.
"""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
import trimesh
from trimesh.visual.texture import TextureVisuals
from author_k47_south import Factory

ARCHIVE_BOUNDS=((-3.3,-.02,-1.56),(.56,5,1.56))

def design():
    b=Factory()
    # One broad stepped research archive, not a sequence of per-tile boxes.
    b.box('basalt',-1.50,.21,0,3.56,.42,2.92)
    b.box('rib',-1.48,.45,0,3.62,.085,2.96)
    b.box('shell',-1.45,1.70,0,3.47,2.48,2.73)
    b.box('rib',.303,1.54,0,.098,2.05,2.65)
    b.box('roof',-1.48,3.06,0,3.57,.28,2.90)
    b.box('rib',-1.48,3.25,0,3.55,.105,2.89)
    # Elevated pentagonal rooftop extension: substantial asymmetrical skyline.
    b.box('shell',-2.10,3.53,-.30,1.65,.48,1.25)
    b.box('roof',-2.10,3.88,-.30,1.74,.23,1.33)
    b.box('brass',.31,2.93,0,.12,.15,2.94)
    b.box('brass',-1.50,.48,1.44,3.54,.075,.065)
    b.box('brass',-1.50,.48,-1.44,3.54,.075,.065)
    # Long uninterrupted side facade toward the truly playable +x area.
    b.box('rubber',.37,1.55,0,.064,2.05,2.58)
    for z in [-1.13,-.56,0,.56,1.13]:
        b.box('rib',.410,1.59,z,.060,1.90,.045)
        b.box('panel',.423,1.66,z,.025,1.17,.34)
        b.box('rubber',.439,1.65,z,.013,.96,.255)
        b.box('glass',.450,1.70,z,.016,.84,.210)
        b.box('rib',.462,1.70,z,.013,.80,.019)
        b.box('brass',.439,1.04,z,.032,.065,.35)
        b.box('brass',.435,2.34,z,.038,.057,.36)
        b.box('orange',.442,2.55,z,.042,.09,.13)
        for height in (1.43,1.94):
            b.box('rib',.467,height,z,.018,.030,.238)
    # Sealed data-hatch decorative panel: actual archive interaction remains
    # sensor-vault mission object elsewhere; there is no invented doorway.
    b.box('rib',.40,.79,-.85,.075,.56,.41)
    b.box('panel',.441,.80,-.85,.025,.46,.30)
    b.box('glass',.459,.83,-.85,.018,.18,.18)
    # Continuous roof/parapets and narrow coping.
    for z in [-1.42,1.42]:
        b.box('rib',-1.46,3.35,z,3.50,.42,.09)
        b.box('brass',-1.46,3.57,z,3.54,.055,.10)
    for x in [-3.11,.22]:
        b.box('rib',x,3.34,0,.10,.43,2.84)
        b.box('brass',x,3.58,0,.12,.045,2.84)
    # Expressive industrial roof clusters; all are nonwalkable and outboard.
    for x,z in [(-2.83,-.90),(-2.23,.94),(-1.18,-.77)]:
        b.pipe('panel',x,3.83,z,.18,.81)
        b.pipe('brass',x,4.30,z,.25,.12)
        b.box('rib',x,3.95,z,.37,.035,.045)
    b.box('rib',-.95,3.50,.12,.96,.25,.65)
    b.box('panel',-.95,3.72,.12,.84,.20,.52)
    for x in np.linspace(-1.25,-.65,8):
        b.box('brass',float(x),3.84,.12,.025,.10,.48)
    b.box('rib',-2.18,4.02,.28,.72,.12,.49)
    b.box('glass',-2.18,4.105,.28,.64,.032,.40)
    # Deep side returns and repeated outer structural frames.
    for z in (-1.20,1.20):
        for x in (-2.78,-1.92,-1.06,-.20):
            b.box('rib',x,1.57,z, .13,2.05,.08)
            b.box('brass',x,1.55,z+(-.06 if z<0 else .06),.034,1.89,.021)
    for height in (.62,1.10,2.56,2.75):
        b.box('brass',.327,height,0,.075,.048,2.69)
    # Parallel cables run into the rear machinery (entirely unplayable).
    for height,r in [(1.08,.075),(2.76,.055)]:
        b.pipe('brass',-2.88,height,0,r,2.55,axis='z')
    for z in (-1.16,-.58,0,.58,1.16):
        b.brace('brass',(-3.0,.61,z-.11),(-2.63,1.54,z+.13))
    # Service navigation mast: a meaningful silhouette, not five noisy towers.
    b.pipe('rib',-2.75,4.15,.64,.065,.86)
    b.box('brass',-2.75,4.37,.64,.43,.04,.045)
    b.pipe('red',-2.75,4.59,.64,.095,.13)
    return b

def export_model(builder,out):
    scene=trimesh.Scene()
    for family,parts in builder.meshes.items():
        mesh=trimesh.util.concatenate(parts)
        mesh.vertices[:,1]*=.7  # source material kit scale contract
        x,y,z=mesh.vertices.T
        mesh.visual=TextureVisuals(
            uv=np.column_stack(((x*.39+z*.61)%1,(y*.33+z*.18)%1)),
            material=builder.materials[family])
        scene.add_geometry(mesh,geom_name='k47-archive-'+family,
                           node_name='k47-archive-'+family)
    low,high=scene.bounds
    if np.any(low<ARCHIVE_BOUNDS[0]) or np.any(high>ARCHIVE_BOUNDS[1]):
        raise ValueError('Archive GLB exceeds approved safe offworld bounds: '
                         +str(scene.bounds.tolist()))
    body=scene.export(file_type='glb')
    if not 32<len(body)<=4*1024*1024:
        raise ValueError('Original GLB exceeds 4 MiB byte budget')
    out=Path(out);out.parent.mkdir(parents=True,exist_ok=True)
    out.write_bytes(body)
    info={'id':'west-archive-shell','bytes':len(body),
          'sha256':hashlib.sha256(body).hexdigest(),
          'anchor':[0,0,4],'bounds':scene.bounds.tolist(),
          'materials':len(scene.geometry),'authored_elements':builder.elements,
          'license':'original','source':'Original K-47 archive PBR authoring script'}
    out.with_suffix('.json').write_text(json.dumps(info,indent=2)+'\n')
    print(json.dumps(info,indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('output')
    export_model(design(),parser.parse_args().output)
