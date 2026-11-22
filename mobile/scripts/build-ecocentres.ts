/**
 * Builds src/data/ecocentres.json from RECYC-QUÉBEC's "Écocentres et points de dépôt municipaux"
 * (donneesquebec.ca/recherche/dataset/ecocentres-et-points-de-depot-municipaux, CC-BY 4.0).
 *
 * Usage: node scripts/build-ecocentres.ts <ecocentrepointsdepotmunicipaux.geojson> [YYYY-MM-DD]
 * Keeps the Island of Montréal only, chosen by municipality name: at least one record elsewhere in Québec
 * carries coordinates that land on the island, so a bounding box would let it in.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ISLAND = [
  'Montréal', 'Baie-D’Urfé', "Baie-D'Urfé", 'Beaconsfield', 'Côte-Saint-Luc', 'Dollard-Des Ormeaux', 'Dorval', 'Hampstead',
  'Kirkland', 'Mont-Royal', 'Montréal-Est', 'Montréal-Ouest', 'Pointe-Claire', 'Sainte-Anne-de-Bellevue', 'Senneville', 'Westmount',
];

type Props = { Collecte_Nom: string; Collecte_Adresse: string; Collecte_Ville: string; Collecte_Codepostal: string; Collecte_Longitude: number; Collecte_Latitude: number };

const [file, fetchedOn = new Date().toISOString().slice(0, 10)] = process.argv.slice(2);
const fc = JSON.parse(readFileSync(file, 'utf8')) as { features: { properties: Props }[] };

const ecocentres = fc.features
  .map((f) => f.properties)
  .filter((p) => ISLAND.includes(p.Collecte_Ville.trim()))
  .map((p) => {
    // "Écocentre Acadie - Arrondissement d’Ahuntsic-Cartierville" -> name + borough.
    const [name, area] = p.Collecte_Nom.split(/\s+-\s+Arrondissement d[e’']\s*/);
    const city = p.Collecte_Ville.trim();
    return {
      id: name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      name: name.trim(),
      area: area?.trim() ?? city,
      city,
      address: `${p.Collecte_Adresse.trim()}, ${city} ${p.Collecte_Codepostal.trim()}`,
      lat: p.Collecte_Latitude,
      lng: p.Collecte_Longitude,
    };
  });

writeFileSync(
  new URL('../src/data/ecocentres.json', import.meta.url),
  JSON.stringify({ source: 'RECYC-QUÉBEC, Écocentres et points de dépôt municipaux (CC-BY 4.0)', sourceUrl: 'https://www.donneesquebec.ca/recherche/dataset/ecocentres-et-points-de-depot-municipaux', fetchedOn, ecocentres }, null, 1),
);
console.log(ecocentres.map((e) => `${e.name} · ${e.area} · ${e.address}`).join('\n'));
