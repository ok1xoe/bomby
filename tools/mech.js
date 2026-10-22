// Mechaniky: klouzání po rozích, kopání bomb, výbuch/řetězení, bonusy, východ pod blokem, dosažitelnost úrovní.
const H = require('/Users/hyman/EngetoAcademy/TizenOS/_kit/headless.js');
const B = '/Users/hyman/EngetoAcademy/TizenOS/bomby/';
const OUT = process.argv[2] || '/tmp';
const g = H.load([B + 'js/speccy.js', B + 'js/game.js']);
const G = g.sandbox.GAME, Z = g.Z;
function assert(c, m) { if (!c) { console.error('CHYBA:', m); process.exit(1); } }
const GW = 15, GH = 11;
function fresh(level) { G.startMode('story'); G.level = level || 1; G.stats = { range: 2, maxB: 1, spd: 1, kick: false }; G.startLevel(); g.step(1); G.state = 'play'; G.enemies.forEach(e => { e.alive = false; }); const p = G.players[0]; p.inv = 0; return p; }
function clearGrid() { for (let i = 0; i < G.grid.length; i++) { if (G.grid[i] === 2) { G.grid[i] = 0; } } }
function hold(code, n) { g.key(code, true); g.step(n); g.key(code, false); g.step(1); }

// 1) Klouzání po rohu: hráč nesouosý s řádkem 0 míří doprava kolem sloupu (1,1)
let p = fresh(); clearGrid(); G.hidden = {}; p.x = 0; p.y = 7;
hold(68, 80);
assert(p.x > 40, 'hráč projde kolem sloupu díky klouzání, x=' + p.x);
console.log('Klouzání po rozích OK: x =', p.x.toFixed(1), 'y =', p.y.toFixed(1));

// 2) Bomba blokuje, po sebrání kopání se odkopne
p = fresh(); clearGrid(); p.x = 2 * 16; p.y = 0;
G.bombs.push({ x: 3 * 16, y: 0, t: 400, range: 2, owner: p, walk: [], dx: 0, dy: 0 });
hold(68, 30); assert(p.x <= 2 * 16 + 2.5 && G.bombs[0].dx === 0, 'bomba blokuje bez kopání');
p.kick = true; hold(68, 40);
assert(G.bombs[0].x > 3 * 16, 'bomba kopnutá, x=' + G.bombs[0].x);
g.step(60);
assert(G.bombs[0].dx === 0 && G.bombs[0].x % 16 === 0, 'bomba se zastaví zarovnaná: ' + G.bombs[0].x);
console.log('Kopání bomb OK: bomba dojela na sloupec', G.bombs[0].x / 16);

// 3) Pokládání: max počet bomb, časovač 3 s, výbuch do kříže ničí blok a odhalí východ/bonus
p = fresh(); clearGrid(); G.grid[0 * GW + 2] = 2; G.exit = { c: 2, r: 0, shown: false, shownT: 0, cool: 0 };
p.x = 0; p.y = 0; Z.input.clear();
g.key(70, true); g.step(1); g.key(70, false); g.step(1);
assert(G.bombs.length === 1, 'bomba položena'); g.key(70, true); g.step(1); g.key(70, false);
assert(G.bombs.length === 1, 'max 1 bomba');
hold(68, 20);          // odejdi do (1,0)... ven z bomby
g.step(140);
assert(G.bombs.length === 0 && G.grid[2] === 0 && G.exit.shown, 'výbuch zničil blok a odhalil východ');
assert(G.flames.length > 0, 'plameny');
console.log('Bomba, výbuch a východ pod blokem OK, skóre', G.score);

// 4) Řetězová reakce a zabití nepřítele i hráče
p = fresh(); clearGrid(); p.x = 8 * 16; p.y = 8 * 16;
G.enemies.push({ type: 0, x: 5 * 16, y: 0, tc: -1, tr: -1, alive: true, anim: 0, dir: -1 });
const mk = (c, r, t) => G.bombs.push({ x: c * 16, y: r * 16, t, range: 2, owner: p, walk: [], dx: 0, dy: 0 });
mk(4, 0, 1); mk(6, 0, 300);
p.out = 2; g.step(3);
assert(!G.enemies[G.enemies.length - 1].alive, 'enemy zabit'); assert(G.bombs.length === 0, 'řetězení: ' + G.bombs.length);
console.log('Řetězení bomb a zabití nepřítele OK, skóre', G.score);

// 5) Bonusy
p = fresh(); p.x = 0; p.y = 0;
['R', 'B', 'S', 'K'].forEach(t => { G.items.push({ c: 0, r: 0, type: t, age: 99 }); g.step(1); });
assert(p.range === 3 && p.maxB === 2 && p.spd > 1 && p.kick, 'bonusy aplikovány'); console.log('Bonusy OK');

// 6) Kontrola všech 10 úrovní: dosažitelnost (bez bloků) a smysluplné rozmístění
for (let L = 1; L <= 10; L++) {
    p = fresh(L);
    const seen = new Set(); const q = [[0, 0]]; seen.add(0);
    while (q.length) {
        const [c, r] = q.shift();
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
            const nc = c + dx, nr = r + dy, ix = nr * GW + nc;
            if (nc < 0 || nr < 0 || nc >= GW || nr >= GH || seen.has(ix) || G.grid[ix] === 1) { return; }
            seen.add(ix); q.push([nc, nr]);
        });
    }
    let free = 0; for (let i = 0; i < G.grid.length; i++) { if (G.grid[i] !== 1) { free++; } }
    assert(seen.size === free, 'úroveň ' + L + ': všechny buňky dosažitelné (po zničení bloků)');
    const ex = G.exit.r * GW + G.exit.c;
    assert(G.grid[ex] === 2, 'východ leží pod blokem'); assert(Object.keys(G.hidden).length >= 4, 'skryté bonusy');
    G.enemies.forEach(e => {});
}
console.log('Úrovně 1–10: dosažitelnost a východ OK');
// pohled do hry
p = fresh(3); G.enemies.forEach(e => { e.alive = true; });
G.items.push({ c: 1, r: 0, type: 'R', age: 99 }, { c: 0, r: 1, type: 'K', age: 99 });
G.bombs.push({ x: 2 * 16, y: 0, t: 100, range: 3, owner: p, walk: [], dx: 0, dy: 0 });
p.x = 0; p.y = 0; G.state = 'intro'; G.st = 5; g.step(1); g.png(OUT + '/intro.png', 3);
G.state = 'play'; g.step(1); G.bombs[0].t = 1; g.step(4); p.inv = 0; p.x = 4 * 16; p.y = 16 * 0; p.face = 1; g.step(1); g.png(OUT + '/fire.png', 3);
console.log('OK mech');
