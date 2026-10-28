import { test, expect } from "@playwright/test";
import { places, locationFor } from "../src/data";
import geocoded from "../src/geocoded-places.json" with { type: "json" };

test("all 22 clubs have sourced coordinates for their current address", () => {
  expect(places).toHaveLength(22);
  expect(Object.keys(geocoded).sort()).toEqual(places.map((p) => p.id).sort());
  for (const place of places) {
    const location = locationFor(place);
    expect(location.resolved, place.name).toBe(true);
    expect(location.coordinates[0]).toBeGreaterThan(59.77);
    expect(location.coordinates[0]).toBeLessThan(59.94);
    expect(location.coordinates[1]).toBeGreaterThan(30.17);
    expect(location.coordinates[1]).toBeLessThan(30.46);
    // Changing the address must invalidate the cached match.
    expect(locationFor({ ...place, address: "Другой адрес, 1" }).resolved).toBe(
      false,
    );
  }
  expect(
    locationFor(places.find((p) => p.id === "kosmos")!).coordinates,
  ).toEqual([59.8769204, 30.3223321]);
  expect(
    locationFor(places.find((p) => p.id === "romantiki")!).coordinates,
  ).toEqual([59.853216, 30.2992693]);
  expect(
    locationFor(places.find((p) => p.id === "oktyabr")!).coordinates,
  ).toEqual([59.838449, 30.348067]);
});
