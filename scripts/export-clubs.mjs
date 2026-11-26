import { writeFile } from "node:fs/promises";
import { places, locationFor, vkLinkFor } from "../src/data.ts";

const xml = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const placemarks = places.map(place => {
  const [latitude, longitude] = locationFor(place).coordinates;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("Invalid coordinates: " + place.id);
  const description = [
    "Санкт-Петербург, " + place.address,
    place.phone ? "Телефон: " + place.phone : "",
    "ВКонтакте: " + vkLinkFor(place).url
  ].filter(Boolean).join("\n");
  return [
    "    <Placemark>",
    "      <name>" + xml(place.name) + "</name>",
    "      <description>" + xml(description) + "</description>",
    "      <Point><coordinates>" + longitude + "," + latitude + ",0</coordinates></Point>",
    "    </Placemark>"
  ].join("\n");
});
const output = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<kml xmlns="http://www.opengis.net/kml/2.2">',
  "  <Document>",
  "    <name>Клубы Московского района Санкт-Петербурга</name>",
  "    <description>Клубы, адреса и контакты с molmoskovsky.ru</description>",
  ...placemarks,
  "  </Document>",
  "</kml>",
  ""
].join("\n");
await writeFile(new URL("../public/clubs-moskovsky.kml", import.meta.url), output, "utf8");
console.log("Exported " + places.length + " clubs to public/clubs-moskovsky.kml");
