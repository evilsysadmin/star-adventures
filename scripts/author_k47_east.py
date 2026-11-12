#!/usr/bin/env python3
"""Original K-47 3-bay east research/utilities block, kept inside blocked cells.

A rendered production candidate, NEVER committed as a binary or published.
Uses the same original shared PBR palette as the south and archive modules.
"""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
import trimesh
from trimesh.visual.texture import TextureVisuals
from author_k47_south import Factory

BOUND_LO=np.asarray([-.56,-.4,-1.56])
BOUND_HI=np.asarray([.56,5.0,1.56])

def design():
    b=Factory()
    # Single continuous occupied 1x3 engineering volume; doors are sealed.
    for kind,x,y,z,w,h,d in [
        ('basalt',0,.19,0,.94,.37,2.92),
        ('brass',0,.39,0,.96,.09,2.96),
        ('shell',0,1.38,0,.84,2.21,2.75),
        ('roof',0,2.64,0,.94,.23,2.87),
        ('rib',0,2.79,0,.92,.09,2.89),
        ('rubber',-.433,1.39,0,.033,1.91,2.64),
        ('rubber',.433,1.39,0,.033,1.91,2.64),
        ('brass',-.44,.52,0,.05,.07,2.78),
        ('brass',.44,.52,0,.05,.07,2.78),
        ('brass',-.44,2.45,0,.045,.07,2.79),
        ('brass',.44,2.45,0,.045,.07,2.79),
    ]: b.box(kind,x,y,z,w,h,d)
    # Real inset glazing on BOTH lateral facades. Deeper parapets,
    # a working-height support rhythm and restrained warm task lamps.
    for side in (-1,1):
        xx=side*.448
        for z in [-1.16,-.58,0,.58,1.16]:
            b.box('panel',side*.443,1.55,z,.037,1.17,.42)
            b.box('glass',side*.470,1.53,z,.014,.95,.30)
            for y in (1.22,1.64,1.99):
                b.box('rib',side*.482,y,z,.027,.034,.36)
            b.box('brass',side*.479,1.48,z,.022,.97,.027)
            b.box('brass',side*.477,1.01,z,.026,.05,.44)
            b.box('orange',side*.469,2.38,z,.035,.095,.18)
        for z in [-1.42,-.86,-.28,.28,.86,1.42]:
            b.box('rib',side*.459,1.39,z,.065,2.04,.065)
        for y in [.57,2.40]:
            b.box('brass',xx,y,0,.055,.05,2.83)
    # South/north ends are engineering caps, never fake traversable doors.
    for z in [-1.43,1.43]:
        b.box('rubber',0,1.43,z,.78,1.9,.028)
        b.box('panel',0,1.45,z+(-.018 if z<0 else .018),.60,1.18,.026)
        for x in [-.29,0,.29]:
            b.box('rib',x,1.47,z,.055,1.94,.065)
        for y in [.57,2.39]:
            b.box('brass',0,y,z,.86,.045,.07)
    # Asymmetric non-traversable roof utility array: vents, pipes, sensors.
    b.box('rib',0,2.88,-.60,.59,.18,.59)
    b.box('panel',0,3.06,-.60,.48,.20,.48)
    for z in [-.83,-.68,-.53,-.38]:
        b.box('brass',0,3.17,z,.51,.035,.026)
    for z in [-.98,.27,.99]:
        b.pipe('panel',0,3.12,z,.155,.65)
        b.pipe('brass',0,3.52,z,.22,.11)
        b.box('rib',0,3.24,z,.32,.38,.04)
    for z in [-1.16,-.38,.42,1.14]:
        b.box('rib',0,2.89,z,.65,.08,.055)
        b.box('brass',0,2.94,z,.55,.048,.05)
    # Tall antenna gives the science wing its own distinctive silhouette.
    b.pipe('rib',0,3.48,.66,.057,1.19)
    b.box('brass',0,3.80,.66,.72,.06,.04)
    b.box('white',0,3.99,.66,.45,.07,.07)
    b.pipe('red',0,4.12,.66,.095,.14)
    return b

def export(builder,out):
    scene=trimesh.Scene()
    for family,parts in builder.meshes.items():
        mesh=trimesh.util.concatenate(parts)
        mesh.vertices[:,1]*=.70
        x,y,z=mesh.vertices.T
        mesh.visual=TextureVisuals(
            uv=np.column_stack(((x*.39+z*.61)%1,(y*.33+z*.18)%1)),
            material=builder.materials[family])
        scene.add_geometry(mesh,geom_name='k47-east-'+family,node_name='k47-east-'+family)
    low,high=scene.bounds
    if np.any(low<BOUND_LO) or np.any(high>BOUND_HI):
        raise ValueError('East building leaks outside genuine blocked footprint: '+str(scene.bounds.tolist()))
    payload=scene.export(file_type='glb')
    if not 32<len(payload)<=4*1024*1024:
        raise ValueError('GLB candidate outside size budget')
    out=Path(out);out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(payload)
    meta={'id':'east-utilities-shell','anchor':[8,0,2],
        'bytes':len(payload),'sha256':hashlib.sha256(payload).hexdigest(),
        'bounds':scene.bounds.tolist(),'materials':len(scene.geometry),
        'authored_elements':builder.elements,
        'license':'original','source':'Original ShadowOps K-47 east scientific utilities module'}
    out.with_suffix('.json').write_text(json.dumps(meta,indent=2)+'\n')
    print(json.dumps(meta,indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('output')
    export(design(),p.parse_args().output)
