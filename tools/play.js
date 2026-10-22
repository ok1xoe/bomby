// Autopilot (bot ovládá hráče přes klávesy) projde úrovně tažení.
const H = require('/Users/hyman/EngetoAcademy/TizenOS/_kit/headless.js');
const B = '/Users/hyman/EngetoAcademy/TizenOS/bomby/';
const g = H.load([B + 'js/speccy.js', B + 'js/game.js']);
const G = g.sandbox.GAME; G.noDraw = true;
const KEY = [68, 65, 83, 87]; // doprava, doleva, dolů, nahoru
const DXs = [1, -1, 0, 0], DYs = [0, 0, 1, -1];
function assert(c, m) { if (!c) { console.error('CHYBA:', m); process.exit(1); } }

let tgt = null, held = -1;
function release() { if (held >= 0) { g.key(KEY[held], false); held = -1; } }
function autopilot() {
    const p = G.players[0];
    if (!p || !p.alive) { release(); tgt = null; return; }
    if (tgt && Math.abs(p.x - tgt[0] * 16) + Math.abs(p.y - tgt[1] * 16) > Math.max(1, p.spd) && tgt.age++ < 60) { return; }
    release(); tgt = null;
    const th = G.botThink(p);
    if (th.bomb) { g.key(32, true); g.step(1); g.key(32, false); }
    if (th.dir >= 0) {
        tgt = [G.cellX(p) + DXs[th.dir], G.cellY(p) + DYs[th.dir]]; tgt.age = 0;
        held = th.dir; g.key(KEY[held], true);
    }
}
function run(maxTicks, until) {
    for (let i = 0; i < maxTicks; i++) {
        if (G.state === 'play') { autopilot(); } else { release(); tgt = null; }
        g.step(1);
        if (until()) { return i; }
    }
    return -1;
}

const levels = +process.argv[2] || 10;
let cleared = 0;
for (let L = 1; L <= levels; L++) {
    G.startMode('story'); G.level = L; G.lives = 3;
    if (L > 1) { G.stats = { range: 3, maxB: 2, spd: 1, kick: false }; }
    G.startLevel();
    g.step(1);
    let deaths = 0, lastLives = G.lives;
    const n = run(20000, () => { if (G.lives < lastLives || G.state === 'dying' && G.st === 1) { if (G.st === 1) console.log('  smrt:', G.cause, 'cas', Math.ceil(G.time/50)); }
        if (G.lives < lastLives) { deaths++; lastLives = G.lives; } return G.state === 'clear' || G.state === 'over'; });
    assert(!g.hasNaN(G.players) && !g.hasNaN(G.enemies) && !g.hasNaN(G.bombs), 'NaN');
    console.log('Úroveň', L, G.state === 'clear' ? 'DOKONČENA' : 'NEDOKONČENA (' + G.state + ')', 'ticků', n, 'úmrtí', deaths, 'skóre', G.score, 'nepřátel zbývá', G.enemies.filter(e => e.alive).length);
    if (G.state === 'clear' && L === 1) { G.noDraw = false; g.step(1); g.png(process.argv[3] || '/tmp/clear.png', 3); G.noDraw = true; }
    if (G.state === 'clear') { cleared++; }
}
console.log('Dokončeno úrovní:', cleared, '/', levels);
assert(cleared >= 1, 'autopilot nedokončil ani první úroveň');
