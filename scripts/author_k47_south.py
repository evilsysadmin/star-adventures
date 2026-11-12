#!/usr/bin/env python3
"""Build the original K-47 industrial hangar from authored parametric geometry.

This source is the master. Output is a self-contained GLB in the existing
south-industrial-shell footprint (anchor [5,0,7]). No CDN or Git binary writes.
Requires pinned trimesh, Pillow and numpy.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

SEEDS={"shell":1147,"roof":9042,"basalt":2121,"panel":8882}

def material_map(kind):
    rng=np.random.default_rng(SEEDS[kind])
    def noise(n):
        low=(rng.random((n,n))*255).astype("uint8")
        return np.asarray(Image.fromarray(low,"L").resize(
            (256,256),Image.Resampling.BICUBIC),dtype=float)/255-.5
    small,broad=noise(32),noise(8)
    speckle=rng.normal(0,1,(256,256))
    x,y=np.meshgrid(np.arange(256),np.arange(256))
    grain=small*32+broad*29+speckle*8+3*np.sin(x*.14+y*.02)
    base={"shell":[139,145,131],"roof":[152,164,155],
          "basalt":[75,72,71],"panel":[85,104,109]}[kind]
    rust=np.maximum(0,-broad-.12)*30 if kind in ("shell","roof") \
         else np.zeros((256,256))
    pix=np.uint8(np.clip(np.asarray(base)+grain[...,None]+
         rust[...,None]*np.asarray([.93,.34,.11]),0,255))
    img=Image.fromarray(pix,"RGB")
    pen=ImageDraw.Draw(img,"RGBA")
    for i in range(160):
        px=int(rng.integers(0,256));py=int(rng.integers(0,256))
        pen.line((px,py,min(255,px+int(rng.integers(4,35))),py),
                 fill=(20,28,29,30) if i%4 else (218,191,151,24),width=1)
    return img

class Factory:
    def __init__(self):
        self.meshes={}
        self.materials={}
        self.elements=0
        for name in SEEDS:
            self.materials[name]=PBRMaterial(
               name="original-k47-"+name,baseColorTexture=material_map(name),
               metallicFactor=.04 if name=="basalt" else .33,roughnessFactor=.86)
        materials={
          "brass":([190,157,107,255],.75,.49,[0,0,0]),
          "rib":([53,71,79,255],.64,.70,[0,0,0]),
          "rubber":([19,35,39,255],.15,.92,[0,0,0]),
          "glass":([72,159,171,255],.17,.34,[.07,.24,.34]),
          "orange":([245,175,95,255],.04,.40,[1,.44,.12]),
          "red":([238,76,41,255],.04,.43,[.85,.08,.01]),
          "white":([187,203,184,255],.51,.57,[0,0,0]),
        }
        for name,(rgba,metal,roughness,emit) in materials.items():
            self.materials[name]=PBRMaterial(
                name="original-k47-"+name,baseColorFactor=rgba,
                metallicFactor=metal,roughnessFactor=roughness,
                emissiveFactor=emit)
    def add(self,kind,mesh):
        self.meshes.setdefault(kind,[]).append(mesh)
        self.elements+=1
    def box(self,kind,x,y,z,w,h,d):
        mesh=trimesh.creation.box(extents=(w,h,d))
        mesh.apply_translation((x,y,z))
        self.add(kind,mesh)
    def pipe(self,kind,x,y,z,r,height,axis="y"):
        mesh=trimesh.creation.cylinder(radius=r,height=height,sections=16)
        if axis=="y":
            mesh.apply_transform(trimesh.transformations.rotation_matrix(
                math.pi/2,[1,0,0]))
        if axis=="x":
            mesh.apply_transform(trimesh.transformations.rotation_matrix(
                math.pi/2,[0,1,0]))
        mesh.apply_translation((x,y,z))
        self.add(kind,mesh)
    def brace(self,kind,a,b):
        self.add(kind,trimesh.creation.cylinder(
            radius=.032,segment=np.asarray([a,b]),sections=10))
    def wedge(self,kind,points):
        self.add(kind,trimesh.Trimesh(vertices=points,
             faces=[[0,2,1],[3,4,5],[0,1,4],[0,4,3],
                    [1,2,5],[1,5,4],[2,0,3],[2,3,5]],process=False))
    def industrial_sawtooth_roof(self,x0,x1,z_half,low,rise,bays=3):
        """One physically sloped roof per bay and glazed clerestory at each crest.

        World-space dimensions are in the canonical factory pre-export units.
        Each roof covers the already blocked wall strip, never the playable
        yard. The mesh is built as actual large facets instead of box stacks.
        """
        width=(x1-x0)/bays
        for k in range(bays):
            left=x0+k*width+.016
            right=x0+(k+1)*width-.018
            upper=low+rise*(.9 if k==1 else 1.)
            vertices=np.asarray([
                [left,low,-z_half], [left,low,z_half],
                [right,upper,-z_half], [right,upper,z_half]
            ],dtype=float)
            roof=trimesh.Trimesh(vertices=vertices,
                                 faces=[[0,1,2],[1,3,2]],process=False)
            self.add("roof",roof)
            # Raised glazing makes each repeating sawtooth a functional
            # clerestory, rather than a tiny seam in a flat roof.
            crest=(upper+low)/2
            self.box("rubber",right-.018,crest,0,.032,upper-low-.07,
                     z_half*1.80)
            self.box("glass",right+.006,crest,0,.018,upper-low-.13,
                     z_half*1.54)
            self.box("brass",right+.02,upper+.004,0,.036,.055,z_half*2)
            self.box("rib",left+.014,low+.015,0,.052,.075,z_half*2)
            for side in (-1,1):
                self.brace("rib",(left,low,side*z_half),
                           (right,upper,side*z_half))
            # Two broad perpendicular braces, visible at ordinary zoom.
            for z in (-z_half*.58,z_half*.58):
                self.brace("brass",(left,low+.028,z),
                           (right,upper+.028,z))

    def build(self,path):
        scene=trimesh.Scene()
        for name,parts in self.meshes.items():
            mesh=trimesh.util.concatenate(parts)
            # Deliberately cut the roof projection back near gameplay actors;
            # overhead mass must not swallow the entire playable courtyard.
            mesh.vertices[:,1]*=.70
            x,y,z=mesh.vertices.T
            mesh.visual=TextureVisuals(
                uv=np.column_stack(((x*.39+z*.61)%1,(y*.33+z*.18)%1)),
                material=self.materials[name])
            scene.add_geometry(mesh,geom_name="k47-"+name,node_name="k47-"+name)
        low,high=scene.bounds
        if np.any(low<[-2.56,-.02,-.56]) or np.any(high>[2.56,4.95,.56]):
            raise ValueError("Model extends beyond real blocked wall cells")
        payload=scene.export(file_type="glb")
        if not 32<len(payload)<=4*1024*1024:
            raise ValueError("Model exceeds GLB asset budget")
        path=Path(path)
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_bytes(payload)
        info={"id":"south-industrial-shell","bytes":len(payload),
              "sha256":hashlib.sha256(payload).hexdigest(),
              "anchor":[5,0,7],"bounds":scene.bounds.tolist(),
              "materials":len(scene.geometry),"authored_elements":self.elements,
              "license":"original",
              "source":"ShadowOps original K-47 industrial asset authoring script"}
        path.with_suffix(".json").write_text(json.dumps(info,indent=2)+"\n")
        print(json.dumps(info,indent=2))

def design():
    b=Factory()
    # Connected 5x1 industrial frontage, not five separate cardboard cubes.
    for kind,values in [
        ("basalt",(0,.17,0,4.88,.34,.92)),
        ("rib",(0,.34,.23,4.91,.095,.29)),
        ("shell",(0,1.22,0,4.72,1.79,.76)),
        ("shell",(0,2.31,-.06,2.48,.47,.64)),
        ("rib",(0,1.11,-.407,4.7,1.60,.065)),
        ("rubber",(0,1.03,.401,4.50,1.11,.055))]:
        b.box(kind,*values)
    # Full-length original sawtooth industrial roof, with physically
    # pitched metal sheets and large clerestory lights across ALL five
    # blocked frontage cells. No new route, door or playable platform.
    b.industrial_sawtooth_roof(-2.38,2.38,.42,2.58,.57,bays=3)
    b.box("brass",0,2.26,.449,4.93,.12,.08)
    b.box("rib",0,2.42,-.449,4.8,.075,.07)
    for x,w,glazed in [(-1.69,.90,False),(-.55,.72,True),
                       (.43,.70,True),(1.53,.95,False)]:
        b.box("rubber",x,1.12,.439,w,1.10,.026)
        b.box("glass" if glazed else "panel",x,1.16,.459,w-.13,.83,.015)
        for side in [-1,1]:
            b.box("brass",x+side*(w/2-.055),1.12,.472,.065,1.12,.036)
        b.box("rib",x,1.74,.478,w+.08,.075,.051)
        b.box("brass",x,.57,.481,w+.09,.06,.04)
        b.box("orange",x,1.82,.482,.24,.08,.026)
        if glazed:
            for y in [.91,1.27]:
                b.box("rib",x,y,.479,w-.13,.036,.026)
        else:
            for k in range(7):
                b.box("rib",x,.78+k*.12,.477,w-.15,.028,.018)
    for x in [-2.24,-1.10,0,1.06,2.26]:
        b.box("rib",x,1.24,.429,.135,1.84,.11)
        b.box("brass",x,1.25,.491,.032,1.75,.016)
        b.box("brass",x,.36,.43,.31,.15,.12)
    for y in [.46,1.98,2.12]:
        b.box("brass",0,y,.448,4.66,.04,.075)
    for x in [-2.27,2.27]:
        b.box("orange",x,1.8,.445,.09,.20,.08)
    # Machinery cluster and utility stacks form a deliberate roof silhouette.
    for x,z,r in [(-1.84,-.12,.19),(-1.43,.13,.17),(1.50,-.05,.22)]:
        b.pipe("panel",x,3.05,z,r,.91)
        b.pipe("brass",x,3.58,z,r*1.38,.16)
        b.box("rib",x,3.12,z,.04,.61,.36)
        b.box("rib",x,3.12,z,.36,.61,.04)
    b.box("rib",.24,3.07,-.04,1.12,.26,.57)
    b.box("panel",.24,3.30,-.04,.87,.25,.43)
    for x in np.linspace(-.10,.58,6):
        b.box("brass",x,3.46,-.03,.035,.11,.39)
    for y,r in [(.71,.075),(2.04,.055)]:
        b.pipe("brass",0,y,-.427,r,4.57,axis="x")
    for x in [-2.13,-.86,.97,2.15]:
        b.brace("brass",(x-.24,.41,.448),(x+.21,1.63,.448))
    b.pipe("rib",1.93,3.10,-.12,.060,2.18)
    for y in [3.65,3.94]:
        b.box("white",1.93,y,-.12,.44,.038,.052)
    b.pipe("red",1.93,4.38,-.12,.10,.16)
    for x in [-2.18,-.69,.72,2.13]:
        b.box("rib",x,2.57,.13,.32,.15,.28)
        b.box("brass",x,2.68,.13,.38,.065,.35)
    for x in [-2.29,2.29]:
        for y in [.42,1.14,1.86,2.43]:
            b.box("white",x,y,.472,.055,.055,.016)
    return b

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("output")
    design().build(parser.parse_args().output)
