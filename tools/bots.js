// Bot proti botům (všichni 4 řízeni AI): kontrola, že kola končí, boti se nezasekávají a málo se zabíjejí vlastní bombou.
const H = require('/Users/hyman/EngetoAcademy/TizenOS/_kit/headless.js');
const B = '/Users/hyman/EngetoAcademy/TizenOS/bomby/';
const g = H.load([B + 'js/speccy.js', B + 'js/game.js']);
const G = g.sandbox.GAME; G.noDraw = true;
function assert(c, m) { if (!c) { console.error('CHYBA:', m); process.exit(1); } }
const N = +process.argv[2] || 12;
let draws = 0, wins = 0, selfK = 0, otherK = 0, ticks = 0;
for (let k = 0; k < N; k++) {
    G.startMode('bots'); g.step(1);
    G.players[0].human = false;               // i hráč 1 je bot
    g.step(115);
    let n = 0;
    while (G.state === 'play' && n < 7000) { g.step(1); n++; }
    assert(!g.hasNaN(G.players) && !g.hasNaN(G.bombs), 'NaN');
    ticks += n;
    G.players.forEach(p => { if (p.deathBy === 'self') { selfK++; } else if (p.deathBy === 'other') { otherK++; } });
    g.step(1);
    if (G.winner === -1) { draws++; } else { wins++; }
}
console.log('kol', N, 'rozhodnuto', wins, 'remíz/čas', draws, 'sebevražd', selfK, 'zabití cizí bombou', otherK, 'průměr ticků', Math.round(ticks / N));
assert(wins >= N * 0.5, 'příliš mnoho nerozhodnutých kol (boti se zasekávají)');
