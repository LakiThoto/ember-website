"""
Ember · 3D scene for the site (Blender 4.5, run headless):

  Blender -b --factory-startup -P ember_scene.py -- mode=ember|bike|close|all out=DIR samples=96

  ember   Ember v2 on its own, front view, transparent      -> ember-front.png + ember-front.json
  bike    a VanMoof-style e-bike, side view, studio light   -> bike-full.png   + bike.json
  close   the same camera, zoomed on the down tube           -> bike-close.png  (in bike.json)

Ember v2: 105 x 35 x 15 mm as the current CAD, with a larger plan radius and soft
front/back edges in the direction of a remote control (Apple-like softness), but its
own proportions. NOTE: not checked against any patent; Avennex has to verify the
final housing (radius, size) against the patent before it is used.
The bike is a generic design in the VanMoof idiom (straight top tube that runs on past
the seat tube, thick down tube with the battery, matte dark grey); no brand marks.
Units: metres. X along the bike (rear -> front), Z up, the camera looks along +Y.
"""
import bpy, bmesh, math, json, os, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ARGS = dict(a.split('=', 1) for a in argv)
OUT = ARGS.get('out', os.path.join(os.path.dirname(__file__), 'out'))
MODE = ARGS.get('mode', 'all')
SAMPLES = int(ARGS.get('samples', 96))
os.makedirs(OUT, exist_ok=True)
WORLD_TOP = float(ARGS.get('world', 0.4))      # v36: 0.8 -> 0.4, the lights shape the form now
MARK_SVG = os.path.join(os.path.dirname(__file__), '..', 'assets', 'img', 'avennex-mark.svg')

# ------------------------------------------------------------------ scene
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type = 'METAL'; prefs.get_devices()
        for d in prefs.devices: d.use = (d.type == 'METAL')
        try: prefs.kernel_optimization_level = 'OFF'     # specialised Metal kernels crash in background mode (4.5.4)
        except Exception: pass
        sc.cycles.device = 'GPU'
    except Exception as e:
        print('GPU not available, CPU render:', e)
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    try: sc.cycles.denoising_quality = 'HIGH'; sc.cycles.denoising_prefilter = 'ACCURATE'
    except Exception: pass
    sc.cycles.filter_width = float(ARGS.get('filter', 1.0))      # v36: crisper than the default 1.5 px
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.exposure = float(ARGS.get('exposure', 0))
    try: sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception: pass
    # a studio sweep that only shows in reflections: light above, dark below (film is transparent)
    w = bpy.data.worlds.new('studio'); sc.world = w; w.use_nodes = True; nt = w.node_tree
    bg = nt.nodes['Background']
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); mr = nt.nodes.new('ShaderNodeMapRange'); ramp = nt.nodes.new('ShaderNodeValToRGB')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0]); nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
    mr.inputs['From Min'].default_value = -1.0; mr.inputs['From Max'].default_value = 1.0
    nt.links.new(mr.outputs['Result'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    els = ramp.color_ramp.elements
    els[0].position = 0.0; els[0].color = (0.0, 0.0, 0.0, 1)
    els[1].position = 1.0; els[1].color = (WORLD_TOP, WORLD_TOP, WORLD_TOP * 1.03, 1)
    e = els.new(0.5); e.color = (0.012, 0.012, 0.013, 1)
    e = els.new(0.72); e.color = (0.12, 0.12, 0.125, 1)
    bg.inputs['Strength'].default_value = 1.0
    return sc

def material(name, color, metal=0.0, rough=0.5, coat=0.0, emit=None, strength=0.0, aniso=0.0, transmission=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if coat: b.inputs['Coat Weight'].default_value = coat
    if aniso: b.inputs['Anisotropic'].default_value = aniso
    if transmission: b.inputs['Transmission Weight'].default_value = transmission
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m

def finish(o, mat=None, smooth=True):
    if mat: o.data.materials.append(mat)
    if smooth and o.type == 'MESH':
        for p in o.data.polygons: p.use_smooth = True
    return o

def beam(name, a, b, w, h, mat, y=0.0, bevel=0.45, segs=8):
    """A tube with a rounded-rectangle section from a to b (in the XZ plane), w across (Y), h high."""
    a, b = Vector(a), Vector(b); d = b - a
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object; o.name = name
    o.scale = (d.length, w, h); bpy.ops.object.transform_apply(scale=True)
    o.rotation_euler = (0, -math.atan2(d.z, d.x), 0)
    o.location = (a + b) / 2 + Vector((0, y, 0))
    m = o.modifiers.new('round', 'BEVEL'); m.width = min(w, h) * bevel; m.segments = segs; m.limit_method = 'ANGLE'; m.harden_normals = False
    return finish(o, mat)

def tube(name, a, b, r, mat, verts=24):
    a, b = Vector(a), Vector(b); d = b - a
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d.length, vertices=verts)
    o = bpy.context.active_object; o.name = name
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    o.location = (a + b) / 2
    return finish(o, mat)

def disc(name, centre, r, depth, mat, verts=64):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts, location=centre, rotation=(math.pi / 2, 0, 0))
    o = bpy.context.active_object; o.name = name
    return finish(o, mat)

def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join(); o = bpy.context.active_object; o.name = name
    return o

def area(name, loc, target, size, energy, color=(1, 1, 1)):
    bpy.ops.object.light_add(type='AREA', location=loc)
    l = bpy.context.active_object; l.name = name
    l.data.size = size; l.data.energy = energy; l.data.color = color
    d = Vector(target) - Vector(loc)
    l.rotation_mode = 'QUATERNION'; l.rotation_quaternion = Vector((0, 0, -1)).rotation_difference(d.normalized())
    return l

def ortho_camera(name, centre, width, res):
    bpy.ops.object.camera_add(location=(centre[0], -6.0, centre[1]), rotation=(math.pi / 2, 0, 0))
    c = bpy.context.active_object; c.name = name
    c.data.type = 'ORTHO'; c.data.ortho_scale = width
    sc = bpy.context.scene; sc.camera = c
    sc.render.resolution_x, sc.render.resolution_y = res; sc.render.resolution_percentage = 100
    return c

def frame_info(cam):
    sc = bpy.context.scene; W, H = sc.render.resolution_x, sc.render.resolution_y
    ow = cam.data.ortho_scale if W >= H else cam.data.ortho_scale * W / H
    return {'cx': cam.location.x, 'cz': cam.location.z, 'w_m': ow, 'h_m': ow * H / W, 'W': W, 'H': H, 'px_per_m': W / ow}

def to_px(info, x, z):
    return [(x - info['cx']) / info['w_m'] * info['W'] + info['W'] / 2, -(z - info['cz']) / info['h_m'] * info['H'] + info['H'] / 2]

# ------------------------------------------------------------------ Ember v2
def button_cap():
    """v36: spun aluminium, as on the team's render: radial brushing (an anisotropic tangent around the
    disc's axis plus fine concentric rings as bump), no grain."""
    m = bpy.data.materials.new('ember-button'); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.80, 0.81, 0.83, 1)
    b.inputs['Metallic'].default_value = 1.0; b.inputs['Roughness'].default_value = float(ARGS.get('btn_rough', 0.24))
    b.inputs['Anisotropic'].default_value = float(ARGS.get('aniso', 0.25))
    tg = nt.nodes.new('ShaderNodeTangent'); tg.direction_type = 'RADIAL'; tg.axis = 'Z'
    nt.links.new(tg.outputs['Tangent'], b.inputs['Tangent'])
    tc = nt.nodes.new('ShaderNodeTexCoord')
    # a shallow dome, as a normal only (the cap stays flat): the light runs over it as a soft gradient
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1 / (EMBER['button_r'] * MM),) * 3
    sph = nt.nodes.new('ShaderNodeTexGradient'); sph.gradient_type = 'SPHERICAL'
    dome = nt.nodes.new('ShaderNodeBump'); dome.inputs['Strength'].default_value = float(ARGS.get('dome', 0.5)); dome.inputs['Distance'].default_value = 0.0012
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], sph.inputs['Vector']); nt.links.new(sph.outputs['Fac'], dome.inputs['Height'])
    # fine concentric rings: the spun finish, visible only up close
    wv = nt.nodes.new('ShaderNodeTexWave'); bump = nt.nodes.new('ShaderNodeBump')
    wv.wave_type = 'RINGS'; wv.rings_direction = 'Z'; wv.inputs['Scale'].default_value = 2600.0; wv.inputs['Distortion'].default_value = 0.6
    wv.inputs['Detail'].default_value = 2.0
    nt.links.new(tc.outputs['Object'], wv.inputs['Vector']); nt.links.new(wv.outputs['Fac'], bump.inputs['Height'])
    bump.inputs['Strength'].default_value = 0.025; bump.inputs['Distance'].default_value = 0.0001
    nt.links.new(dome.outputs['Normal'], bump.inputs['Normal']); nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m

def anodized(name, color, rough):
    """v40: bead-blasted anodized aluminium, as Apple's (the Siri Remote, a MacBook in space grey): a metal, no clear coat;
    a very fine noise, far below a pixel, in the roughness and as a faint bump, so the surface has the soft sheen of the
    blasted metal and no grain you can read as a texture."""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Metallic'].default_value = 1.0
    tc = nt.nodes.new('ShaderNodeTexCoord'); nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 9000.0; nz.inputs['Detail'].default_value = 2.0
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = rough - 0.05; mr.inputs['To Max'].default_value = rough + 0.05
    nt.links.new(nz.outputs['Fac'], mr.inputs['Value']); nt.links.new(mr.outputs['Result'], b.inputs['Roughness'])
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = float(ARGS.get('blast', 0.05)); bump.inputs['Distance'].default_value = 0.00002
    nt.links.new(nz.outputs['Fac'], bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m

MM = 0.001
EMBER = {'w': 35, 'h': 105, 'd': 15, 'plan_r': 12.5, 'edge': 4.2, 'button_z': 22.4, 'button_r': 7.6, 'ring_r': 10.6, 'dot_r': 1.0, 'mark_z': -37.0, 'mark_w': 9.5,
         'ir_z': 32.5, 'ir_dx': 5.5, 'ir_r': 2.2, 'air_z': -40.0, 'air_w': 9.0, 'air_h': 1.6}   # v12: the sensors on the back (2 cm under the top), the air slot

def rounded_rect(w, h, r, n=18):
    pts = []
    for cx, cz, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n); pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts

def build_ember(name='Ember', origin=(0, 0, 0), up_angle=0.0, face_y=0.0):
    """Builds the device with its front face at y = face_y - depth, facing -Y. up_angle rotates it in the XZ plane."""
    E = EMBER
    # v12: a satin dark grey (a soft-touch coat over a dark base, as on the team's render), not bare metal
    # v36: smooth satin (no grain: the team's render reads as leather), a thin clear coat for crisp edges
    if ARGS.get('finish', 'alu') == 'alu':
        # v40: anodized aluminium in space grey, bead-blasted (the satin coat of v36 read as plastic)
        g = float(ARGS.get('grey', 0.06))      # v41: the dark grey of the earlier hardware (0.11 in v40 read too light)
        body_m = anodized('ember-body', (g, g * 1.02, g * 1.08), float(ARGS.get('body_rough', 0.4)))
    else:
        body_m = material('ember-body', (0.034, 0.035, 0.038), metal=0.0, rough=float(ARGS.get('body_rough', 0.46)), coat=0.45)
        body_m.node_tree.nodes['Principled BSDF'].inputs['Coat Roughness'].default_value = float(ARGS.get('coat_rough', 0.14))
    gap_m = material('ember-gap', (0.004, 0.004, 0.005), rough=0.75)
    dot_m = material('ember-dot', (0.27, 0.28, 0.30), rough=0.36, coat=0.4)        # the light points: frosted windows, light grey when off
    if ARGS.get('finish', 'alu') == 'alu':
        dot_m = material('ember-dot', (0.19, 0.2, 0.21), rough=0.55, coat=0.25)     # v40: frosted glass in the metal, a step lighter, matt
    mark_m = material('ember-mark', (0.3, 0.31, 0.33), metal=0.6, rough=0.45)
    ir_m = material('ember-ir', (0.02, 0.02, 0.025), rough=0.12, coat=1.0)         # the infrared windows: dark glass
    ir_m.node_tree.nodes['Principled BSDF'].inputs['Coat Roughness'].default_value = 0.05
    air_m = material('ember-air', (0.02, 0.02, 0.022), rough=0.7)
    bm = bmesh.new()
    verts = [bm.verts.new((x * MM, 0, z * MM)) for x, z in rounded_rect(E['w'], E['h'], E['plan_r'])]
    f = bm.faces.new(verts)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [g for g in ext['geom'] if isinstance(g, bmesh.types.BMVert)]: v.co.y -= E['d'] * MM
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name + '-body'); bm.to_mesh(me); bm.free()
    body = bpy.data.objects.new(name + '-body', me); bpy.context.collection.objects.link(body)
    bev = body.modifiers.new('soft', 'BEVEL'); bev.width = E['edge'] * MM; bev.segments = 16; bev.limit_method = 'ANGLE'; bev.angle_limit = math.radians(60); bev.profile = 0.6
    body.modifiers.new('sub', 'WEIGHTED_NORMAL')
    finish(body, body_m)
    fy = -E['d'] * MM                       # the front face
    parts = [body]
    # v36: the button sits in a dark groove (a ring nearly flush with the face), the cap stands 0.35 mm proud
    # with a rounded edge that catches the light as a thin arc
    parts.append(disc(name + '-gap', (0, fy + 0.00002, E['button_z'] * MM), (E['button_r'] + 0.62) * MM, 0.0001, gap_m, verts=128))
    b = disc(name + '-button', (0, fy + 0.0001, E['button_z'] * MM), E['button_r'] * MM, 0.0009, button_cap(), verts=160)
    bb = b.modifiers.new('round', 'BEVEL'); bb.width = 0.00032; bb.segments = 6; bb.limit_method = 'ANGLE'
    parts.append(b)
    # twelve light points (off)
    lights = []
    for k in range(12):
        a = math.radians(90 - 30 * k)       # light 0 at the top, clockwise as seen from the front
        x, z = E['ring_r'] * math.cos(a), E['button_z'] + E['ring_r'] * math.sin(a)
        bpy.ops.mesh.primitive_circle_add(radius=E['dot_r'] * MM, vertices=32, fill_type='NGON', location=(x * MM, fy - 0.00004, z * MM), rotation=(math.pi / 2, 0, 0))
        parts.append(finish(bpy.context.active_object, dot_m, smooth=False))   # flat, printed into the face
        lights.append((x * MM, z * MM))
    # v12: the back: two infrared windows side by side, 2 cm under the top, and the air sensor's slot lower down
    by = 0.0  # the back face is at y = 0, facing +Y
    for sx in (-1, 1):
        parts.append(disc(name + '-ir' + str(sx), (sx * E['ir_dx'] * MM, by + 0.00005, E['ir_z'] * MM), E['ir_r'] * MM, 0.0003, ir_m, verts=48))
        parts.append(disc(name + '-irring' + str(sx), (sx * E['ir_dx'] * MM, by + 0.00002, E['ir_z'] * MM), (E['ir_r'] + 0.3) * MM, 0.0001, gap_m, verts=48))
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, by + 0.0001, E['air_z'] * MM))
    slot = bpy.context.active_object; slot.scale = (E['air_w'] * MM, 0.0005, E['air_h'] * MM); parts.append(finish(slot, air_m, smooth=False))
    # the AvenNex mark: the site's own SVG, rasterised (mark.png, 1024 x 675) and laid on the front face as a decal,
    # a touch lighter than the body (the curve import drew its overlapping paths as a cross: v13)
    try:
        img = bpy.data.images.load(os.path.abspath(os.path.join(os.path.dirname(__file__), 'mark.png')))
        mm_ = bpy.data.materials.new('ember-mark'); mm_.use_nodes = True; nt = mm_.node_tree; bsdf = nt.nodes['Principled BSDF']
        tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img; tex.interpolation = 'Cubic'
        mix = nt.nodes.new('ShaderNodeMixShader'); trans = nt.nodes.new('ShaderNodeBsdfTransparent'); out = nt.nodes['Material Output']
        bsdf.inputs['Base Color'].default_value = (0.42, 0.43, 0.45, 1); bsdf.inputs['Metallic'].default_value = 1.0; bsdf.inputs['Roughness'].default_value = 0.6   # v40: laser-etched
        nt.links.new(tex.outputs['Alpha'], mix.inputs['Fac']); nt.links.new(trans.outputs['BSDF'], mix.inputs[1]); nt.links.new(bsdf.outputs['BSDF'], mix.inputs[2]); nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
        mm_.blend_method = 'BLEND'
        w_ = E['mark_w'] * MM; h_ = w_ * 675 / 1024
        bpy.ops.mesh.primitive_plane_add(size=1, location=(0, fy - 0.00006, E['mark_z'] * MM), rotation=(math.pi / 2, 0, 0))
        mark = bpy.context.active_object; mark.scale = (w_, h_, 1); mark.name = name + '-mark'
        mark.data.materials.append(mm_); parts.append(mark)
    except Exception as e:
        print('mark not placed:', e)
    # group under an empty, so the device can be placed and turned as one
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0)); root = bpy.context.active_object; root.name = name
    for p in parts: p.parent = root
    root.rotation_euler = (0, up_angle, 0)          # Ry(b) turns +Z to (sin b, cos b)
    root.location = Vector(origin) + Vector((0, face_y, 0))
    return root, lights

# ------------------------------------------------------------------ the bike (VanMoof idiom)
G = {
    'RA': (0.0, 0.355), 'FA': (1.13, 0.355), 'BB': (0.43, 0.29),
    'HT_top': (0.985, 0.935), 'HT_bot': (1.035, 0.78),
    'TT_back': (0.085, 0.935), 'ST_top': (0.222, 0.935),
    'DT_top': (1.0, 0.83), 'DT_bot': (0.455, 0.325),
    'tyre_R': 0.331, 'tyre_r': 0.024,
}

def wheel(name, c, hub_r, hub_w, rim_m, tyre_m, hub_m, spoke_m):
    cx, cz = c; objs = []
    bpy.ops.mesh.primitive_torus_add(major_radius=G['tyre_R'], minor_radius=G['tyre_r'], major_segments=160, minor_segments=24, location=(cx, 0, cz), rotation=(math.pi / 2, 0, 0))
    objs.append(finish(bpy.context.active_object, tyre_m))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.298, minor_radius=0.012, major_segments=160, minor_segments=16, location=(cx, 0, cz), rotation=(math.pi / 2, 0, 0))
    rim = bpy.context.active_object; rim.scale = (1, 1, 1.5); objs.append(finish(rim, rim_m))
    objs.append(disc(name + '-hub', (cx, 0, cz), hub_r, hub_w, hub_m))
    spokes = []
    for i in range(32):
        side = 1 if i % 2 else -1; a = i / 32 * math.tau
        h = (cx + 0.026 * math.cos(a + side * 0.6), side * hub_w * 0.42, cz + 0.026 * math.sin(a + side * 0.6))
        r = (cx + 0.29 * math.cos(a), 0, cz + 0.29 * math.sin(a))
        spokes.append(tube(name + '-s%d' % i, h, r, 0.0011, spoke_m, verts=8))
    objs.append(join(spokes, name + '-spokes'))
    return objs

def chain_points(c1, r1, c2, r2, n=24):
    c1, c2 = Vector((c1[0], c1[1])), Vector((c2[0], c2[1]))
    D = c2 - c1; L = D.length; phi = math.atan2(D.y, D.x); al = math.acos((r1 - r2) / L)
    up, lo = phi + al, phi - al
    pts = []
    for k in range(n + 1):                      # around the chainring, away from the rear cog
        a = up + (math.tau - 2 * al) * k / n; pts.append(c1 + r1 * Vector((math.cos(a), math.sin(a))))
    for k in range(n + 1):                      # around the rear cog
        a = lo + (2 * al) * k / n; pts.append(c2 + r2 * Vector((math.cos(a), math.sin(a))))
    return pts

def build_bike():
    frame_m = material('frame', (0.035, 0.037, 0.04), metal=0.3, rough=0.5, coat=0.2)
    dark_m = material('dark', (0.025, 0.026, 0.028), metal=0.2, rough=0.55)
    tyre_m = material('tyre', (0.02, 0.02, 0.021), rough=0.82)
    rim_m = material('rim', (0.04, 0.042, 0.045), metal=0.9, rough=0.4)
    steel_m = material('steel', (0.32, 0.33, 0.35), metal=1.0, rough=0.38)
    hub_m = material('hub', (0.03, 0.031, 0.034), metal=0.6, rough=0.5)
    saddle_m = material('saddle', (0.018, 0.018, 0.019), rough=0.7)
    light_f = material('light-front', (1, 1, 1), emit=(1, 0.97, 0.92), strength=6)
    light_r = material('light-rear', (0.6, 0.05, 0.03), emit=(1, 0.08, 0.04), strength=3)
    sticker_m = material('sticker', (0.07, 0.074, 0.08), metal=0.6, rough=0.3)

    wheel('rear', G['RA'], 0.04, 0.11, rim_m, tyre_m, hub_m, steel_m)
    wheel('front', G['FA'], 0.062, 0.09, rim_m, tyre_m, hub_m, steel_m)   # front hub motor
    P = lambda k: (G[k][0], 0, G[k][1])
    # the frame: a straight top tube that runs past the seat tube, a thick down tube with the battery
    beam('top-tube', (G['TT_back'][0], 0, G['TT_back'][1]), (G['HT_top'][0] + 0.02, 0, G['HT_top'][1]), 0.046, 0.058, frame_m, bevel=0.48)
    beam('down-tube', (G['DT_top'][0], 0, G['DT_top'][1]), (G['DT_bot'][0], 0, G['DT_bot'][1]), 0.07, 0.088, frame_m, bevel=0.45)
    beam('head-tube', P('HT_top'), P('HT_bot'), 0.05, 0.06, frame_m, bevel=0.48)
    beam('seat-tube', (G['BB'][0], 0, G['BB'][1]), P('ST_top'), 0.04, 0.045, frame_m, bevel=0.48)
    for side in (-1, 1):
        beam('seat-stay%d' % side, (0.205, side * 0.045, 0.9), (G['RA'][0], side * 0.06, G['RA'][1] + 0.01), 0.018, 0.024, frame_m, bevel=0.48)
        beam('chain-stay%d' % side, (G['BB'][0] - 0.02, side * 0.04, G['BB'][1]), (G['RA'][0], side * 0.06, G['RA'][1] - 0.005), 0.02, 0.028, frame_m, bevel=0.48)
        beam('fork%d' % side, (G['HT_bot'][0], side * 0.03, G['HT_bot'][1] + 0.01), (G['FA'][0], side * 0.05, G['FA'][1]), 0.022, 0.032, frame_m, bevel=0.48)
    beam('bb-shell', (G['BB'][0] - 0.06, 0, G['BB'][1] + 0.02), (G['BB'][0] + 0.04, 0, G['BB'][1] - 0.02), 0.08, 0.075, frame_m, bevel=0.48)
    # lights in the ends of the top tube
    beam('light-front', (G['HT_top'][0] + 0.03, 0, G['HT_top'][1]), (G['HT_top'][0] + 0.036, 0, G['HT_top'][1]), 0.03, 0.03, light_f, bevel=0.3)
    beam('light-rear', (G['TT_back'][0] - 0.004, 0, G['TT_back'][1]), (G['TT_back'][0] + 0.004, 0, G['TT_back'][1]), 0.03, 0.03, light_r, bevel=0.3)
    # cockpit
    beam('stem', P('HT_top'), (0.965, 0, 1.025), 0.035, 0.04, frame_m, bevel=0.48)
    tube('bar', (0.955, -0.3, 1.03), (0.955, 0.3, 1.03), 0.0115, dark_m)
    for s in (-1, 1): tube('grip%d' % s, (0.955, s * 0.2, 1.03), (0.955, s * 0.31, 1.03), 0.017, saddle_m)
    # saddle and post
    tube('seat-post', (0.217, 0, 0.93), (0.198, 0, 1.03), 0.0135, dark_m)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.185, 0, 1.052)); s = bpy.context.active_object; s.name = 'saddle'
    s.scale = (0.24, 0.15, 0.055); bpy.ops.object.transform_apply(scale=True); s.rotation_euler = (0, math.radians(-4), 0)
    m = s.modifiers.new('round', 'BEVEL'); m.width = 0.026; m.segments = 10; finish(s, saddle_m)
    # drivetrain on the camera side
    disc('chainring', (G['BB'][0], -0.07, G['BB'][1]), 0.095, 0.004, steel_m)
    disc('chainring-inner', (G['BB'][0], -0.073, G['BB'][1]), 0.06, 0.004, dark_m)
    disc('cog', (G['RA'][0], -0.07, G['RA'][1]), 0.038, 0.004, steel_m)
    pts = chain_points(G['BB'], 0.097, G['RA'], 0.04)
    cu = bpy.data.curves.new('chain', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.0035; cu.bevel_resolution = 3
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1); sp.use_cyclic_u = True
    for i, q in enumerate(pts): sp.points[i].co = (q.x, -0.07, q.y, 1)
    ch = bpy.data.objects.new('chain', cu); bpy.context.collection.objects.link(ch); ch.data.materials.append(dark_m)
    crank_end = (G['BB'][0] + 0.17 * math.cos(math.radians(-62)), -0.09, G['BB'][1] + 0.17 * math.sin(math.radians(-62)))
    beam('crank', (G['BB'][0], -0.09, G['BB'][1]), crank_end, 0.014, 0.03, dark_m, bevel=0.45)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(crank_end[0], -0.13, crank_end[2])); pd = bpy.context.active_object; pd.name = 'pedal'
    pd.scale = (0.1, 0.09, 0.02); bpy.ops.object.transform_apply(scale=True); m = pd.modifiers.new('round', 'BEVEL'); m.width = 0.006; m.segments = 4; finish(pd, dark_m)
    beam('crank-r', (G['BB'][0], 0.09, G['BB'][1]), (G['BB'][0] - 0.17 * math.cos(math.radians(-62)), 0.09, G['BB'][1] - 0.17 * math.sin(math.radians(-62))), 0.014, 0.03, dark_m, bevel=0.45)
    # the sticker on the down tube, where Ember will sit
    d = Vector((G['DT_top'][0] - G['DT_bot'][0], 0, G['DT_top'][1] - G['DT_bot'][1])).normalized()
    mid = Vector(((G['DT_top'][0] + G['DT_bot'][0]) / 2, 0, (G['DT_top'][1] + G['DT_bot'][1]) / 2))
    up_angle = math.atan2(d.x, d.z)                         # turn of Ember's up axis from +Z towards +X
    bm = bmesh.new()
    vs = [bm.verts.new((x * MM * 0.9, 0, z * MM * 0.92)) for x, z in rounded_rect(EMBER['w'], EMBER['h'], EMBER['plan_r'])]
    bm.faces.new(vs); me = bpy.data.meshes.new('sticker'); bm.to_mesh(me); bm.free()
    st = bpy.data.objects.new('sticker', me); bpy.context.collection.objects.link(st)
    st.rotation_euler = (0, up_angle, 0); st.location = mid + Vector((0, -0.0352, 0)); finish(st, sticker_m)
    # the ground: only its shadow is kept
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0.56, 0, 0.0)); gp = bpy.context.active_object; gp.name = 'ground'
    gp.is_shadow_catcher = True
    return {'mount': (mid.x, mid.z), 'up_angle': up_angle, 'face_y': -0.0355}

def studio_bike():
    # a dark bike on black: mostly rim light, a low key from the front for the matte frame
    area('key', (0.6, -3.0, 3.2), (0.6, 0, 0.6), 4.0, 260)
    area('fill', (0.6, -4.0, 0.5), (0.6, 0, 0.6), 5.0, 40)
    area('rim-left', (-1.6, 1.8, 1.4), (0.2, 0, 0.6), 2.0, 700, (0.95, 0.97, 1.0))
    area('rim-right', (2.8, 1.8, 1.4), (1.0, 0, 0.6), 2.0, 700, (0.95, 0.97, 1.0))
    area('top', (0.6, 0.0, 3.8), (0.6, 0, 0.5), 5.0, 140)

def strip(name, loc, target, size, energy, color=(1, 1, 1)):
    """v36: a long rectangular softbox, its long side kept vertical (world Z)."""
    bpy.ops.object.light_add(type='AREA', location=loc)
    l = bpy.context.active_object; l.name = name
    l.data.shape = 'RECTANGLE'; l.data.size, l.data.size_y = size; l.data.energy = energy; l.data.color = color
    d = Vector(target) - Vector(loc)
    l.rotation_mode = 'QUATERNION'; l.rotation_quaternion = d.to_track_quat('-Z', 'Y')
    return l

def studio_ember():
    # keyx: the key light's side (v10 flip turns the face to the right, so the key moves right with it)
    kx = float(ARGS.get('keyx', -0.16)); s = 1 if kx >= 0 else -1
    if ARGS.get('studio', 'v36') == 'v12':
        area('key', (kx, -0.24, 0.24), (0, 0, 0.02), 0.5, 3.0)
        area('fill', (-kx * 1.6, -0.26, -0.08), (0, 0, -0.01), 0.45, 0.5)
        area('rim', (0.02, 0.16, 0.26), (0, 0, 0.02), 0.25, 4)
        return
    # v36, product-photo light: a large soft key high in front on the key side (a gentle gradient over the face),
    # two tall strips just in front of the side walls (the rounded edges read as clean lines, no haze),
    # a low fill, and a small top light for a thin line along the top edge
    K = float(ARGS.get('key', 2.5)); ST = float(ARGS.get('strip', 0.22 if ARGS.get('finish', 'alu') == 'alu' else 0.35))
    area('key', (kx * 1.5, -0.42, 0.32), (0, 0, 0.012), 0.6, K)
    SY = float(ARGS.get('sy', -0.02))
    strip('strip-key', (s * 0.10, SY, 0.0), (0, -0.0075, 0.0), (0.014, 0.26), ST)
    strip('strip-fill', (-s * 0.10, SY, 0.0), (0, -0.0075, 0.0), (0.014, 0.26), ST * 0.45)
    area('fill', (-kx * 1.6, -0.32, -0.14), (0, 0, -0.01), 0.5, K * 0.12)
    area('top', (0.0, -0.05, 0.16), (0, -0.0075, 0.05), 0.06, float(ARGS.get('top', 0.15 if ARGS.get('finish', 'alu') == 'alu' else 0.3)))
    # v40: a softbox close above the face, as in Apple's product photos: on the metal its reflection falls off from the
    # top of the face to the bottom (with distant lights and a flat face every point reflects the same, so it read flat)
    if ARGS.get('finish', 'alu') == 'alu':
        strip('face', (kx * 0.15, -0.12, 0.075), (0, -0.0075, 0.02), (0.07, 0.035), float(ARGS.get('face', 0.16)))

# ------------------------------------------------------------------ renders
def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print('rendered', path)

def do_ember():
    reset()
    _, lights = build_ember()
    studio_ember()
    W, H = 900, 2700
    cam = ortho_camera('cam', (0.0, 0.0), 0.12, (W, H))   # portrait: ortho_scale is the height, 120 mm (x 40 mm)
    info = frame_info(cam)
    render(os.path.join(OUT, 'ember-front.png'))
    E = EMBER
    data = {'size': [W, H], 'body_centre': to_px(info, 0, 0), 'body_px': [E['w'] * MM * info['px_per_m'], E['h'] * MM * info['px_per_m']],
            'ring_centre': to_px(info, 0, E['button_z'] * MM), 'lights': [to_px(info, x, z) for x, z in lights],
            'dot_r': E['dot_r'] * MM * info['px_per_m'], 'button_r': E['button_r'] * MM * info['px_per_m'], 'spec_mm': EMBER}
    json.dump(data, open(os.path.join(OUT, 'ember-front.json'), 'w'), indent=1)

def do_bike(close=True):
    reset()
    M = build_bike()
    studio_bike()
    cam = ortho_camera('cam', (0.565, 0.56), 2.3, (4096, 2304))
    full = frame_info(cam)
    if MODE in ('bike', 'all'): render(os.path.join(OUT, 'bike-full.png'))
    k = 4.0                                                   # the close-up: same camera, 4x, centred on the sticker
    cam.location.x, cam.location.z = M['mount']
    bpy.context.scene.render.resolution_x = bpy.context.scene.render.resolution_y = 2400
    cam.data.ortho_scale = 2400 / (full['px_per_m'] * k)                 # square frame: k times the full render's pixels per metre
    closeup = frame_info(cam)
    if close and MODE in ('close', 'all'): render(os.path.join(OUT, 'bike-close.png'))
    ember_len_m = EMBER['h'] * MM
    data = {'full': full, 'close': closeup, 'mount_m': M['mount'], 'up_angle_rad': M['up_angle'],
            'mount_full_px': to_px(full, *M['mount']), 'mount_close_px': to_px(closeup, *M['mount']),
            'ember_len_full_px': ember_len_m * full['px_per_m'], 'ember_len_close_px': ember_len_m * closeup['px_per_m'],
            'downtube_full_px': [to_px(full, *G['DT_top']), to_px(full, *G['DT_bot'])],
            'battery_label_m': [(G['DT_top'][0] * 0.3 + G['DT_bot'][0] * 0.7), (G['DT_top'][1] * 0.3 + G['DT_bot'][1] * 0.7)]}
    json.dump(data, open(os.path.join(OUT, 'bike.json'), 'w'), indent=1)

if MODE == 'ember': do_ember()
elif MODE in ('bike', 'close'): do_bike()
elif MODE == 'all': do_ember(); do_bike()
elif MODE == 'mounted':
    # a check render: Ember on the sticker, close-up camera
    reset(); M = build_bike(); studio_bike()
    build_ember('Ember', (M['mount'][0], 0, M['mount'][1]), M['up_angle'], M['face_y'])
    cam = ortho_camera('cam', M['mount'], 0.4, (1600, 1600)); render(os.path.join(OUT, 'check-mounted.png'))

# ------------------------------------------------------------------ v5: lying (footer) and side profile (dimensions)
def do_lying():
    reset()
    root, _ = build_ember()
    root.rotation_euler = (-math.pi / 2, 0, math.pi / 2)      # face up, long axis along X
    root.location = (0, 0, 0)                                   # the back face rests on the ground
    bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, 0)); gp = bpy.context.active_object; gp.is_shadow_catcher = True
    area('key', (-0.06, 0.05, 0.34), (0, 0, 0.01), 0.22, 2.2)      # from above and slightly behind: a line of light on the top edge
    area('rim', (0.05, 0.3, 0.1), (0, 0, 0.01), 0.3, 5)
    bpy.ops.object.camera_add(location=(0.0, -0.62, 0.075))
    cam = bpy.context.active_object; cam.data.lens = 120
    d = Vector((0, 0, 0.006)) - cam.location; cam.rotation_mode = 'QUATERNION'; cam.rotation_quaternion = d.to_track_quat('-Z', 'Y')
    sc = bpy.context.scene; sc.camera = cam; sc.render.resolution_x, sc.render.resolution_y = 3200, 900
    render(os.path.join(OUT, 'ember-lying.png'))

def do_side():
    reset()
    build_ember()
    area('key', (0.3, -0.12, 0.22), (0, -0.007, 0.01), 0.3, 6)
    area('rim', (0.25, 0.15, -0.1), (0, -0.007, 0), 0.3, 3)
    W, H = 900, 2700
    bpy.ops.object.camera_add(location=(0.5, -EMBER['d'] * MM / 2, 0.0), rotation=(math.pi / 2, 0, math.pi / 2))
    cam = bpy.context.active_object; cam.data.type = 'ORTHO'; cam.data.ortho_scale = 0.12
    sc = bpy.context.scene; sc.camera = cam; sc.render.resolution_x, sc.render.resolution_y = W, H
    render(os.path.join(OUT, 'ember-side.png'))

if MODE == 'lying': do_lying()
elif MODE == 'side': do_side()

# ------------------------------------------------------------------ v7: a turntable for the site (drag to turn)
def do_turn(frames=36):
    reset()
    root, _ = build_ember()
    studio_ember()
    W, H = int(ARGS.get('w', 360)), int(ARGS.get('w', 360)) * 3
    cam = ortho_camera('cam', (0.0, 0.0), 0.12, (W, H))
    os.makedirs(os.path.join(OUT, 'turn'), exist_ok=True)
    for i in range(frames):
        # turn around the long axis of the device, through its centre of depth
        a = math.tau * i / frames; h = EMBER['d'] * MM / 2
        root.rotation_euler = (0, 0, a)
        root.location = (-h * math.sin(a), -h + h * math.cos(a), 0)     # keep the centre of its depth in place
        render(os.path.join(OUT, 'turn', 'f%02d.png' % i))

if MODE == 'turn': do_turn(int(ARGS.get('frames', 36)))

# ------------------------------------------------------------------ v9: the flip onto the tube, and a side profile for the photos
def do_flip(frames=16, beta_end=30.0, sign=-1, sub='flip'):
    """Ember turning about its long axis from facing the camera (0°) to the tube's face (beta_end°),
    pivoting on the centre of its back face (where it touches the sticker). 60 x 120 mm frames."""
    reset()
    root, lights = build_ember()
    studio_ember()
    # v36: the studio turns with Ember, so its finish reads the same in every frame (with the lights fixed, the side
    # strip slid over the face as it turned and washed it out to a light grey)
    if ARGS.get('follow', '1') == '1':
        for o in [o for o in bpy.data.objects if o.type == 'LIGHT']: o.parent = root
    W, H = int(ARGS.get('w', 450)), int(ARGS.get('w', 450)) * 2
    cam = ortho_camera('cam', (0.0, 0.0), 0.12, (W, H))
    os.makedirs(os.path.join(OUT, sub), exist_ok=True)
    for i in range(frames):
        b = math.radians(beta_end) * i / (frames - 1)
        # sign -1 (v9): the face turns to the left, the right side wall comes into view
        # sign +1 (v10): the face turns to the right, as on the team's site; the left side wall comes into view
        root.rotation_euler = (0, 0, sign * b)
        render(os.path.join(OUT, sub, 'f%02d.png' % i))

def do_profile():
    """Ember lying on a surface, seen from the side with a little elevation: a thin slab along the surface."""
    reset()
    root, _ = build_ember()
    studio_ember()
    W, H = 300, 900
    # camera on the -X side, a little towards the face (-Y): the side wall and a sliver of the face
    el = math.radians(9)
    bpy.ops.object.camera_add(location=(-0.5 * math.cos(el), -0.5 * math.sin(el), 0.0))
    cam = bpy.context.active_object; cam.data.type = 'ORTHO'; cam.data.ortho_scale = 0.12
    d = Vector((0, -EMBER['d'] * MM / 2, 0)) - cam.location; cam.rotation_mode = 'QUATERNION'; cam.rotation_quaternion = d.to_track_quat('-Z', 'Y')
    sc = bpy.context.scene; sc.camera = cam; sc.render.resolution_x, sc.render.resolution_y = W, H
    render(os.path.join(OUT, 'ember-profile.png'))

if MODE == 'flip': do_flip(int(ARGS.get('frames', 16)), float(ARGS.get('beta', 30)), int(ARGS.get('sign', -1)), ARGS.get('sub', 'flip'))
elif MODE == 'profile': do_profile()

# ------------------------------------------------------------------ v14: what is in the box, at true size: the USB-C cable, Ember, the sticker
def build_sticker(name='Sticker', loc=(0, 0, 0)):
    """The magnetic sticker: a thin brushed-steel plate, 33 x 100 x 0.8 mm, the same rounded plan as Ember."""
    m = material('sticker', (0.72, 0.74, 0.76), metal=1.0, rough=0.3, aniso=0.7)
    if ARGS.get('sticker') == 'light':                         # v46: light satin on the white stage, as in the scroll story
        m = material('sticker-light', (0.8, 0.81, 0.82), rough=0.35, coat=0.3)
    bm = bmesh.new()
    verts = [bm.verts.new((x * MM, 0, z * MM)) for x, z in rounded_rect(33, 100, 11.5)]
    f = bm.faces.new(verts); ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [g for g in ext['geom'] if isinstance(g, bmesh.types.BMVert)]: v.co.y -= 0.8 * MM
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    bev = o.modifiers.new('soft', 'BEVEL'); bev.width = 0.3 * MM; bev.segments = 4
    finish(o, m); o.location = loc
    return o

def build_cable(name='Cable', centre=(0, 0, 0)):
    """A coiled USB-C cable: three loops of a 3.5 mm white cable around a 64 mm circle, a strap, two plugs."""
    white = material('cable', (0.86, 0.87, 0.88), rough=0.45, coat=0.3)
    plug = material('plug', (0.75, 0.76, 0.78), metal=1.0, rough=0.25)
    cx, cy, cz = centre
    curve = bpy.data.curves.new(name, 'CURVE'); curve.dimensions = '3D'; curve.bevel_depth = 1.75 * MM; curve.bevel_resolution = 6
    sp = curve.splines.new('POLY'); pts = []
    R = 32 * MM
    for k in range(3 * 72 + 1):
        a = math.tau * k / 72
        r = R + (k / 216 - 0.5) * 6 * MM + math.sin(a * 3) * 0.6 * MM
        pts.append((cx + r * math.cos(a), cy - (k / 216) * 4 * MM, cz + r * math.sin(a)))
    # the two ends leave the coil downwards
    a0 = pts[0]; a1 = pts[-1]
    tail = [(a0[0] - 6 * MM, a0[1], a0[2] - 18 * MM), (a0[0] - 10 * MM, a0[1], a0[2] - 34 * MM)]
    head = [(a1[0] + 6 * MM, a1[1], a1[2] - 18 * MM), (a1[0] + 10 * MM, a1[1], a1[2] - 34 * MM)]
    allp = list(reversed(tail)) + pts + head
    sp.points.add(len(allp) - 1)
    for i, p in enumerate(allp): sp.points[i].co = (*p, 1)
    o = bpy.data.objects.new(name, curve); bpy.context.collection.objects.link(o); o.data.materials.append(white)
    for end in (allp[0], allp[-1]):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(end[0], end[1], end[2] - 9 * MM))
        b = bpy.context.active_object; b.scale = (8.4 * MM, 3.0 * MM, 14 * MM); bb = b.modifiers.new('r', 'BEVEL'); bb.width = 1.2 * MM; bb.segments = 4; finish(b, white)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(end[0], end[1], end[2] - 20 * MM))
        c = bpy.context.active_object; c.scale = (8.3 * MM, 2.5 * MM, 7 * MM); cb = c.modifiers.new('r', 'BEVEL'); cb.width = 1.1 * MM; cb.segments = 4; finish(c, plug)
    # the strap around the coil
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy - 2 * MM, cz + R + 1 * MM))
    s = bpy.context.active_object; s.scale = (9 * MM, 9 * MM, 4 * MM); sb = s.modifiers.new('r', 'BEVEL'); sb.width = 1.5 * MM; sb.segments = 4; finish(s, white)
    return o

def do_box():
    reset()
    root, _ = build_ember()                                   # Ember, front, centred at x = 0
    build_sticker(loc=(70 * MM, 0, 0))                        # the sticker to its right, flat, front facing you
    if ARGS.get('cable', '0') == '1':                         # v40: the cable is the team's image now (composited into box.webp)
        build_cable(centre=(-95 * MM, -8 * MM, 4 * MM))       # the cable to its left
    area('key', (-0.1, -0.3, 0.25), (0, 0, 0), 0.6, 3.0)
    area('fill', (0.3, -0.25, -0.05), (0, 0, 0), 0.5, 0.8)
    area('rim', (0.02, 0.16, 0.26), (0, 0, 0.02), 0.3, 4)
    if ARGS.get('finish', 'alu') == 'alu':          # v40: the same softbox over Ember's face as in the studio
        strip('face', (0.0, -0.12, 0.075), (0, -0.0075, 0.02), (0.07, 0.035), float(ARGS.get('face', 0.16)))
    W, H = int(ARGS.get('w', 2400)), int(ARGS.get('w', 2400)) * 1200 // 2400
    ortho_camera('cam', (-12 * MM, 0.0), 0.264, (W, H))       # 264 mm wide: the scene measures about 230 mm
    render(os.path.join(OUT, 'box.png'))
    print('box mm per px', 264 / W)

if MODE == 'box': do_box()

# ------------------------------------------------------------------ v46: Ember on the battery housing, in the site's white style
# The team's photo (Ember in profile on a black battery, a black studio) made over as our own render: the same
# composition, a light grey housing on white, so it sits on the white stage of 'Ember in detail'.
#   mode=measure   the profile: Ember on the housing seen from the side          -> measure.png + measure.json
#   mode=magnet    the click, as in the scroll story: the sticker on the housing,
#                  Ember coming in along the normal and landing on it (frames)    -> magnet/f00..fNN.png + magnet.json
def build_housing(w=None, d=None, h=640.0, gap=0.8):
    """The down tube of the bike, with the battery in it: a long block of nearly square section (the frame's own profile,
    small radii, not a round tube); its side face, where the sticker sits, at y = gap mm facing -Y; the battery cover's seam
    runs along it, as on the team's bike."""
    w = float(ARGS.get('house_w', 66)) if w is None else w; d = float(ARGS.get('house_d', 58)) if d is None else d
    c = float(ARGS.get('house', 0.62))
    m = material('housing', (c, c * 1.005, c * 1.015), rough=float(ARGS.get('house_rough', 0.5)), coat=0.15)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, (gap + d / 2) * MM, 0))
    o = bpy.context.active_object; o.name = 'Housing'; o.scale = (w * MM, d * MM, h * MM)
    bpy.ops.object.transform_apply(scale=True)
    r = float(ARGS.get('house_r', 7))
    bv = o.modifiers.new('round', 'BEVEL'); bv.width = r * MM; bv.segments = 10; bv.profile = 0.5
    o.modifiers.new('wn', 'WEIGHTED_NORMAL')
    finish(o, m)
    if ARGS.get('seam', '1') == '1':
        seam = material('seam', (c * 0.18, c * 0.18, c * 0.19), rough=0.7)
        sw_ = float(ARGS.get('seam_w', 0.7))
        # on the side face, to the right of Ember; and on the face the camera sees in profile, towards the back
        bpy.ops.mesh.primitive_cube_add(size=1, location=((w / 2 - r - 3.5) * MM, (gap + 0.15) * MM, 0))
        a_ = bpy.context.active_object; a_.name = 'Housing-seam1'; a_.scale = (sw_ * MM, 0.5 * MM, h * MM); finish(a_, seam, smooth=False)
        bpy.ops.mesh.primitive_cube_add(size=1, location=((w / 2 - 0.15) * MM, (gap + d * 0.62) * MM, 0))
        b_ = bpy.context.active_object; b_.name = 'Housing-seam2'; b_.scale = (0.5 * MM, sw_ * MM, h * MM); finish(b_, seam, smooth=False)
    return o

def studio_white():
    # a bright studio: white above for the reflections, a large soft key in front on the left, a strip on the side,
    # a rim from behind so the profile reads as a clean line
    sc = bpy.context.scene; nt = sc.world.node_tree
    ramp = next(n for n in nt.nodes if n.type == 'VALTORGB'); els = ramp.color_ramp.elements
    for e in els: e.color = (0.5, 0.5, 0.51, 1)
    els[-1].color = (1.0, 1.0, 1.0, 1)
    nt.nodes['Background'].inputs['Strength'].default_value = float(ARGS.get('world_s', 0.6))
    K = float(ARGS.get('key', 14))
    area('key', (0.32, -0.42, 0.46), (0, 0, 0), 0.9, K)
    area('fill', (-0.4, -0.35, 0.05), (0, 0, 0), 0.8, K * 0.35)
    strip('side', (0.22, 0.05, 0.0), (0, -0.0075, 0.0), (0.03, 0.5), K * 0.12)
    area('rim', (0.05, 0.35, 0.3), (0, 0, 0), 0.4, K * 0.25)
    area('top', (0.0, -0.05, 0.5), (0, 0, 0), 0.5, K * 0.25)

def studio_white2():
    # v46b: shaped light, as a product photo: a soft key high on the camera side (a gradient down the housing),
    # an edge light from the front that draws Ember's front edge, a kicker behind the housing for its far edge,
    # the world dim so the forms keep their depth
    sc = bpy.context.scene; nt = sc.world.node_tree
    ramp = next(n for n in nt.nodes if n.type == 'VALTORGB'); els = ramp.color_ramp.elements
    for e in els: e.color = (0.25, 0.25, 0.26, 1)
    els[-1].color = (1.0, 1.0, 1.0, 1)
    nt.nodes['Background'].inputs['Strength'].default_value = float(ARGS.get('world_s', 0.25))
    K = float(ARGS.get('key', 6))
    area('key', (0.42, -0.18, 0.42), (0, 0.02, -0.05), float(ARGS.get('key_size', 0.35)), K)
    strip('edge', (0.06, -0.3, 0.05), (0, -0.0075, 0.0), (0.04, 0.6), K * float(ARGS.get('edge', 0.25)))
    strip('kick', (0.12, 0.32, 0.1), (0.03, 0.03, 0.0), (0.05, 0.6), K * float(ARGS.get('kick', 0.35)))
    area('fill', (0.6, 0.05, -0.15), (0, 0, 0), 0.6, K * float(ARGS.get('fill', 0.12)))
    fr = float(ARGS.get('front', 0))
    if fr > 0: area('front', (0.2, -0.6, 0.38), (0, -0.01, 0.02), 0.5, K * fr)
    mi = float(ARGS.get('mirror', 0))        # a softbox where the metal face reflects it (opposite the camera, in front)
    if mi > 0: area('mirror', (-0.42, -0.62, 0.3), (0, -0.01, 0.0), float(ARGS.get('mirror_size', 0.45)), K * mi)

def cam_look(loc, target, lens, res):
    bpy.ops.object.camera_add(location=loc)
    cam = bpy.context.active_object; cam.data.lens = lens; cam.data.sensor_width = 36
    d = Vector(target) - Vector(loc); cam.rotation_mode = 'QUATERNION'; cam.rotation_quaternion = d.to_track_quat('-Z', 'Y')
    sc = bpy.context.scene; sc.camera = cam; sc.render.resolution_x, sc.render.resolution_y = res; sc.render.resolution_percentage = 100
    return cam

def px_of(cam, p):
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene; v = world_to_camera_view(sc, cam, Vector(p))
    return [round(v.x * sc.render.resolution_x, 1), round((1 - v.y) * sc.render.resolution_y, 1)]

def do_measure():
    reset(); E = EMBER
    root, _ = build_ember()
    build_sticker(loc=(0, 0.8 * MM, 0))
    build_housing()
    (studio_white2 if ARGS.get('studio', 'w2') == 'w2' else studio_white)()
    W = int(ARGS.get('w', 2304)); H = int(W / float(ARGS.get('aspect', 1.5)))
    # the profile, as in the team's photo: from the side, a little in front, Ember upright on the left of the housing
    az = math.radians(float(ARGS.get('az', 14))); el = math.radians(float(ARGS.get('el', 4))); dist = float(ARGS.get('dist', 0.9))
    tgt = (0.0, float(ARGS.get('ty', 0.012)), 0.0)
    loc = (dist * math.cos(az) * math.cos(el), tgt[1] - dist * math.sin(az) * math.cos(el), dist * math.sin(el))
    cam = cam_look(loc, tgt, float(ARGS.get('lens', 150)), (W, H))
    from mathutils import Quaternion
    cam.rotation_quaternion = cam.rotation_quaternion @ Quaternion((0, 0, 1), math.radians(float(ARGS.get('roll', 0))))
    render(os.path.join(OUT, 'measure.png'))
    # where the notes point: the infrared windows (on the back, at the housing), the air slot, Ember's outer edge
    data = {'size': [W, H], 'centre': px_of(cam, (0, -E['d'] * MM / 2, 0)),
            'ir': px_of(cam, (E['w'] / 2 * MM, 0, E['ir_z'] * MM)), 'air': px_of(cam, (E['w'] / 2 * MM, 0, E['air_z'] * MM)),
            'top': px_of(cam, (E['w'] / 2 * MM, -E['d'] * MM, E['h'] / 2 * MM)), 'bottom': px_of(cam, (E['w'] / 2 * MM, -E['d'] * MM, -E['h'] / 2 * MM)),
            'front_mid': px_of(cam, (E['w'] / 2 * MM, -E['d'] * MM, 0)), 'house': px_of(cam, (37 * MM, 30 * MM, -60 * MM))}
    json.dump(data, open(os.path.join(OUT, 'measure.json'), 'w'), indent=1)

def do_magnet():
    """v46: the background (the housing and the sticker, without Ember) at full size, and Ember's frames cropped to the
    part of the picture it passes through (the rest does not change), so the page lays the frames over the background."""
    reset(); E = EMBER
    root, lights = build_ember()
    build_sticker(loc=(0, 0.8 * MM, 0))
    build_housing()
    (studio_white2 if ARGS.get('studio', 'w2') == 'w2' else studio_white)()
    sc = bpy.context.scene
    W, H = int(ARGS.get('w', 1000)), int(int(ARGS.get('w', 1000)) * float(ARGS.get('aspect', 1.25)))
    # three quarters from the front: the housing's face with the sticker on it, Ember coming in towards it
    az = math.radians(float(ARGS.get('az', 38))); el = math.radians(float(ARGS.get('el', 8))); dist = float(ARGS.get('dist', 0.9))
    tgt = (0.0, -0.01, 0.0)
    loc = (dist * math.sin(az) * math.cos(el), -dist * math.cos(az) * math.cos(el), dist * math.sin(el))
    cam = cam_look(loc, tgt, float(ARGS.get('lens', 105)), (W, H))
    from mathutils import Quaternion
    cam.rotation_quaternion = cam.rotation_quaternion @ Quaternion((0, 0, 1), math.radians(float(ARGS.get('roll', 0))))
    n = int(ARGS.get('frames', 14)); lift = float(ARGS.get('lift', 34)); tw = math.radians(float(ARGS.get('tw', 10)))
    def pose(i):
        s_ = 1 - i / (n - 1)                                  # 1: off the housing, 0: on it
        root.location = (0, -lift * MM * s_, 0); root.rotation_euler = (0, 0, tw * s_)
        bpy.context.view_layer.update()
    corners = [(x * MM, y * MM, z * MM) for x in (-E['w'] / 2, E['w'] / 2) for y in (-E['d'], 0) for z in (-E['h'] / 2, E['h'] / 2)]
    xs, ys = [], []
    for i in range(n):
        pose(i); M = root.matrix_world
        for c in corners:
            p = px_of(cam, M @ Vector(c)); xs.append(p[0]); ys.append(p[1])
    m = float(ARGS.get('margin', 0.05)) * W
    x0, x1 = max(0, int(min(xs) - m)), min(W, int(max(xs) + m)); y0, y1 = max(0, int(min(ys) - m)), min(H, int(max(ys) + m))
    x0 -= x0 % 2; y0 -= y0 % 2; x1 += x1 % 2; y1 += y1 % 2
    pose(n - 1); M = root.matrix_world
    data = {'size': [W, H], 'frames': n, 'lift_mm': lift, 'crop': [x0, y0, x1 - x0, y1 - y0],
            'lights': [px_of(cam, M @ Vector((lx, -E['d'] * MM - 0.0001, lz))) for lx, lz in lights],
            'ring': px_of(cam, M @ Vector((0, -E['d'] * MM, E['button_z'] * MM))),
            'ember': px_of(cam, M @ Vector((0, -E['d'] * MM, 0))), 'top': px_of(cam, M @ Vector((0, -E['d'] * MM, E['h'] / 2 * MM))),
            'sticker': px_of(cam, (E['w'] / 2 * MM + 0.5 * MM, 0.4 * MM, -30 * MM)), 'house': px_of(cam, (37 * MM, 20 * MM, -90 * MM))}
    json.dump(data, open(os.path.join(OUT, 'magnet.json'), 'w'), indent=1)
    what = ARGS.get('pass', 'all')
    if what in ('bg', 'all'):
        for o in [root] + list(root.children_recursive): o.hide_render = True
        render(os.path.join(OUT, 'magnet-bg.png'))
        for o in [root] + list(root.children_recursive): o.hide_render = False
    if what in ('frames', 'all'):
        os.makedirs(os.path.join(OUT, 'magnet'), exist_ok=True)
        if ARGS.get('catcher') == '1':                       # (a uniform grey veil over the crop: off; the page feathers the crop's edge instead)
            for o in bpy.data.objects:
                if o.name.startswith('Housing') or o.name.startswith('Sticker'): o.is_shadow_catcher = True
        sc.render.use_border = True; sc.render.use_crop_to_border = True
        sc.render.border_min_x, sc.render.border_max_x = x0 / W, x1 / W
        sc.render.border_min_y, sc.render.border_max_y = 1 - y1 / H, 1 - y0 / H
        only = ARGS.get('only')
        for i in range(n):
            if only is not None and str(i) not in only.split(','): continue
            pose(i); render(os.path.join(OUT, 'magnet', 'f%02d.png' % i))

if MODE == 'measure': do_measure()
elif MODE == 'magnet': do_magnet()
