// Podminovač – hra ve stylu Bombermana pro ZX Spectrum sadu (speccy.js).
// Režimy: tažení (10 úrovní), dva hráči proti sobě, hráč proti botům.
(function () {
    'use strict';

    var T = 16, GW = 15, GH = 11, OX = 8, OY = 16, FUSE = 150, FLAME = 30;
    var DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];       // 0 doprava, 1 doleva, 2 dolů, 3 nahoru
    var KEYN = ['r', 'l', 'd', 'u'], GN = ['right', 'left', 'down', 'up'];

    // Vlastní ovládání: hráč 1 WASD+F, hráč 2 šipky+Enter (přebijí obecné akce v sadě)
    var K = Z.keymap;
    K.p1l = [65]; K.p1r = [68]; K.p1u = [87]; K.p1d = [83]; K.p1f = [70];
    K.p2l = [37]; K.p2r = [39]; K.p2u = [38]; K.p2d = [40]; K.p2f = [13];
    Z.rebuildKeys();

    var G = window.GAME = { state: 'title', mode: 'story', t: 0, st: 0, menu: 0, score: 0, lives: 3, level: 1 };
    G.grid = []; G.bombs = []; G.flames = []; G.items = []; G.enemies = []; G.fx = []; G.players = [];

    var LEVELS = [[3, 0, 0, 0], [4, 1, 0, 0], [3, 2, 0, 0], [2, 3, 0, 0], [3, 2, 1, 0],
        [2, 3, 2, 0], [2, 2, 2, 1], [1, 3, 2, 2], [2, 3, 3, 2], [2, 4, 3, 3]];
    var ESPD = [0.5, 0.7, 0.45, 0.95], EPTS = [100, 200, 300, 400];
    var PALS = [{ h: 9, b: 1 }, { h: 10, b: 2 }, { h: 13, b: 5 }, { h: 11, b: 3 }, { h: 14, b: 6 }];
    var ITM = { R: ['F', 10, 15], B: ['B', 9, 15], S: ['S', 13, 0], K: ['K', 11, 15] };

    // ---------- Sprity (znaky: h helma, b tělo, w obličej/rukavice, k černá, p bambule)
    var HEAD_FRONT = ['.....pp.....', '...hhhhhh...', '..hhhhhhhh..', '..hwwwwwwh..', '..hwkwwkwh..', '..hwwwwwwh..', '...hhhhhh...'];
    var HEAD_BACK = ['.....pp.....', '...hhhhhh...', '..hhhhhhhh..', '..hhhhhhhh..', '..hhhhhhhh..', '..hhhhhhhh..', '...hhhhhh...'];
    var HEAD_SIDE = ['.....pp.....', '...hhhhhh...', '..hhhhhhhh..', '..hhwwwwwh..', '..hhwwwkwh..', '..hhwwwwwh..', '...hhhhhh...'];
    var BODY = ['..bbbbbbbb..', '.wbbbbbbbbw.', '.wbbbbbbbbw.', '..bbbbbbbb..', '..bbbbbbbb..'];
    var FEET = [['..bb....bb..', '..kk....kk..'], ['...bb..bb...', '...kk..kk...']];
    var ESPR = [
        ['...mmmmmm...', '..mmmmmmmm..', '.mmwwmmwwmm.', '.mmwkmmwkmm.', '.mmmmmmmmmm.', '.mmmmkkmmmm.', '.mmmmmmmmmm.', '..mmmmmmmm..', '...dmmmmd...', '...dd..dd...'],
        ['...cccccc...', '..cccccccc..', '.cccccccccc.', '.cwwccccwwc.', '.ckwccccwkc.', '.cccccccccc.', '.cckkkkkkcc.', '.ckwkwkwkkc.', '..cccccccc..', '..d.d..d.d..'],
        ['...gggggg...', '..gggggggg..', '.gggggggggg.', '.ggbbggbbgg.', '.ggbbggbbgg.', '.gggggggggg.', '.gggggggggg.', '.gggggggggg.', '.gg.gggg.gg.', '.g...gg...g.'],
        ['.y........y.', '.yy......yy.', '..yyyyyyyy..', '.yyyyyyyyyy.', '.yrwyyyywry.', '.yykyyyykyy.', '.yyyyyyyyyy.', '..yykkkkyy..', '...yyyyyy...', '..yy....yy..']
    ];
    var EPAL = [{ m: 11, d: 3, w: 15, k: 0 }, { c: 13, d: 5, w: 15, k: 0 }, { g: 15, b: 9, s: 7 }, { y: 14, r: 10, w: 15, k: 0 }];
    var BOMB_SPR = ['....XXXX....', '..XXXXXXXX..'];

    function playerRows(face, frame) {
        var head = face === 3 ? HEAD_BACK : face < 2 ? HEAD_SIDE : HEAD_FRONT;
        return head.concat(BODY, FEET[frame]);
    }

    // ---------- Pomůcky
    function rnd(n) { return Math.floor(Math.random() * n); }
    function cellX(e) { return Z.clamp(Math.floor((e.x + 8) / T), 0, GW - 1); }
    function cellY(e) { return Z.clamp(Math.floor((e.y + 8) / T), 0, GH - 1); }
    function anyHit(list) { return list.some(function (a) { return Z.input.hit(a); }); }
    function fireHit() { return anyHit(['fire', 'p1f', 'p2f']); }
    function bombCellObj(c, r) {
        for (var i = 0; i < G.bombs.length; i++) {
            var b = G.bombs[i];
            if (Math.round(b.x / T) === c && Math.round(b.y / T) === r) { return b; }
        }
        return null;
    }
    function bombAt(c, r) { return !!bombCellObj(c, r); }

    // Ovládání hráče: i 0..3 směr, 4 oheň; fn 'down' | 'hit'
    function ctl(p, i, fn) {
        var gen = i < 4 ? GN[i] : 'fire', k = i < 4 ? KEYN[i] : 'f', I = Z.input;
        var a = I[fn](gen), b = I[fn]('p1' + k), c = I[fn]('p2' + k);
        if (G.mode === 'duel') { return p.ctrl === 1 ? (a || b) : c; }
        return a || b || c;
    }

    // ---------- Generování světa
    function mkGrid(rng, dens, safe) {
        var g = [];
        for (var r = 0; r < GH; r++) {
            for (var c = 0; c < GW; c++) {
                g.push(c % 2 === 1 && r % 2 === 1 ? 1 : (rng() < dens ? 2 : 0));
            }
        }
        safe.forEach(function (s) { g[s[1] * GW + s[0]] = 0; });
        return g;
    }
    function cornerSafe(c, r) { return [[c, r], [c + (c ? -1 : 1), r], [c, r + (r ? -1 : 1)]]; }

    function mkPlayer(id, c, r, human, ctrl) {
        return {
            id: id, x: c * T, y: r * T, tc: -1, tr: -1, human: human, ctrl: ctrl, alive: true,
            range: 2, maxB: 1, spd: 1, kick: false, out: 0, face: 2, moving: false, anim: 0, inv: 0,
            last: null, wait: 0, pal: PALS[id]
        };
    }

    function resetWorld() {
        G.bombs = []; G.flames = []; G.items = []; G.enemies = []; G.fx = []; G.players = [];
        G.exit = null; G.hidden = {}; G.endT = 0;
    }

    function startLevel() {
        resetWorld();
        var L = LEVELS[Math.min(G.level, LEVELS.length) - 1], rng = Z.rng(G.level * 7919 + 13);
        G.grid = mkGrid(rng, Math.min(0.62, 0.48 + 0.02 * G.level), cornerSafe(0, 0));
        var p = mkPlayer(0, 0, 0, true, 0), s = G.stats;
        p.range = s.range; p.maxB = s.maxB; p.spd = s.spd; p.kick = s.kick; p.inv = 100;
        G.players = [p];
        var blocks = [], i;
        for (i = 0; i < G.grid.length; i++) { if (G.grid[i] === 2) { blocks.push(i); } }
        function pick(filter) {
            var cand = blocks.filter(filter);
            if (!cand.length) { cand = blocks.slice(); }
            var ix = cand[Math.floor(rng() * cand.length)];
            blocks.splice(blocks.indexOf(ix), 1);
            return ix;
        }
        var ex = pick(function (ix) { return (ix % GW) + Math.floor(ix / GW) >= 10; });
        G.exit = { c: ex % GW, r: Math.floor(ex / GW), shown: false, shownT: 0, cool: 0 };
        var nItems = 4 + (G.level <= 4 ? 1 : 0), types = 'RRRBBBSSK';
        for (i = 0; i < nItems; i++) { G.hidden[pick(function () { return true; })] = types.charAt(Math.floor(rng() * types.length)); }
        // nepřátelé: buňky dost daleko od startu, neobsazené východem či bonusem
        var cells = [];
        for (i = 0; i < G.grid.length; i++) {
            var c = i % GW, r = Math.floor(i / GW);
            if (G.grid[i] !== 1 && c + r >= 8 && i !== ex && !G.hidden[i]) { cells.push(i); }
        }
        for (i = cells.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), t = cells[i]; cells[i] = cells[j]; cells[j] = t; }
        var n = 0;
        L.forEach(function (cnt, type) {
            for (var k = 0; k < cnt; k++) {
                var ix = cells[n++];
                G.grid[ix] = 0;
                spawnEnemy(type, ix % GW, Math.floor(ix / GW));
            }
        });
        G.time = (200 - 5 * (G.level - 1)) * 50;
        G.state = 'intro'; G.st = 0;
    }

    function spawnEnemy(type, c, r) {
        G.enemies.push({ type: type, x: c * T, y: r * T, tc: -1, tr: -1, alive: true, anim: rnd(40), dir: -1 });
    }

    function startRound() {
        resetWorld();
        var rng = Math.random;
        var corners = [[0, 0], [GW - 1, GH - 1], [GW - 1, 0], [0, GH - 1]];
        var n = G.mode === 'duel' ? 2 : 4, safe = [];
        for (var i = 0; i < n; i++) { safe = safe.concat(cornerSafe(corners[i][0], corners[i][1])); }
        G.grid = mkGrid(rng, 0.62, safe);
        for (i = 0; i < n; i++) {
            var human = G.mode === 'duel' || i === 0;
            G.players.push(mkPlayer(i, corners[i][0], corners[i][1], human, i === 0 ? 1 : 2));
        }
        G.time = 120 * 50;
        G.state = 'intro'; G.st = 0;
    }

    function startMode(mode) {
        G.mode = mode; G.t = 0;
        if (mode === 'story') {
            G.score = 0; G.lives = 3; G.level = 1; G.nextLife = 10000;
            G.stats = { range: 2, maxB: 1, spd: 1, kick: false };
            startLevel();
        } else {
            G.wins = [0, 0]; G.botWins = 0; G.round = 1; startRound();
        }
    }

    // ---------- Výbuchy
    function blastCells(c, r, range) {
        var out = [r * GW + c], k, d;
        for (k = 0; k < 4; k++) {
            for (d = 1; d <= range; d++) {
                var nc = c + DX[k] * d, nr = r + DY[k] * d;
                if (nc < 0 || nr < 0 || nc >= GW || nr >= GH) { break; }
                var g = G.grid[nr * GW + nc];
                if (g === 1) { break; }
                out.push(nr * GW + nc);
                if (g === 2 || bombAt(nc, nr)) { break; }
            }
        }
        return out;
    }

    function addFlame(c, r, owner) { G.flames.push({ c: c, r: r, t: FLAME, owner: owner }); }

    function destroyBlock(ix, c, r) {
        G.grid[ix] = 0;
        if (G.mode === 'story') { addScore(10); }
        pop(c * T + 8, r * T + 8, 8);
        if (G.exit && G.exit.c === c && G.exit.r === r) { G.exit.shown = true; }
        var type = G.hidden[ix];
        if (!type && G.mode !== 'story' && Math.random() < 0.24) { type = 'RRBBSK'.charAt(rnd(6)); }
        if (type) { G.items.push({ c: c, r: r, type: type, age: 0 }); delete G.hidden[ix]; }
    }

    function explode(b) {
        var c = Math.round(b.x / T), r = Math.round(b.y / T), k, d;
        b.owner.out = Math.max(0, b.owner.out - 1);
        Z.snd.boom();
        addFlame(c, r, b.owner);
        for (k = 0; k < 4; k++) {
            for (d = 1; d <= b.range; d++) {
                var nc = c + DX[k] * d, nr = r + DY[k] * d;
                if (nc < 0 || nr < 0 || nc >= GW || nr >= GH) { break; }
                var ix = nr * GW + nc, g = G.grid[ix];
                if (g === 1) { break; }
                addFlame(nc, nr, b.owner);
                if (g === 2) { destroyBlock(ix, nc, nr); break; }
                var ob = bombCellObj(nc, nr);
                if (ob) { ob.t = 0; break; }
            }
        }
    }

    function pop(x, y, n) { G.fx.push({ x: x, y: y, t: 0, n: n || 10 }); }

    function addScore(n) {
        G.score += n;
        while (G.score >= G.nextLife) { G.nextLife += 10000; G.lives++; Z.snd.win(); }
    }

    // ---------- Bomby
    function placeBomb(p) {
        var c = cellX(p), r = cellY(p);
        if (!p.alive || p.out >= p.maxB || bombAt(c, r) || G.grid[r * GW + c] !== 0) { return false; }
        var b = { x: c * T, y: r * T, t: FUSE, range: p.range, owner: p, walk: [], dx: 0, dy: 0 };
        G.players.forEach(function (q) {
            if (q.alive && q.human && Z.hit(q.x + 2, q.y + 2, 12, 12, b.x, b.y, T, T)) { b.walk.push(q); }
        });
        G.bombs.push(b); p.out++;
        Z.snd.beep(160, 0.07, 90, 0.05);
        return true;
    }

    function entityIn(c, r) {
        var hit = false;
        G.players.forEach(function (q) { if (q.alive && Z.hit(q.x + 2, q.y + 2, 12, 12, c * T, r * T, T, T)) { hit = true; } });
        G.enemies.forEach(function (e) { if (e.alive && Z.hit(e.x + 2, e.y + 2, 12, 12, c * T, r * T, T, T)) { hit = true; } });
        return hit;
    }
    function bombFree(c, r, self) {
        if (c < 0 || r < 0 || c >= GW || r >= GH || G.grid[r * GW + c] !== 0) { return false; }
        var ob = bombCellObj(c, r);
        if (ob && ob !== self) { return false; }
        return !entityIn(c, r);
    }
    function kick(b, dx, dy) {
        if (b.dx || b.dy) { return; }
        if (b.x % T !== 0 || b.y % T !== 0) { return; }
        if (!bombFree(b.x / T + dx, b.y / T + dy, b)) { return; }
        b.dx = dx; b.dy = dy; Z.snd.beep(500, 0.05, 250, 0.04);
    }

    function updBombs() {
        G.bombs.forEach(function (b) {
            b.t--;
            b.walk = b.walk.filter(function (q) { return q.alive && Z.hit(q.x + 2, q.y + 2, 12, 12, b.x, b.y, T, T); });
            if (b.dx || b.dy) {
                if (b.x % T === 0 && b.y % T === 0 && !bombFree(b.x / T + b.dx, b.y / T + b.dy, b)) { b.dx = b.dy = 0; }
                if (b.dx || b.dy) { b.x += b.dx * 2; b.y += b.dy * 2; }
            }
        });
        for (var guard = 0; guard < 40; guard++) {
            var ex = null;
            for (var i = 0; i < G.bombs.length; i++) { if (G.bombs[i].t <= 0) { ex = G.bombs[i]; break; } }
            if (!ex) { break; }
            G.bombs.splice(G.bombs.indexOf(ex), 1);
            explode(ex);
        }
    }

    function killPlayer(p, why, owner) {
        if (!p.alive || p.inv > 0) { return; }
        G.cause = why; G.killer = owner; p.deathBy = why === 'flame' ? (owner === p ? 'self' : 'other') : why;
        p.alive = false;
        pop(p.x + 8, p.y + 8, 14);
        Z.snd.die();
        if (G.mode === 'story') { G.state = 'dying'; G.st = 0; }
    }
    function killEnemy(e) {
        if (!e.alive) { return; }
        e.alive = false; addScore(EPTS[e.type]); pop(e.x + 8, e.y + 8, 10); Z.snd.hit();
    }

    function updFlames() {
        G.flames.forEach(function (f) {
            var fx = f.c * T + 1, fy = f.r * T + 1;
            G.players.forEach(function (p) { if (p.alive && Z.hit(p.x + 4, p.y + 4, 8, 8, fx, fy, 14, 14)) { killPlayer(p, 'flame', f.owner); } });
            G.enemies.forEach(function (e) { if (e.alive && Z.hit(e.x + 4, e.y + 4, 8, 8, fx, fy, 14, 14)) { killEnemy(e); } });
            G.items = G.items.filter(function (it) {
                if (it.age >= FLAME + 10 && it.c === f.c && it.r === f.r) { pop(it.c * T + 8, it.r * T + 8, 6); return false; }
                return true;
            });
            var x = G.exit;
            if (x && x.shown && x.c === f.c && x.r === f.r && x.shownT > FLAME + 10 && x.cool <= 0 && G.mode === 'story') {
                spawnEnemy(0, x.c, x.r); x.cool = 150;
            }
            f.t--;
        });
        G.flames = G.flames.filter(function (f) { return f.t > 0; });
    }

    // ---------- Pohyb hráče (volný, s klouzáním po rozích)
    function blocker(p, nx, ny) {
        var l = nx + 2, t = ny + 2, rg = nx + 13.99, bt = ny + 13.99;
        if (l < 0 || t < 0 || rg >= GW * T || bt >= GH * T) { return { w: 1 }; }
        var c0 = Math.floor(l / T), c1 = Math.floor(rg / T), r0 = Math.floor(t / T), r1 = Math.floor(bt / T), c, r;
        for (r = r0; r <= r1; r++) { for (c = c0; c <= c1; c++) { if (G.grid[r * GW + c] !== 0) { return { w: 1 }; } } }
        for (var i = 0; i < G.bombs.length; i++) {
            var b = G.bombs[i];
            if (b.walk.indexOf(p) < 0 && Z.hit(l, t, 12, 12, b.x, b.y, T, T)) { return { bomb: b }; }
        }
        return null;
    }
    function cellOpen(p, c, r) {
        if (c < 0 || r < 0 || c >= GW || r >= GH || G.grid[r * GW + c] !== 0) { return false; }
        var b = bombCellObj(c, r);
        return !b || b.walk.indexOf(p) >= 0;
    }
    function stepMove(p, dx, dy, s) {
        var nx = p.x + dx * s, ny = p.y + dy * s, bl = blocker(p, nx, ny);
        if (!bl) { p.x = nx; p.y = ny; p.moving = true; return; }
        if (bl.bomb && p.kick) { kick(bl.bomb, dx, dy); }
        var a0, a1, ahead, f0, f1, tg;
        if (dx !== 0) {
            a0 = Math.floor((p.y + 2) / T); a1 = Math.floor((p.y + 13.99) / T);
            if (a0 !== a1) {
                ahead = Math.floor((dx > 0 ? p.x + 13.99 + s : p.x + 2 - s) / T);
                f0 = cellOpen(p, ahead, a0); f1 = cellOpen(p, ahead, a1);
                tg = f0 && !f1 ? a0 : (f1 && !f0 ? a1 : -1);
                if (tg >= 0) { nudge(p, 0, tg * T - p.y, s); }
            }
        } else {
            a0 = Math.floor((p.x + 2) / T); a1 = Math.floor((p.x + 13.99) / T);
            if (a0 !== a1) {
                ahead = Math.floor((dy > 0 ? p.y + 13.99 + s : p.y + 2 - s) / T);
                f0 = cellOpen(p, a0, ahead); f1 = cellOpen(p, a1, ahead);
                tg = f0 && !f1 ? a0 : (f1 && !f0 ? a1 : -1);
                if (tg >= 0) { nudge(p, tg * T - p.x, 0, s); }
            }
        }
    }
    function nudge(p, ddx, ddy, s) {
        var mx = Math.sign(ddx) * Math.min(s, Math.abs(ddx)), my = Math.sign(ddy) * Math.min(s, Math.abs(ddy));
        if (!blocker(p, p.x + mx, p.y + my)) { p.x += mx; p.y += my; p.moving = true; }
    }

    function pickup(p) {
        var c = cellX(p), r = cellY(p);
        for (var i = 0; i < G.items.length; i++) {
            var it = G.items[i];
            if (it.c === c && it.r === r) {
                G.items.splice(i, 1);
                if (it.type === 'R') { p.range = Math.min(8, p.range + 1); }
                if (it.type === 'B') { p.maxB = Math.min(6, p.maxB + 1); }
                if (it.type === 'S') { p.spd = Math.min(2, Math.round((p.spd + 0.2) * 10) / 10); }
                if (it.type === 'K') { p.kick = true; }
                if (G.mode === 'story') { addScore(50); }
                Z.snd.coin();
                return;
            }
        }
    }

    function updHuman(p) {
        p.anim++; if (p.inv > 0) { p.inv--; }
        var i;
        for (i = 0; i < 4; i++) { if (ctl(p, i, 'hit')) { p.last = i; } }
        if (p.last !== null && !ctl(p, p.last, 'down')) {
            p.last = null;
            for (i = 0; i < 4; i++) { if (ctl(p, i, 'down')) { p.last = i; break; } }
        }
        p.moving = false;
        if (p.last !== null) {
            p.face = p.last;
            var steps = Math.ceil(p.spd), s = p.spd / steps;
            for (i = 0; i < steps; i++) { stepMove(p, DX[p.last], DY[p.last], s); }
        }
        if (ctl(p, 4, 'hit')) { placeBomb(p); }
        pickup(p);
    }

    // ---------- BFS a AI botů
    function bfs(sc, sr, pass, goal, maxD) {
        var seen = new Uint8Array(GW * GH), q = [[sc, sr, 0, -1]], qi = 0;
        seen[sr * GW + sc] = 1;
        while (qi < q.length) {
            var cur = q[qi++];
            if (cur[2] > 0 && goal(cur[0], cur[1])) { return { c: cur[0], r: cur[1], d: cur[2], first: cur[3] }; }
            if (cur[2] >= maxD) { continue; }
            for (var k = 0; k < 4; k++) {
                var nc = cur[0] + DX[k], nr = cur[1] + DY[k];
                if (nc < 0 || nr < 0 || nc >= GW || nr >= GH || seen[nr * GW + nc]) { continue; }
                if (!pass(nc, nr, cur[2] + 1)) { continue; }
                seen[nr * GW + nc] = 1;
                q.push([nc, nr, cur[2] + 1, cur[3] < 0 ? k : cur[3]]);
            }
        }
        return null;
    }
    function bfsAll(sc, sr, pass, maxD) {
        var seen = new Uint8Array(GW * GH), q = [{ c: sc, r: sr, d: 0, first: -1 }], qi = 0;
        seen[sr * GW + sc] = 1;
        while (qi < q.length) {
            var cur = q[qi++];
            if (cur.d >= maxD) { continue; }
            for (var k = 0; k < 4; k++) {
                var nc = cur.c + DX[k], nr = cur.r + DY[k];
                if (nc < 0 || nr < 0 || nc >= GW || nr >= GH || seen[nr * GW + nc] || !pass(nc, nr, cur.d + 1)) { continue; }
                seen[nr * GW + nc] = 1;
                q.push({ c: nc, r: nr, d: cur.d + 1, first: cur.first < 0 ? k : cur.first });
            }
        }
        return q;
    }
    function botFree(c, r) { return c >= 0 && r >= 0 && c < GW && r < GH && G.grid[r * GW + c] === 0 && !bombAt(c, r); }

    // mapa nebezpečí: počet ticků do zásahu (Infinity = bezpečno)
    function dangerMap() {
        var dg = [], i, j, bs = G.bombs;
        for (i = 0; i < GW * GH; i++) { dg.push(Infinity); }
        var eff = bs.map(function (b) { return b.t; });
        var cells = bs.map(function (b) { return blastCells(Math.round(b.x / T), Math.round(b.y / T), b.range); });
        for (var it = 0; it < 3; it++) {
            for (i = 0; i < bs.length; i++) {
                for (j = 0; j < bs.length; j++) {
                    if (i !== j && eff[i] < eff[j] && cells[i].indexOf(Math.round(bs[j].y / T) * GW + Math.round(bs[j].x / T)) >= 0) { eff[j] = eff[i]; }
                }
            }
        }
        for (i = 0; i < bs.length; i++) { cells[i].forEach(function (ix) { dg[ix] = Math.min(dg[ix], eff[i]); }); }
        G.flames.forEach(function (f) { dg[f.r * GW + f.c] = 0; });
        if (G.mode === 'story') {
            G.enemies.forEach(function (e) {
                if (!e.alive) { return; }
                var c = cellX(e), r = cellY(e);
                for (var dr = -2; dr <= 2; dr++) {
                    for (var dc = -2; dc <= 2; dc++) {
                        var md = Math.abs(dr) + Math.abs(dc), nc = c + dc, nr = r + dr;
                        if (md > 2 || nc < 0 || nr < 0 || nc >= GW || nr >= GH) { continue; }
                        dg[nr * GW + nc] = Math.min(dg[nr * GW + nc], md <= 1 ? 0 : 30);
                    }
                }
            });
        }
        return dg;
    }

    // Rozhodnutí bota (i pomocný autopilot pro testy): { dir: -1..3, bomb: bool }
    function botThink(p) {
        var c = cellX(p), r = cellY(p), dg = dangerMap(), stepT = T / p.spd, story = G.mode === 'story', k;
        var here = dg[r * GW + c];
        function pass(cc, rr, d) { return botFree(cc, rr) && dg[rr * GW + cc] > (d + 1) * stepT + 6; }
        if (here < Infinity) {
            var fl = bfs(c, r, pass, function (cc, rr) { return dg[rr * GW + cc] === Infinity; }, 12);
            if (fl) { return { dir: fl.first, bomb: false }; }
            var bd = -1, bv = here;
            for (k = 0; k < 4; k++) {
                var nc = c + DX[k], nr = r + DY[k];
                if (botFree(nc, nr) && dg[nr * GW + nc] > bv) { bv = dg[nr * GW + nc]; bd = k; }
            }
            return { dir: bd, bomb: false };
        }
        var foes = story ? G.enemies.filter(function (e) { return e.alive; }) : G.players.filter(function (q) { return q !== p && q.alive; });
        var foeAt = {};
        foes.forEach(function (f) { foeAt[cellY(f) * GW + cellX(f)] = 1; });
        function adjBlock(cc, rr) {
            for (var kk = 0; kk < 4; kk++) {
                var ac = cc + DX[kk], ar = rr + DY[kk];
                if (ac >= 0 && ar >= 0 && ac < GW && ar < GH && G.grid[ar * GW + ac] === 2) { return true; }
            }
            return false;
        }
        var canBomb = p.out < p.maxB && !bombAt(c, r);
        if (canBomb) {
            var H = blastCells(c, r, p.range), hset = {}, useful = false;
            H.forEach(function (ix) { hset[ix] = 1; if (G.grid[ix] === 2 || foeAt[ix]) { useful = true; } });
            if (useful) {
                var md = Math.max(2, Math.min(9, Math.floor(110 / stepT)));
                var esc = bfs(c, r, pass, function (cc, rr) { return !hset[rr * GW + cc] && dg[rr * GW + cc] === Infinity; }, md);
                if (esc) { return { dir: -1, bomb: true }; }
            }
        }
        if (adjBlock(c, r) && p.out >= p.maxB) { return { dir: -1, bomb: false }; }
        var itemAt = {};
        G.items.forEach(function (it) { itemAt[it.r * GW + it.c] = 1; });
        var res = bfs(c, r, pass, function (cc, rr) { return !!itemAt[rr * GW + cc]; }, 10);
        if (!res && story && G.exit && G.exit.shown && !foes.length) {
            res = bfs(c, r, pass, function (cc, rr) { return cc === G.exit.c && rr === G.exit.r; }, 60);
        }
        if (!res && !story) {
            res = bfs(c, r, pass, function (cc, rr) { return !!foeAt[rr * GW + cc]; }, 40);
        }
        if (!res && story && foes.length && p.out < p.maxB && (G.t & 64)) {
            res = bfs(c, r, pass, function (cc, rr) {
                return foes.some(function (f) {
                    var fc = cellX(f), fr = cellY(f), d = Math.abs(fc - cc) + Math.abs(fr - rr);
                    return (fc === cc || fr === rr) && d >= 1 && d <= p.range;
                });
            }, 30);
        }
        if (!res && !story && foes.length) {
            // zeď mezi mnou a soupeřem: prorážej bloky směrem k němu
            var best = null, bs = 1e9;
            bfsAll(c, r, pass, 60).forEach(function (n) {
                if (n.d < 1 || !adjBlock(n.c, n.r)) { return; }
                var fd = 99;
                foes.forEach(function (f) { fd = Math.min(fd, Math.abs(cellX(f) - n.c) + Math.abs(cellY(f) - n.r)); });
                var sc = fd * 1.5 + n.d * 0.5;
                if (sc < bs) { bs = sc; best = n; }
            });
            res = best;
        }
        if (!res) { res = bfs(c, r, pass, adjBlock, 60); }
        return { dir: res ? res.first : -1, bomb: false };
    }

    function updBot(p) {
        p.anim++; if (p.inv > 0) { p.inv--; }
        p.moving = false;
        if (p.tc < 0) {
            if (p.wait > 0) { p.wait--; }
            else {
                var th = botThink(p), n = 0;
                while (th.bomb && n++ < 2) { placeBomb(p); th = botThink(p); }
                if (th.dir >= 0) { p.tc = cellX(p) + DX[th.dir]; p.tr = cellY(p) + DY[th.dir]; p.face = th.dir; }
                else { p.wait = G.bombs.length ? 2 : 4 + rnd(8); }
            }
        }
        if (p.tc >= 0) {
            var tx = p.tc * T, ty = p.tr * T, d = Math.abs(tx - p.x) + Math.abs(ty - p.y);
            p.moving = true;
            if (d <= p.spd) { p.x = tx; p.y = ty; p.tc = p.tr = -1; if (!G.bombs.length && Math.random() < 0.07) { p.wait = 8; } }
            else { p.x += Math.sign(tx - p.x) * p.spd; p.y += Math.sign(ty - p.y) * p.spd; }
        }
        pickup(p);
    }

    // ---------- Nepřátelé
    function enemyFree(e, c, r) {
        if (c < 0 || r < 0 || c >= GW || r >= GH) { return false; }
        var g = G.grid[r * GW + c];
        if (g === 1 || (g === 2 && e.type !== 2)) { return false; }
        return !bombAt(c, r);
    }
    function decideEnemy(e) {
        var c = Math.round(e.x / T), r = Math.round(e.y / T), opts = [], k, nc, nr;
        for (k = 0; k < 4; k++) { if (enemyFree(e, c + DX[k], r + DY[k])) { opts.push(k); } }
        if (!opts.length) { return; }
        var rev = e.dir < 0 ? -1 : (e.dir ^ 1), choice = -1;
        var humans = G.players.filter(function (p) { return p.alive && p.human; });
        if ((e.type === 1 || e.type === 3) && humans.length && Math.random() < 0.88) {
            var res = bfs(c, r, function (cc, rr) { return enemyFree(e, cc, rr); }, function (cc, rr) {
                return humans.some(function (p) { return cellX(p) === cc && cellY(p) === rr; });
            }, 16);
            if (res) { choice = res.first; }
        } else if (e.type === 2 && humans.length && Math.random() < 0.6) {
            var h = humans[0], bd = 1e9;
            opts.forEach(function (o) {
                nc = c + DX[o]; nr = r + DY[o];
                var dd = Math.abs(nc - cellX(h)) + Math.abs(nr - cellY(h)) + Math.random();
                if (dd < bd) { bd = dd; choice = o; }
            });
        }
        if (choice < 0) {
            var fw = opts.indexOf(e.dir) >= 0 && Math.random() < 0.75;
            if (fw) { choice = e.dir; }
            else {
                var nr2 = opts.filter(function (o) { return o !== rev; });
                var pool = nr2.length ? nr2 : opts;
                choice = pool[rnd(pool.length)];
            }
        }
        e.dir = choice; e.tc = c + DX[choice]; e.tr = r + DY[choice];
    }
    function updEnemy(e) {
        e.anim++;
        if (e.tc < 0) { decideEnemy(e); }
        if (e.tc < 0) { return; }
        var spd = ESPD[e.type], tx = e.tc * T, ty = e.tr * T, d = Math.abs(tx - e.x) + Math.abs(ty - e.y);
        if (d <= spd) { e.x = tx; e.y = ty; e.tc = e.tr = -1; }
        else { e.x += Math.sign(tx - e.x) * spd; e.y += Math.sign(ty - e.y) * spd; }
    }

    // ---------- Hlavní aktualizace hry
    function updWorld() {
        G.players.forEach(function (p) { if (p.alive) { (p.human ? updHuman : updBot)(p); } });
        G.enemies.forEach(function (e) { if (e.alive) { updEnemy(e); } });
        updBombs();
        updFlames();
        G.items.forEach(function (it) { it.age++; });
        if (G.exit) { G.exit.cool--; if (G.exit.shown) { G.exit.shownT++; } }
        // dotyk nepřítele
        G.enemies.forEach(function (e) {
            if (!e.alive) { return; }
            G.players.forEach(function (p) { if (p.alive && Z.hit(p.x + 3, p.y + 3, 10, 10, e.x + 3, e.y + 3, 10, 10)) { killPlayer(p, 'enemy'); } });
        });
    }
    function updFx() {
        G.fx.forEach(function (f) { f.t++; });
        G.fx = G.fx.filter(function (f) { return f.t < f.n; });
    }

    function secsLeft() { return Math.ceil(G.time / 50); }

    function updPlay() {
        G.time--;
        if (G.time % 50 === 0 && G.time < 500 && G.time > 0) { Z.snd.tick(); }
        updWorld();
        updFx();
        if (G.mode === 'story') { checkStory(); } else { checkVersus(); }
    }

    function checkStory() {
        var p = G.players[0];
        if (G.state !== 'play') { return; }
        if (G.time <= 0 && p.alive) { p.inv = 0; killPlayer(p, 'time'); return; }
        var left = G.enemies.filter(function (e) { return e.alive; }).length;
        if (p.alive && G.exit.shown && !left && cellX(p) === G.exit.c && cellY(p) === G.exit.r &&
            Math.abs(p.x - G.exit.c * T) < 8 && Math.abs(p.y - G.exit.r * T) < 8) {
            var bonus = 1000 + secsLeft() * 10;
            G.bonus = bonus; addScore(bonus);
            G.stats = { range: p.range, maxB: p.maxB, spd: p.spd, kick: p.kick };
            G.state = 'clear'; G.st = 0; Z.snd.win();
        }
    }

    function checkVersus() {
        if (G.state !== 'play') { return; }
        var alive = G.players.filter(function (p) { return p.alive; });
        var humanDead = G.mode === 'bots' && !G.players[0].alive;
        var ended = alive.length <= 1 || humanDead || G.time <= 0;
        if (!ended) { G.endT = 0; return; }
        if (++G.endT < (G.time <= 0 ? 1 : (humanDead ? 70 : 60))) { return; }
        var winner = -1;
        if (G.time > 0) {
            if (humanDead) { winner = 99; }
            else if (alive.length === 1) { winner = alive[0].id; }
        }
        if (winner === 99) { G.botWins++; }
        else if (winner === 0) { G.wins[0]++; }
        else if (winner === 1 && G.mode === 'duel') { G.wins[1]++; }
        else if (winner > 0) { G.botWins++; }
        G.winner = winner;
        G.state = 'rend'; G.st = 0;
        if (winner < 0) { Z.snd.over(); } else { Z.snd.win(); }
    }

    function updDying() {
        G.st++;
        updFlames(); updFx();
        if (G.st > 100) {
            G.lives--;
            if (G.lives <= 0) { endStory(false); return; }
            var s = G.stats;
            G.stats = { range: Math.max(2, s.range - 1), maxB: Math.max(1, s.maxB - 1), spd: s.spd, kick: false };
            startLevel();
        }
    }

    function endStory(win) {
        var old = Z.hi.get('bomby');
        G.newRec = G.score > old;
        Z.hi.submit('bomby', G.score);
        G.win = win; G.state = 'over'; G.st = 0;
        if (win) { Z.snd.win(); } else { Z.snd.over(); }
    }

    function updClear() {
        G.st++; updFlames(); updFx();
        if (G.st > 170) {
            G.level++;
            if (G.level > LEVELS.length) { endStory(true); } else { startLevel(); }
        }
    }

    function updRend() {
        G.st++;
        updWorld(); updFx();
        if (G.st > 130) {
            var need = 2;
            if (G.mode === 'duel' && (G.wins[0] >= need || G.wins[1] >= need)) { G.matchWinner = G.wins[0] >= need ? 0 : 1; G.state = 'over'; G.st = 0; Z.snd.win(); return; }
            if (G.mode === 'bots' && (G.wins[0] >= need || G.botWins >= need)) { G.matchWinner = G.wins[0] >= need ? 0 : 99; G.state = 'over'; G.st = 0; Z.snd.win(); return; }
            G.round++; startRound();
        }
    }

    function updTitle() {
        if (anyHit(['up', 'p1u', 'p2u'])) { G.menu = (G.menu + 2) % 3; Z.snd.tick(); }
        if (anyHit(['down', 'p1d', 'p2d'])) { G.menu = (G.menu + 1) % 3; Z.snd.tick(); }
        if (fireHit()) { Z.snd.coin(); startMode(['story', 'duel', 'bots'][G.menu]); }
    }

    function tick() {
        G.t++;
        Z.pauseOk = G.state === 'play';
        switch (G.state) {
            case 'title': updTitle(); break;
            case 'intro': G.st++; updFx(); if (G.st > 110 || (G.st > 25 && fireHit())) { G.state = 'play'; } break;
            case 'play': updPlay(); break;
            case 'dying': updDying(); break;
            case 'clear': updClear(); break;
            case 'rend': updRend(); break;
            case 'over': G.st++; if (G.st > 60 && fireHit()) { G.state = 'title'; G.t = 0; } break;
        }
    }

    // ---------- Kreslení
    function drawFloor(x, y, c, r) {
        Z.rect(x, y, T, T, 4);
        Z.pix(x + 3, y + 3, 12); Z.pix(x + 11, y + 10, 12); Z.pix(x + 6, y + 13, 12);
        if (r > 0 && G.grid[(r - 1) * GW + c] !== 0) { Z.rect(x, y, T, 4, 0); }
    }
    function drawPillar(x, y) {
        Z.rect(x, y, T, T, 7); Z.rect(x, y, T, 2, 15); Z.rect(x, y, 2, T, 15);
        Z.rect(x + 14, y, 2, T, 1); Z.rect(x, y + 14, T, 2, 1);
        Z.rect(x + 5, y + 5, 6, 6, 1); Z.rect(x + 6, y + 6, 4, 4, 9);
    }
    function drawBlock(x, y) {
        Z.rect(x, y, T, T, 0);
        Z.rect(x, y, 7, 7, 2); Z.rect(x + 8, y, 8, 7, 2);
        Z.rect(x, y + 8, 3, 8, 2); Z.rect(x + 4, y + 8, 7, 8, 2); Z.rect(x + 12, y + 8, 4, 8, 2);
        Z.rect(x, y, 7, 1, 10); Z.rect(x + 8, y, 8, 1, 10);
        Z.rect(x, y + 8, 3, 1, 10); Z.rect(x + 4, y + 8, 7, 1, 10); Z.rect(x + 12, y + 8, 4, 1, 10);
    }
    function drawBomb(b) {
        var x = OX + b.x, y = OY + b.y, big = (G.t >> 3) & 1, rr = 6 + big;
        var flash = b.t < 45 && ((G.t >> 2) & 1);
        Z.disc(x + 8, y + 9, rr, flash ? 10 : 0);
        Z.rect(x + 4, y + 5, 2, 2, 15);
        Z.rect(x + 9, y + 1, 2, 3, 7);
        Z.pix(x + 11, y + 1, (G.t >> 1) & 1 ? 14 : 10); Z.pix(x + 12, y, 14);
    }
    function drawFlame(f) {
        var x = OX + f.c * T, y = OY + f.r * T, k = f.t < 8 ? 2 : 0, a = (G.t >> 1) & 1;
        Z.rect(x + k, y + k, T - 2 * k, T - 2 * k, a ? 14 : 10);
        Z.rect(x + 3 + k, y + 3 + k, T - 6 - 2 * k, T - 6 - 2 * k, a ? 10 : 15);
    }
    function drawItem(it) {
        var x = OX + it.c * T, y = OY + it.r * T, d = ITM[it.type];
        Z.rect(x + 1, y + 1, 14, 14, (G.t >> 3) & 1 ? 15 : 14);
        Z.rect(x + 2, y + 2, 12, 12, d[1]);
        Z.text(x + 5, y + 2, d[0], d[2]);
    }
    function drawExit(ex) {
        var x = OX + ex.c * T, y = OY + ex.r * T, open = G.enemies.every(function (e) { return !e.alive; });
        Z.rect(x + 1, y + 1, 14, 14, 14);
        Z.rect(x + 3, y + 3, 10, 10, open ? ((G.t >> 2) & 1 ? 13 : 9) : 1);
        Z.rect(x + 6, y + 6, 4, 7, 0);
        if (!open) { Z.rect(x + 3, y + 3, 10, 2, 2); }
    }
    function drawPlayer(p) {
        if (!p.alive) { return; }
        if (p.inv > 0 && (G.t >> 2) & 1) { return; }
        var frame = p.moving ? (p.anim >> 3) & 1 : 0, face = p.face;
        var pal = { h: p.pal.h, b: p.pal.b, w: 15, k: 0, p: 14 };
        Z.spriteC(OX + p.x + 2, OY + p.y + 1, playerRows(face, frame), pal, face === 1);
    }
    function drawEnemy(e) {
        if (!e.alive) { return; }
        var rows = ESPR[e.type], bob = (e.anim >> 4) & 1;
        Z.spriteC(OX + e.x + 2, OY + e.y + 4 + bob - (rows.length > 9 ? 1 : 0), rows, EPAL[e.type], false);
    }
    function drawFx(f) {
        var r = 2 + f.t * 0.9;
        Z.ring(OX + f.x, OY + f.y, r, f.t & 1 ? 15 : 14);
        Z.ring(OX + f.x, OY + f.y, r * 0.6, 10);
    }

    function drawBoard() {
        var r, c;
        for (r = 0; r < GH; r++) {
            for (c = 0; c < GW; c++) {
                var g = G.grid[r * GW + c], x = OX + c * T, y = OY + r * T;
                if (g === 1) { drawPillar(x, y); } else if (g === 2) { drawBlock(x, y); } else { drawFloor(x, y, c, r); }
            }
        }
        if (G.exit && G.exit.shown && G.grid[G.exit.r * GW + G.exit.c] === 0) { drawExit(G.exit); }
        G.items.forEach(drawItem);
        G.bombs.forEach(drawBomb);
        G.flames.forEach(drawFlame);
        G.enemies.forEach(drawEnemy);
        G.players.forEach(drawPlayer);
        G.fx.forEach(drawFx);
    }

    function box(x, y, w, h) { Z.rect(x, y, w, h, 0); Z.frame(x, y, w, h, 15); Z.frame(x + 2, y + 2, w - 4, h - 4, 1); }

    function drawHud() {
        Z.rect(0, 0, 256, 16, 0); Z.rect(0, 15, 256, 1, 1);
        var low = G.time < 1000 && ((G.t >> 3) & 1) ? 10 : 14;
        if (G.mode === 'story') {
            Z.text(4, 4, 'SKÓRE ' + Z.pad(G.score, 6), 14);
            Z.text(90, 4, 'ŽIVOTY ' + G.lives, 13);
            Z.text(150, 4, 'ÚROVEŇ ' + G.level, 12);
            Z.text(252, 4, 'ČAS ' + secsLeft(), low, { align: 'right' });
        } else {
            if (G.mode === 'duel') {
                Z.text(4, 4, 'HRÁČ 1: ' + G.wins[0], 9);
                Z.text(84, 4, 'HRÁČ 2: ' + G.wins[1], 10);
            } else {
                Z.text(4, 4, 'TY: ' + G.wins[0], 9);
                Z.text(60, 4, 'BOTI: ' + G.botWins, 10);
            }
            Z.text(160, 4, 'KOLO ' + G.round, 12);
            Z.text(252, 4, 'ČAS ' + secsLeft(), low, { align: 'right' });
        }
    }

    function drawTitle() {
        Z.cls(0, 7); Z.border = 1;
        var t = G.t, i;
        for (i = 0; i < 16; i++) { drawPillar(i * 16, 0); }
        for (i = 0; i < 16; i++) { drawBlock(i * 16, 176); }
        Z.text(130, 18, 'PODMINOVAČ', 1, { scale: 3, align: 'center' });
        Z.text(128, 16, 'PODMINOVAČ', 14, { scale: 3, align: 'center' });
        [24, 232].forEach(function (bx) {
            Z.disc(bx, 32, 9, 7); Z.disc(bx, 32, 7, 1); Z.rect(bx - 5, 27, 3, 3, 15);
            Z.rect(bx + 2, 20, 3, 5, 7); Z.pix(bx + 5, 19, (t >> 1) & 1 ? 14 : 10); Z.pix(bx + 6, 18, 14);
        });
        var items = ['JEDEN HRÁČ - TAŽENÍ', 'DVA HRÁČI PROTI SOBĚ', 'HRÁČ PROTI BOTŮM'];
        for (i = 0; i < 3; i++) {
            var sel = i === G.menu;
            Z.text(128, 50 + i * 12, (sel ? '> ' : '  ') + items[i] + (sel ? ' <' : '  '), sel ? ((t >> 3) & 1 ? 14 : 15) : 13, { align: 'center' });
        }
        Z.text(128, 86, 'REKORD ' + Z.pad(Z.hi.get('bomby'), 6), 6, { align: 'center' });
        Z.text(128, 98, 'POKLÁDEJ BOMBY, NIČ BLOKY A NEPŘÁTELE.', 7, { align: 'center' });
        Z.text(128, 108, 'POD BLOKEM JE VÝCHOD - OTEVŘE SE, AŽ', 7, { align: 'center' });
        Z.text(128, 118, 'NEPŘÁTELÉ PADNOU. POZOR NA VÝBUCH!', 7, { align: 'center' });
        Z.text(128, 130, 'F=DOSAH B=BOMBY S=RYCHLOST K=KOPÁNÍ', 12, { align: 'center' });
        Z.text(128, 142, '1. HRÁČ: WASD + F', 13, { align: 'center' });
        Z.text(128, 152, '2. HRÁČ: ŠIPKY + ENTER', 10, { align: 'center' });
        Z.text(128, 162, 'TAŽENÍ/BOTI: I MEZERNÍK. P PAUZA M ZVUK', 5, { align: 'center' });
    }

    function drawOver() {
        Z.cls(0, 7); Z.border = 1;
        var t = G.t;
        if (G.mode === 'story') {
            Z.text(128, 30, G.win ? 'VÍTĚZSTVÍ!' : 'KONEC HRY', G.win ? 14 : 10, { scale: 3, align: 'center' });
            Z.text(128, 74, 'SKÓRE ' + Z.pad(G.score, 6), 15, { scale: 2, align: 'center' });
            Z.text(128, 98, 'REKORD ' + Z.pad(Z.hi.get('bomby'), 6), 6, { scale: 2, align: 'center' });
            if (G.newRec) { Z.text(128, 124, 'NOVÝ REKORD!', (t >> 3) & 1 ? 14 : 10, { scale: 2, align: 'center' }); }
            Z.text(128, 150, 'DOSÁHL JSI ÚROVNĚ ' + Math.min(G.level, LEVELS.length), 13, { align: 'center' });
        } else {
            var m = G.matchWinner, txt, col;
            if (G.mode === 'duel') { txt = m === 0 ? 'VYHRÁL HRÁČ 1!' : 'VYHRÁL HRÁČ 2!'; col = m === 0 ? 9 : 10; }
            else { txt = m === 0 ? 'VYHRÁL JSI!' : 'BOTI VYHRÁLI'; col = m === 0 ? 14 : 10; }
            Z.text(128, 40, txt, col, { scale: 3, align: 'center' });
            var res = G.mode === 'duel' ? 'VÝSLEDEK ' + G.wins[0] + ' : ' + G.wins[1] : 'TY ' + G.wins[0] + ' : ' + G.botWins + ' BOTI';
            Z.text(128, 92, res, 15, { scale: 2, align: 'center' });
        }
        if (G.st > 60 && ((t >> 4) & 1)) { Z.text(128, 176, 'STISKNI OHEŇ', 15, { align: 'center' }); }
    }

    function drawOverlay() {
        if (G.state === 'intro') {
            box(24, 70, 208, 56);
            if (G.mode === 'story') {
                Z.text(128, 78, 'ÚROVEŇ ' + G.level, 14, { scale: 2, align: 'center' });
                Z.text(128, 100, 'ZNIČ NEPŘÁTELE A NAJDI VÝCHOD', 15, { align: 'center' });
                Z.text(128, 110, 'NEPŘÁTEL: ' + G.enemies.length, 13, { align: 'center' });
            } else {
                Z.text(128, 78, 'KOLO ' + G.round, 14, { scale: 2, align: 'center' });
                Z.text(128, 100, G.mode === 'duel' ? 'PRVNÍ SE DVĚMA VÝHRAMI VYHRAJE' : 'PORAZ VŠECHNY TŘI BOTY', 15, { align: 'center' });
                Z.text(128, 110, G.mode === 'duel' ? 'H1: WASD+F  H2: ŠIPKY+ENTER' : 'WASD NEBO ŠIPKY + MEZERNÍK', 13, { align: 'center' });
            }
        } else if (G.state === 'clear') {
            box(40, 74, 176, 44);
            Z.text(128, 82, 'ÚROVEŇ DOKONČENA!', 14, { align: 'center' });
            Z.text(128, 98, 'BONUS ' + G.bonus, 15, { align: 'center' });
        } else if (G.state === 'rend') {
            box(40, 74, 176, 44);
            var w = G.winner, txt = 'REMÍZA';
            if (w === 99 || (w > 0 && G.mode === 'bots')) { txt = 'BOTI VYHRÁLI KOLO'; }
            else if (w === 0) { txt = G.mode === 'duel' ? 'KOLO VYHRÁL HRÁČ 1' : 'KOLO VYHRÁLS TY!'; }
            else if (w === 1) { txt = 'KOLO VYHRÁL HRÁČ 2'; }
            Z.text(128, 88, txt, 14, { align: 'center' });
            Z.text(128, 100, G.time <= 0 ? 'ČAS VYPRŠEL' : '', 10, { align: 'center' });
        }
    }

    function draw() {
        if (G.noDraw) { return; }
        if (G.state === 'title') { drawTitle(); return; }
        if (G.state === 'over') { drawOver(); return; }
        Z.cls(0, 7); Z.border = 1;
        drawBoard();
        drawHud();
        drawOverlay();
    }

    G.startMode = startMode; G.botThink = botThink; G.cellX = cellX; G.cellY = cellY; G.blastCells = blastCells;
    G.constants = { T: T, GW: GW, GH: GH, LEVELS: LEVELS, FUSE: FUSE };
    G.startLevel = startLevel; G.dangerMap = dangerMap; G.bfs = bfs; G.placeBomb = placeBomb;

    Z.init({
        title: 'Podminovač',
        touch: [{ act: 'left', label: '◀' }, { act: 'up', label: '▲' }, { act: 'down', label: '▼' },
            { act: 'right', label: '▶' }, { act: 'fire', label: 'BOMBA', cls: 'big' }]
    });
    Z.run({ tick: tick, draw: draw });
})();
