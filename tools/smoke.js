// Základní test: načtení, přechody stavů, snímky title/hra, kontrola NaN.
const H = require('/Users/hyman/EngetoAcademy/TizenOS/_kit/headless.js');
const B = '/Users/hyman/EngetoAcademy/TizenOS/bomby/';
const OUT = process.argv[2] || '/tmp';
const g = H.load([B + 'js/speccy.js', B + 'js/game.js']);
const G = g.sandbox.GAME, Z = g.Z;
function assert(c, m) { if (!c) { console.error('CHYBA:', m); process.exit(1); } }
g.step(5); g.png(OUT + '/title.png', 3);
assert(G.state === 'title', 'title');
// text se vejde
['POKLÁDEJ BOMBY, NIČ BLOKY A NEPŘÁTELE.', 'TAŽENÍ A BOTI: I MEZERNÍK. P PAUZA, M ZVUK', 'NEPŘÁTELÉ PADNOU. POZOR NA VÝBUCH!'].forEach(s => console.log(Z.textW(s, 1), s));
g.key(32, true); g.step(2); g.key(32, false);
assert(G.state === 'intro', 'intro ' + G.state);
g.step(120); assert(G.state === 'play', 'play');
g.step(80); g.png(OUT + '/play.png', 3);
assert(!g.hasNaN(G.players) && !g.hasNaN(G.enemies), 'NaN');
console.log('OK smoke', G.enemies.length, 'nepratel');
