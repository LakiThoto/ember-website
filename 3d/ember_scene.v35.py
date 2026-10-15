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
WORLD_TOP = float(ARGS.get('world', 0.8))
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
    m = bpy.data.materials.new('ember-button'); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); gr = nt.nodes.new('ShaderNodeTexGradient'); ramp = nt.nodes.new('ShaderNodeValToRGB')
    mp.inputs['Rotation'].default_value = (0, math.radians(-45), 0)       # diagonal in the face plane (XZ)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], gr.inputs['Vector'])
    mp.inputs['Location'].default_value = (0.5, 0, 0); mp.inputs['Scale'].default_value = (80, 80, 80)
    nt.links.new(gr.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    ramp.color_ramp.elements[0].color = (0.05, 0.052, 0.056, 1); ramp.color_ramp.elements[1].color = (0.62, 0.63, 0.65, 1)
    b.inputs['Metallic'].default_value = 0.0; b.inputs['Roughness'].default_value = 0.32; b.inputs['Coat Weight'].default_value = 1.0; b.inputs['Coat Roughness'].default_value = 0.08
    b.inputs['Anisotropic'].default_value = 0.6
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
    body_m = material('ember-body', (0.03, 0.031, 0.034), metal=0.0, rough=0.52, coat=0.7)
    body_m.node_tree.nodes['Principled BSDF'].inputs['Coat Roughness'].default_value = 0.22
    gap_m = material('ember-gap', (0.01, 0.01, 0.012), rough=0.6)
    dot_m = material('ember-dot', (0.52, 0.53, 0.55), rough=0.5)                   # the light points, light grey when off
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
    # the button: a ring gap, then a convex polished disc
    parts.append(disc(name + '-gap', (0, fy - 0.0001, E['button_z'] * MM), (E['button_r'] + 0.45) * MM, 0.0004, gap_m))
    # the button: a flat brushed cap, light at the top left and dark at the bottom right, as on the supplied render
    b = disc(name + '-button', (0, fy - 0.0003, E['button_z'] * MM), E['button_r'] * MM, 0.0006, button_cap(), verts=96)
    bb = b.modifiers.new('round', 'BEVEL'); bb.width = 0.00025; bb.segments = 4
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
        bsdf.inputs['Base Color'].default_value = (0.3, 0.31, 0.33, 1); bsdf.inputs['Metallic'].default_value = 0.6; bsdf.inputs['Roughness'].default_value = 0.45
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

def studio_ember():
    # keyx: the key light's side (v10 flip turns the face to the right, so the key moves right with it)
    # v12: a bigger, softer key and a fill from the other side, so the satin body reads as a rounded form
    area('key', (float(ARGS.get('keyx', -0.16)), -0.24, 0.24), (0, 0, 0.02), 0.5, 3.0)
    area('fill', (-float(ARGS.get('keyx', -0.16)) * 1.6, -0.26, -0.08), (0, 0, -0.01), 0.45, 0.5)
    area('rim', (0.02, 0.16, 0.26), (0, 0, 0.02), 0.25, 4)

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
    build_cable(centre=(-95 * MM, -8 * MM, 4 * MM))           # the cable to its left
    area('key', (-0.1, -0.3, 0.25), (0, 0, 0), 0.6, 3.0)
    area('fill', (0.3, -0.25, -0.05), (0, 0, 0), 0.5, 0.8)
    area('rim', (0.02, 0.16, 0.26), (0, 0, 0.02), 0.3, 4)
    W, H = int(ARGS.get('w', 2400)), int(ARGS.get('w', 2400)) * 1200 // 2400
    ortho_camera('cam', (-12 * MM, 0.0), 0.264, (W, H))       # 264 mm wide: the scene measures about 230 mm
    render(os.path.join(OUT, 'box.png'))
    print('box mm per px', 264 / W)

if MODE == 'box': do_box()
