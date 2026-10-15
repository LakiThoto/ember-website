"""Ember site, v59: the brain as dots along the outlines of its folds (after the reference the user sent on 15 Oct).

    /usr/bin/python3 brain_points.py ../v59/brain-data.js

The folds are the zero lines of band-pass noise (a field made of waves of one length in all directions): they wind
like gyri, at an even distance from each other. Dots go along those lines at an even spacing, plus the outlines of the
cerebrum, the cerebellum and the brain stem, plus a few loose dots under it. Two sets: one for a desktop, one with
fewer, wider folds for a phone (where the brain is smaller on the screen).

Coordinates are the site's brain frame (main.js makeBrain): x from -1 (front) to 1 (back), y down, the cerebrum from
about -0.72 to 0.52. Each point is [x, y, kind, shade]: kind 0 outline, 1 cerebrum fold, 2 cerebellum, 3 stem, 4 loose;
shade as main.js INK (0 green, 1 dark, 2 light grey), one per fold so a fold reads as one line; grey only for the loose dots.
"""
import json, math, sys
import numpy as np

OUT = sys.argv[1] if len(sys.argv) > 1 else 'brain-data.js'


def catmull(P0, closed, k):
    P = [P0[-1]] + P0 + [P0[0], P0[1]] if closed else [P0[0]] + P0 + [P0[-1]]
    out = []
    for i in range(1, len(P) - 2):
        a, b, c, d = P[i - 1], P[i], P[i + 1], P[i + 2]
        for j in range(k):
            t = j / k; t2 = t * t; t3 = t2 * t
            out.append(tuple(0.5 * (2 * b[m] + (-a[m] + c[m]) * t + (2 * a[m] - 5 * b[m] + 4 * c[m] - d[m]) * t2 + (-a[m] + 3 * b[m] - 3 * c[m] + d[m]) * t3) for m in (0, 1)))
    if not closed:
        out.append(tuple(P0[-1]))
    return np.array(out)


# the cerebrum: the site's own outline (main.js OL)
CEREBRUM = catmull([[-0.86, 0.16], [-0.98, -0.06], [-0.93, -0.32], [-0.72, -0.55], [-0.38, -0.68], [0.02, -0.71], [0.40, -0.63], [0.70, -0.46], [0.92, -0.20], [0.99, 0.06],
                    [0.90, 0.24], [0.64, 0.30], [0.40, 0.36], [0.12, 0.50], [-0.20, 0.51], [-0.42, 0.42], [-0.52, 0.26], [-0.66, 0.21]], True, 24)
# the cerebellum tucked under the back of it, and the stem going down from between them (as on the reference)
CEREBELLUM = catmull([[0.30, 0.40], [0.46, 0.33], [0.66, 0.31], [0.86, 0.30], [0.95, 0.38], [0.90, 0.50], [0.74, 0.60], [0.54, 0.63], [0.38, 0.58], [0.29, 0.49]], True, 20)
STEM = catmull([[0.14, 0.47], [0.31, 0.43], [0.34, 0.55], [0.36, 0.68], [0.34, 0.78], [0.27, 0.79], [0.23, 0.68], [0.19, 0.57]], True, 16)   # short and tapering, half behind the cerebellum
# the lateral fissure: the one long fold everybody knows, between the temporal lobe and the rest
FISSURE = catmull([[-0.58, 0.24], [-0.30, 0.15], [0.02, 0.07], [0.30, -0.01], [0.48, -0.12]], False, 30)


def inside(poly, x, y):
    """Ray casting, vectorised over x, y."""
    c = np.zeros(x.shape, bool)
    n = len(poly)
    for i in range(n):
        ax, ay = poly[i]; bx, by = poly[(i + 1) % n]
        cond = ((ay > y) != (by > y)) & (x < (bx - ax) * (y - ay) / (by - ay + 1e-12) + ax)
        c ^= cond
    return c


def dist_to(pts, curve):
    """Distance from each point to the nearest point of a densely sampled curve."""
    d = np.full(len(pts), 9.0)
    for i in range(0, len(curve), 64):
        seg = curve[i:i + 64]
        dd = np.sqrt(((pts[:, None, :] - seg[None, :, :]) ** 2).sum(-1)).min(1)
        d = np.minimum(d, dd)
    return d


def dense(curve, step=0.002):
    """Resample a polyline densely."""
    out = []
    for i in range(len(curve) - 1):
        a, b = curve[i], curve[i + 1]
        n = max(1, int(math.hypot(*(b - a)) / step))
        for k in range(n):
            out.append(a + (b - a) * k / n)
    return np.array(out)


def field(X, Y, lam, seed, aniso=None, waves=360):
    """Band-pass noise: waves of one length (lam, a little spread) in every direction (or round one, with aniso)."""
    rng = np.random.default_rng(seed)
    f = np.zeros_like(X)
    for _ in range(waves):
        th = rng.uniform(0, math.pi) if aniso is None else rng.normal(aniso[0], aniso[1])
        k = 2 * math.pi / (lam * rng.uniform(0.88, 1.12))
        f += np.cos(k * (math.cos(th) * X + math.sin(th) * Y) + rng.uniform(0, 2 * math.pi))
    return f


def zero_lines(X, Y, F):
    """The points where the field crosses zero, on the grid's edges (a light marching squares)."""
    pts = []
    for (a, b, xa, xb, ya, yb) in ((F[:, :-1], F[:, 1:], X[:, :-1], X[:, 1:], Y[:, :-1], Y[:, 1:]), (F[:-1, :], F[1:, :], X[:-1, :], X[1:, :], Y[:-1, :], Y[1:, :])):
        m = np.sign(a) != np.sign(b)
        t = a[m] / (a[m] - b[m] + 1e-12)
        pts.append(np.stack([xa[m] + (xb[m] - xa[m]) * t, ya[m] + (yb[m] - ya[m]) * t], 1))
    return np.concatenate(pts)


def label(pts, link):
    """Connected runs: points closer than link share a label (union-find on a grid). A fold is one run."""
    par = list(range(len(pts)))
    def find(i):
        while par[i] != i:
            par[i] = par[par[i]]; i = par[i]
        return i
    grid = {}
    for i, (x, y) in enumerate(pts):
        grid.setdefault((int(math.floor(x / link)), int(math.floor(y / link))), []).append(i)
    for (gx, gy), idx in grid.items():
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for j in grid.get((gx + dx, gy + dy), ()):
                    for i in idx:
                        if i < j and (pts[i][0] - pts[j][0]) ** 2 + (pts[i][1] - pts[j][1]) ** 2 < link * link:
                            a, b = find(i), find(j)
                            if a != b:
                                par[a] = b
    return np.array([find(i) for i in range(len(pts))])


def thin(pts, s, seed, idx=False):
    """Keep points at least s apart (greedy, in a shuffled order, with a grid for speed)."""
    rng = np.random.default_rng(seed)
    order = rng.permutation(len(pts))
    cell = s / math.sqrt(2); grid = {}; keep = []
    for i in order:
        x, y = pts[i]; gx, gy = int(math.floor(x / cell)), int(math.floor(y / cell)); ok = True
        for dx in range(-2, 3):
            for dy in range(-2, 3):
                j = grid.get((gx + dx, gy + dy))
                if j is not None and (pts[j][0] - x) ** 2 + (pts[j][1] - y) ** 2 < s * s:
                    ok = False; break
            if not ok:
                break
        if ok:
            grid[(gx, gy)] = i; keep.append(i)
    return (pts[keep], np.array(keep, int)) if idx else pts[keep]


def shades(pts, s, kept, link, seed, green):
    """One shade per fold (main.js INK: 1 dark, 0 green): dark, as the reference is one colour, with a share of the folds
    in the site's green. Green goes to the smaller and middle folds (never the few biggest, which would read as a patch),
    each to the side furthest below its share."""
    lab = label(pts, link)[kept]
    u, cnt = np.unique(lab, return_counts=True)
    rng = np.random.default_rng(seed)
    order = sorted(range(len(u)), key=lambda i: (-cnt[i], rng.random()))
    big = set(order[:max(1, len(order) // 8)]); got = {1: 0, 0: 0}; pick = {}
    for i in order:
        tot = sum(got.values()) + cnt[i]
        c = 1 if i in big else (0 if (got[0] + cnt[i]) / tot - green < (got[1] + cnt[i]) / tot - (1 - green) else 1)
        pick[u[i]] = c; got[c] += cnt[i]
    return [pick[L] for L in lab]


def build(lam, s, seed):
    h = 0.0035
    xs = np.arange(-1.08, 1.08, h); ys = np.arange(-0.80, 0.95, h)
    X, Y = np.meshgrid(xs, ys)
    out = []
    # the outlines, a little denser than the folds, as on the reference
    for curve, kind in ((CEREBRUM, 0), (CEREBELLUM, 0), (STEM, 0)):
        c = dense(np.vstack([curve, curve[:1]]))
        out += [(x, y, kind, 1) for x, y in thin(c, s * 0.82, seed + kind)]   # the outlines dark, as a silhouette
    fis = dense(FISSURE)
    out += [(x, y, 1, 1) for x, y in thin(fis, s * 0.9, seed + 7)]
    ocb, occ, ost = dense(np.vstack([CEREBRUM, CEREBRUM[:1]])), dense(np.vstack([CEREBELLUM, CEREBELLUM[:1]])), dense(np.vstack([STEM, STEM[:1]]))
    # the cerebrum's folds: winding, every which way
    z = zero_lines(X, Y, field(X, Y, lam, seed))
    m = inside(CEREBRUM, z[:, 0], z[:, 1]); z = z[m]
    z = z[(dist_to(z, ocb) > s * 1.3) & (dist_to(z, fis) > s * 1.6)]
    k, ki = thin(z, s, seed + 11, True)
    out += [(x, y, 1, c) for (x, y), c in zip(k, shades(z, s, ki, h * 2.2, seed + 12, 0.24))]
    # the cerebellum: fine folds lying across it, as its folia do
    z = zero_lines(X, Y, field(X, Y, lam * 0.62, seed + 21, aniso=(math.pi / 2 - 0.12, 0.22)))
    m = inside(CEREBELLUM, z[:, 0], z[:, 1]) & ~inside(CEREBRUM, z[:, 0], z[:, 1]); z = z[m]
    z = z[dist_to(z, occ) > s * 1.2]
    k, ki = thin(z, s * 0.95, seed + 23, True)
    out += [(x, y, 2, c) for (x, y), c in zip(k, shades(z, s, ki, h * 2.2, seed + 24, 0.3))]
    # the stem: a few lines running down it
    z = zero_lines(X, Y, field(X, Y, lam * 0.8, seed + 31, aniso=(0.25, 0.15)))
    m = inside(STEM, z[:, 0], z[:, 1]) & ~inside(CEREBRUM, z[:, 0], z[:, 1]) & ~inside(CEREBELLUM, z[:, 0], z[:, 1]); z = z[m]
    z = z[dist_to(z, ost) > s * 1.2]
    k, ki = thin(z, s, seed + 33, True)
    out += [(x, y, 3, c) for (x, y), c in zip(k, shades(z, s, ki, h * 2.2, seed + 34, 0.0))]
    # loose dots under it, drifting off (the reference has them too)
    rng = np.random.default_rng(seed + 41)
    for _ in range(int(110 * (0.017 / s))):
        x = rng.uniform(-0.95, 1.0); y = rng.uniform(0.4, 0.86) if rng.random() < 0.7 else rng.uniform(-0.8, 0.8)   # close to the brain, not over the text under it
        if not (inside(CEREBRUM, np.array([x]), np.array([y]))[0] or inside(CEREBELLUM, np.array([x]), np.array([y]))[0] or inside(STEM, np.array([x]), np.array([y]))[0]):
            out.append((x, y, 4, 2))
    rng.shuffle(out)
    return [[round(float(x), 3), round(float(y), 3), int(k), int(c)] for x, y, k, c in out]


if __name__ == '__main__':
    desk = build(lam=0.104, s=0.0175, seed=1015)    # a fold about as wide as on the reference
    phone = build(lam=0.165, s=0.029, seed=2015)
    kinds = lambda P: ({k: sum(1 for p in P if p[2] == k) for k in range(5)}, {c: sum(1 for p in P if p[3] == c) for c in range(3)})
    with open(OUT, 'w') as f:
        f.write('/* the brain as dots along the outlines of its folds (3d/brain_points.py, v59); [x, y, kind, shade]: kind 0 outline,\n'
                '   1 fold, 2 cerebellum, 3 stem, 4 loose; shade 0 green, 1 dark, 2 light grey. d: a desktop, m: a phone */\n')
        f.write('window.EMBER_BRAIN = ' + json.dumps({'d': desk, 'm': phone}, separators=(',', ':')) + ';\n')
    print('desktop', len(desk), kinds(desk), '| phone', len(phone), kinds(phone))
