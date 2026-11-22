// Real strings from the Ville de Montréal Info-collectes data (21 Nov 2026). Run: npm test.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { datesIn, parseDateList, parseDays, parseExceptions, parseMonthly, parseSector } from './infoCollectes.ts';

test('days: the many ways the city writes a weekday', () => {
  assert.deepEqual(parseDays('Jour de collecte : MardiHeures de dépôt : entre 19 h la veille'), [2]);
  assert.deepEqual(parseDays('La collecte des ordures ménagères a lieu les MERCREDIS. Déposez'), [3]);
  assert.deepEqual(parseDays('Jour de collecte ZONE 3: LundiExceptions : - Pour les résidences #82 : Mardi'), [1]);
  assert.deepEqual(parseDays('Jour de collecte : SECTEUR 1 MercrediHeures de dépôt'), [3]);
  assert.deepEqual(parseDays('La collecte a lieu les LUNDIS et les JEUDIS pour les adresses suivantes'), [1, 4]);
  assert.deepEqual(parseDays('Déposer les ordures dans le conteneur semi-enfoui'), []);
  assert.deepEqual(parseDays('D&eacuteposer les ordures dans le conteneur semi-enfoui. Les objets trop gros … le mercredi soir'), []);
});

test('dates: single, shared-month lists and ordinals', () => {
  assert.deepEqual(datesIn('les vendredis 25 décembre 2026 et 1er janvier 2027'), ['2026-12-25', '2027-01-01']);
  assert.deepEqual(datesIn('les MERCREDIS, soit le 23 et le 30 décembre 2026'), ['2026-12-23', '2026-12-30']);
  assert.deepEqual(datesIn('Du 1er novembre au 30 avril, la fréquence'), []);
});

test('holidays: moved, moved earlier, and moved in the next sentence', () => {
  const later = "Jours fériés : Il n'y aura pas de collecte les vendredis 25 décembre 2026 et 1er janvier 2027. Celles-ci seront reportées aux LUNDIS 28 décembre 2026 et 4 janvier 2027.";
  assert.deepEqual(parseExceptions(later, 'garbage').map((e) => [e.date, e.moveTo]), [['2026-12-25', '2026-12-28'], ['2027-01-01', '2027-01-04']]);
  const earlier = "Il n'y aura pas de collecte les vendredis 25 décembre 2026 et 1er janvier 2027. Celles-ci seront devancées aux JEUDIS 24 décembre 2026 et 31 décembre 2026.";
  assert.deepEqual(parseExceptions(earlier, 'recycling').map((e) => e.moveTo), ['2026-12-24', '2026-12-31']);
  const split = "Jours fériés : Il n'y aura pas de collecte vendredi le 25 décembre 2026. Cette collecte est reportée au samedi 26 décembre 2026.";
  assert.deepEqual(parseExceptions(split, 'garbage').map((e) => [e.date, e.moveTo]), [['2026-12-25', '2026-12-26']]);
});

test('holidays: a trailing note about other buildings does not shift the pairing', () => {
  const ac2 = "Jours fériés : Il n'y aura pas de collecte les vendredis 25 décembre 2026 et 1er janvier 2027. Celles-ci auront lieu les MERCREDIS, soit le 23 et le 30 décembre 2026.ATTENTION Pour les immeubles concernés par la fréquence de collecte aux 2 semaines, la collecte aura donc lieu les 18 et 30 décembre 2026 et la prochaine le 15 janvier 2027.";
  assert.deepEqual(parseExceptions(ac2, 'garbage').map((e) => [e.date, e.moveTo]), [['2026-12-25', '2026-12-23'], ['2027-01-01', '2026-12-30']]);
});

test('no holiday sentence means no exceptions', () => {
  assert.deepEqual(parseExceptions('Les encombrants rembourrés doivent être déposés avec les ordures ménagères.', 'garbage'), []);
});

test('sector: biweekly is flagged from the message or the exception text', () => {
  const s = parseSector({ ID: 'MHM-1-A', MESSAGE_FR: 'Jours de collecte : LundiHeures de dépôt', EXCEPTION_FR: 'Du 1er novembre au 30 avril, la fréquence de collecte des ordures ménagères est d\'une fois toutes les deux semaines.' }, 'garbage');
  assert.equal(s.biweekly, true);
  assert.deepEqual(s.days, [1]);
  assert.equal(parseSector({ ID: 'x', MESSAGE_FR: 'La collecte a lieu le LUNDI.' }, 'recycling').biweekly, false);
});

test('bulky: nth weekday of the month, in digits or words', () => {
  assert.deepEqual(parseMonthly('Jour(s) de collecte : 1er et 3e mercredi du mois *Collectes supplémentaires'), [1, 3]);
  assert.deepEqual(parseMonthly('Jour de collecte : 1e et 3e vendredi du mois'), [1, 3]);
  assert.deepEqual(parseMonthly('Immeubles de 20 logements et moins : 1er vendredi de chaque mois'), [1]);
  assert.deepEqual(parseMonthly('La collecte a lieu le PREMIER ET TROISIÈME MARDI DU MOIS Déposez'), [1, 3]);
  assert.equal(parseMonthly('Jour de collecte : Mercredi Heures de dépôt'), null);
});

test('yard: listed dates in the year the text names', () => {
  const ac1 = 'Jour(s) de collecte en 2026 : Lundi - 6, 13, 20 et 27 avril; - 2, 9, 16 et 23 novembre. Contenants : sac de 25 kg, longueur 1,5 m';
  assert.deepEqual(parseDateList(ac1), ['2026-04-06', '2026-04-13', '2026-04-20', '2026-04-27', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']);
});

test('yard: weekly ranges plus a fortnightly summer list', () => {
  const rpp = 'Jours de collecte en 2026 : - Printemps : du 8 avril au 27 mai, toutes les semaines le mercredi - Été aux 2 semaines : 3 et 17 juin - Automne : du 30 septembre au 25 novembre, toutes les semaines le mercredi';
  const d = parseDateList(rpp);
  assert.equal(d[0], '2026-04-08');
  assert.ok(d.includes('2026-05-27') && d.includes('2026-06-17') && d.includes('2026-11-25'));
  assert.ok(!d.includes('2026-06-10'), 'summer is fortnightly, not weekly');
  assert.ok(d.every((x) => new Date(`${x}T12:00Z`).getUTCDay() === 3), 'all Wednesdays');
});

test('yard: a listed calendar is not flagged every-other-week', () => {
  const s = parseSector({ ID: 'RPP-1-RV', MESSAGE_FR: 'Jours de collecte en 2026 : - Été aux 2 semaines : 3 et 17 juin' }, 'yard');
  assert.equal(s.biweekly, false);
  assert.deepEqual(s.dates, ['2026-06-03', '2026-06-17']);
});

test('included elsewhere is marked, not read as a day', () => {
  const s = parseSector({ ID: 'PMR-1', MESSAGE_FR: 'La collecte des résidus alimentaires est incluse dans la collecte des matières organiques.' }, 'food');
  assert.equal(s.seeOther, true);
  assert.deepEqual(s.days, []);
});
