import bpy, sys
prefs = bpy.context.preferences.addons['cycles'].preferences
for t in ('METAL', 'NONE'):
    try:
        prefs.compute_device_type = t; prefs.get_devices()
        print('device type', t, [(d.name, d.type) for d in prefs.devices]); break
    except Exception as e: print('no', t, e)
print('engines', [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items])
