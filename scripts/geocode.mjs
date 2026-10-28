import { readFile, writeFile } from "node:fs/promises";
import { places } from "../src/data.ts";

const cachePath = new URL("../src/geocoded-places.json", import.meta.url);
const cache = JSON.parse(await readFile(cachePath, "utf8"));
const unresolved = [];
let requests = 0;
let previousRequest = 0;
const inspectOnly = process.argv.includes("--inspect");

function normalizeHouse(value) {
  return value
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/корп(?:ус)?\.?\s*/gu, "к")
    .replace(/лит(?:ера)?\.?\s*[а-яa-z]+/gu, "")
    .replace(/[\s,.]/gu, "");
}
function normalizeStreet(value) {
  return value
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(
      /(?:^|\s)(?:улица|ул\.?|проспект|пр\.?|проезд|шоссе)(?=\s|$)/gu,
      " ",
    )
    .replace(/[^\p{L}\p{N}]/gu, "");
}
async function search(params) {
  const delay = 1100 - (Date.now() - previousRequest);
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  previousRequest = Date.now();
  requests++;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  for (const [name, value] of Object.entries({
    ...params,
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
    countrycodes: "ru",
    viewbox: "30.17,59.94,30.46,59.77",
    bounded: "1",
  }))
    url.searchParams.set(name, value);
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "MSMRopportunities/0.1 (one-time address verification; https://github.com/leethoof1/MSMRopportunities)",
      "Accept-Language": "ru",
    },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok)
    throw new Error(
      `Nominatim returned HTTP ${response.status}. Stop; check network policy or service limits before retrying.`,
    );
  const result = await response.json();
  if (!Array.isArray(result))
    throw new Error(
      "Unexpected geocoder response; no coordinates were accepted.",
    );
  return result;
}

try {
  for (const place of places) {
    const [street, ...houseParts] = place.address.split(",");
    const house = normalizeHouse(houseParts.join(" "));
    if (inspectOnly) {
      console.log(`${place.id}: ${normalizeStreet(street)} / ${house}`);
      continue;
    }
    if (cache[place.id]?.address === place.address) continue;
    const candidateMatches = (candidate) => {
      const address = candidate.address || {};
      const foundStreet =
        address.road ||
        address.pedestrian ||
        address.residential ||
        address.footway ||
        "";
      const lat = Number(candidate.lat),
        lon = Number(candidate.lon);
      return (
        normalizeHouse(address.house_number || "") === house &&
        normalizeStreet(foundStreet) === normalizeStreet(street) &&
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        lat > 59.77 &&
        lat < 59.94 &&
        lon > 30.17 &&
        lon < 30.46
      );
    };
    let results = await search({ q: `Санкт-Петербург, ${place.address}` });
    let match = results.find(candidateMatches);
    if (!match) {
      results = await search({
        street: `${house} ${street}`,
        city: "Санкт-Петербург",
      });
      match = results.find(candidateMatches);
    }
    if (!match) {
      unresolved.push(place.id);
      console.log(
        `NEEDS REVIEW: ${place.name} — exact street and building not found`,
      );
      continue;
    }
    cache[place.id] = {
      address: place.address,
      coordinates: [Number(match.lat), Number(match.lon)],
      matchedAddress: match.display_name,
      source: "OpenStreetMap / Nominatim",
      sourceUrl:
        "https://www.openstreetmap.org/" + match.osm_type + "/" + match.osm_id,
      retrievedAt: new Date().toISOString().slice(0, 10),
    };
    await writeFile(cachePath, JSON.stringify(cache, null, 2) + "\n");
    console.log(`RESOLVED: ${place.name}`);
  }
  if (!inspectOnly) {
    console.log(
      JSON.stringify({
        requests,
        resolved: Object.keys(cache).length,
        needsReview: unresolved,
      }),
    );
    if (unresolved.length) process.exitCode = 2;
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Address verification failed.",
  );
  process.exitCode = 1;
}
