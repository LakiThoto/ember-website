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


def swift(rmap, h, lam, seed, steps=420, r0=0.35, dt=0.4, quench=0.0):
    """Swift-Hohenberg: du/dt = r u - (1 + lap)^2 u - u^3, in units where the stripes' wavelength is lam. It settles
    into a maze of even stripes, the way gyri lie; where r is below zero (outside the brain, along the fissure) it dies
    out, and the stripes nearby turn to follow that edge. Semi-implicit in Fourier space."""
    k0 = 2 * math.pi / lam
    ny, nx = rmap.shape
    KX, KY = np.meshgrid(2 * math.pi * np.fft.fftfreq(nx, d=h) / k0, 2 * math.pi * np.fft.fftfreq(ny, d=h) / k0)
    L = r0 - (1 - (KX ** 2 + KY ** 2)) ** 2
    rg = np.random.default_rng(seed)
    u = 0.05 * rg.standard_normal(rmap.shape)
    rd = rmap - r0
    if quench:                                   # a fixed, lumpy unevenness in r: the maze keeps its bends and forks
        q = np.real(np.fft.ifft2(np.fft.fft2(rg.standard_normal(rmap.shape)) * np.exp(-((KX ** 2 + KY ** 2) / 0.35))))
        rd = rd + quench * q / (q.std() + 1e-9) * (rmap > 0)
    for _ in range(steps):
        uh = (np.fft.fft2(u) + dt * np.fft.fft2(rd * u - u ** 3)) / (1 - dt * L)
        u = np.real(np.fft.ifft2(uh))
    return u


def build(lam, s, band, seed, steps=420, quench=0.0):
    """v59b, after the second reference (15 Oct): the gyri as bands of dots about three wide, with white sulci between,
    lying as a maze (Swift-Hohenberg). The edge of the cerebrum is a band too, so the silhouette is closed; the lateral
    fissure a clean gap; the cerebellum in thin folia that follow its outline; the stem filled. Dots are packed at spacing
    s, each with its own shade (darker in the middle of a band, lighter at its edges, as on the reference). No loose dots."""
    h = min(0.005, s / 3.2)
    xs = np.arange(-1.12, 1.12, h); ys = np.arange(-0.84, 0.98, h)
    X, Y = np.meshgrid(xs, ys)
    rng = np.random.default_rng(seed)
    G = np.stack([X.ravel(), Y.ravel()], 1)
    x, y = G[:, 0], G[:, 1]
    inCb, inCc, inSt = inside(CEREBRUM, x, y), inside(CEREBELLUM, x, y), inside(STEM, x, y)
    inCc &= ~inCb; inSt &= ~inCb & ~inCc
    cb = dense(np.vstack([CEREBRUM, CEREBRUM[:1]])); fis = dense(FISSURE); cc = dense(np.vstack([CEREBELLUM, CEREBELLUM[:1]]))
    eB = np.full(len(G), 9.0); eB[inCb] = dist_to(G[inCb], cb)
    eF = np.full(len(G), 9.0); eF[inCb] = dist_to(G[inCb], fis)
    eC = np.full(len(G), 9.0); eC[inCc] = dist_to(G[inCc], cc)
    gap = (lam - 2 * band) / 2 + band * 0.25                      # about a sulcus wide
    # the maze: alive inside the cerebrum, past the edge band and its sulcus, away from the fissure
    alive = inCb & (eB > band + gap * 0.6) & (eF > gap * 0.75)
    U = swift(np.where(alive, 0.35, -1.2).reshape(X.shape), h, lam, seed, steps=steps, quench=quench).ravel()
    umax = np.percentile(U[alive], 98)
    th = umax * 0.12
    pts, kinds, rel = [], [], []

    def take(mask, k, r):
        pts.append(G[mask]); kinds.append(np.full(mask.sum(), k)); rel.append(r[mask])

    edge = inCb & (eB < band)
    fold = alive & (U > th)
    take(edge, 0, np.abs(eB - band / 2) / (band / 2)); take(fold, 1, 1 - np.clip((U - th) / (umax - th), 0, 1))
    # the cerebellum: an edge, then folia following its outline
    pc, bc = lam * 0.42, band * 0.45
    take(inCc & (eC < bc * 1.4), 2, np.abs(eC - bc * 0.7) / (bc * 0.7))
    fol = inCc & (eC >= bc * 1.4 + pc * 0.3) & (np.mod(eC - bc * 1.4, pc) > pc - bc)
    take(fol, 2, np.full(len(G), 0.5))
    # the stem: filled, lighter towards its foot
    take(inSt, 3, np.clip((y - 0.45) / 0.35, 0, 1))
    pts, kinds, rel = np.concatenate(pts), np.concatenate(kinds), np.concatenate(rel)
    pts = pts + rng.uniform(-h / 2, h / 2, pts.shape)             # off the grid, so the packing is not in rows

    # pack: keep points at least s apart; the middle of each band first, so the bands keep their middle line
    order = np.argsort(rel * 0.7 + rng.random(len(pts)) * 0.6)
    pts, kinds, rel = pts[order], kinds[order], rel[order]
    cell = s / math.sqrt(2); grid = {}; keep = []
    for i in range(len(pts)):
        px, py = pts[i]; gx, gy = int(math.floor(px / cell)), int(math.floor(py / cell)); ok = True
        for dx in range(-2, 3):
            for dy in range(-2, 3):
                j = grid.get((gx + dx, gy + dy))
                if j is not None and (pts[j][0] - px) ** 2 + (pts[j][1] - py) ** 2 < s * s:
                    ok = False; break
            if not ok:
                break
        if ok:
            grid[(gx, gy)] = i; keep.append(i)
    out = []
    for i in keep:
        r0 = min(1.0, float(rel[i]))
        pd = 0.62 - 0.34 * r0                     # dark: more in the middle of a band
        pg = 0.2                                  # the site's green
        u = rng.random()
        c = 1 if u < pd else 0 if u < pd + pg else 2
        out.append([round(float(pts[i][0]), 3), round(float(pts[i][1]), 3), int(kinds[i]), c])
    rng.shuffle(out)
    return out


if __name__ == '__main__':
    # (lam, s, band): from one gyrus to the next, the spacing of the dots, the width of the edge band; the phone's coarser, so its
    # folds stay open at a third of the size
    D = dict(lam=0.15, s=0.019, band=0.066, seed=1015, steps=90)    # chosen from a few seeds: the most brain-like maze
    M = dict(lam=0.22, s=0.032, band=0.096, seed=2018, steps=70)
    desk, phone = build(**{k: v for k, v in D.items()}), build(**{k: v for k, v in M.items()})
    kinds = lambda P: ({k: sum(1 for p in P if p[2] == k) for k in range(4)}, {c: sum(1 for p in P if p[3] == c) for c in range(3)})
    with open(OUT, 'w') as f:
        f.write('/* the brain as bands of dots along its folds (3d/brain_points.py, v59); [x, y, kind, shade]: kind 0 edge,\n'
                '   1 fold, 2 cerebellum, 3 stem; shade 0 green, 1 dark, 2 light grey. d: a desktop, m: a phone; s: their dot spacing */\n')
        f.write('window.EMBER_BRAIN = ' + json.dumps({'d': desk, 'm': phone, 's': {'d': D['s'], 'm': M['s']}}, separators=(',', ':')) + ';\n')
    print('desktop', len(desk), kinds(desk), '| phone', len(phone), kinds(phone))
