// Průchod stavovými automaty všech režimů: title -> intro -> play -> (dying/rend/clear) -> over -> title.
const H = require('/Users/hyman/EngetoAcademy/TizenOS/_kit/headless.js');
const B = '/Users/hyman/EngetoAcademy/TizenOS/bomby/';
const OUT = process.argv[2] || '/tmp';
const g = H.load([B + 'js/speccy.js', B + 'js/game.js']);
const G = g.sandbox.GAME, Z = g.Z;
function assert(c, m) { if (!c) { console.error('CHYBA:', m); process.exit(1); } }
function tap(code, n) { g.key(code, true); g.step(2); g.key(code, false); g.step(n || 1); }
function until(cond, max, label) { let i = 0; while (!cond() && i++ < max) { g.step(1); } assert(cond(), 'timeout: ' + label + ' (stav ' + G.state + ')'); }

// --- 1) Tažení: nečinný hráč zemře 3x (nepřátelé/čas), game over, rekord, zpět na titulku
assert(G.state === 'title', 'title');
G.noDraw = true;
tap(32);                                   // mezerník = start (menu 0 = tažení)
assert(G.state === 'intro' && G.mode === 'story', 'intro tažení');
until(() => G.state === 'play', 200, 'play');
Z.input.clear();
// hráč pokládá bomby na místě a čeká (sám se zabije) – ověří i bombu, výbuch, umírání
let died = 0, last = G.lives;
for (let i = 0; i < 40000 && G.state !== 'over'; i++) {
    if (G.state === 'play' && i % 200 === 0) { g.key(70, true); g.step(1); g.key(70, false); }
    g.step(1);
    if (G.lives < last) { died++; last = G.lives; }
    assert(!g.hasNaN(G.players) && !g.hasNaN(G.enemies) && !g.hasNaN(G.bombs) && !g.hasNaN(G.flames), 'NaN v tažení');
}
assert(G.state === 'over' && died === 3, 'konec hry po 3 smrtích: ' + G.state + ' ' + died);
console.log('Tažení: konec po', died, 'smrtích, skóre', G.score, 'rekord', Z.hi.get('bomby'));
G.noDraw = false; g.step(70); g.png(OUT + '/over.png', 3);
tap(32); assert(G.state === 'title', 'zpět na titulek');

// --- 2) Vítězství: úroveň 10 vyčištěna -> VÍTĚZSTVÍ
G.noDraw = true;
G.startMode('story'); G.level = 10; G.startLevel(); G.stats = { range: 2, maxB: 1, spd: 1, kick: false };
until(() => G.state === 'play', 200, 'play L10');
G.enemies.forEach(e => { e.alive = false; });
G.exit.shown = true; G.grid[G.exit.r * 15 + G.exit.c] = 0;
const p0 = G.players[0]; p0.x = G.exit.c * 16; p0.y = G.exit.r * 16;
g.step(2); assert(G.state === 'clear', 'clear L10 ' + G.state);
until(() => G.state === 'over', 300, 'over po L10'); assert(G.win === true, 'výhra');
console.log('Vítězství po úrovni 10, skóre', G.score);
tap(32, 1); g.step(70); tap(32); assert(G.state === 'title', 'title po výhře');

// --- 3) Duel: oba hráči se zabijí vlastní bombou, 2 výhry rozhodnou
G.menu = 1; tap(13);                                    // Enter na menu duelu
assert(G.mode === 'duel' && G.state === 'intro', 'duel intro');
let rounds = 0;
for (let i = 0; i < 20000 && G.state !== 'over'; i++) {
    if (G.state === 'play') {
        if (G.t % 150 === 0) { g.key(70, true); g.step(1); g.key(70, false); }      // P1 klade bombu (F)
        if (G.t % 150 === 75 && G.players[1].alive) {}                                // P2 stojí
    }
    if (G.state === 'intro' && G.st > 30) { rounds = G.round; }
    g.step(1);
    assert(!g.hasNaN(G.players), 'NaN duel');
}
assert(G.state === 'over' && G.mode === 'duel', 'duel končí');
console.log('Duel: kol', G.round, 'výhry', G.wins, 'vítěz', G.matchWinner);
assert(G.wins[1] >= 2, 'P2 vyhrál (P1 se zabíjel sám)');
g.step(70); tap(13); assert(G.state === 'title', 'title po duelu');

// --- 4) Boti: hráč stojí, boti ho dostanou
G.menu = 2; tap(32);
assert(G.mode === 'bots' && G.players.length === 4, 'boti: 4 hráči');
for (let i = 0; i < 120000 && G.state !== 'over'; i++) { g.step(1); assert(!g.hasNaN(G.players), 'NaN boti'); }
assert(G.state === 'over' && (G.matchWinner === 99 || G.matchWinner === 0), 'zápas s boty skončil');
console.log('Boti: kol', G.round, 'výhry hráče', G.wins[0], 'výhry botů', G.botWins);
G.noDraw = false; g.step(70); g.png(OUT + '/over_bots.png', 3);
tap(32); assert(G.state === 'title', 'title po botech');
// pauza
G.menu = 0; tap(32); until(() => G.state === 'play', 300, 'play'); g.step(3);
tap(80); assert(Z.paused(), 'pauza zapnuta'); const t1 = G.time; g.step(30); assert(G.time === t1, 'v pauze se čas nehýbe');
tap(80); assert(!Z.paused(), 'pauza vypnuta'); g.step(5); assert(G.time < t1, 'čas po pauze běží');
console.log('OK modes');
