import { describe, it, expect } from "vitest";
import { parseDays, DAYS } from "./dayOfWeek";
describe("schedule days", () => {
  it.each([
    ["Monday", "Wednesday", "Friday"],
    ["lunes", "miércoles", "viernes"],
    ["Montag", "Mittwoch", "Freitag"],
    ["lundi", "mercredi", "vendredi"],
    ["lunedì", "mercoledì", "venerdì"],
    ["segunda-feira", "quarta-feira", "sexta-feira"],
  ])("accepts %j", (...input) =>
    expect(parseDays(input).days).toEqual(["MON", "WED", "FRI"]),
  );
  it("supports abbreviated accented names", () =>
    expect(parseDays(["sáb", "di", "gio", "mie"]).days).toEqual([
      "TUE",
      "WED",
      "THU",
      "SAT",
    ]));
  it.each([
    "weekdays",
    "entre semana",
    "laborables",
    "de lunes a viernes",
    "werktags",
    "Wochentage",
    "en semaine",
  ])("weekday group %s", (s) =>
    expect(parseDays([s]).days).toEqual(DAYS.slice(0, 5)),
  );
  it.each(["weekend", "fin de semana", "Wochenende", "week-end"])(
    "weekend group %s",
    (s) => expect(parseDays([s]).days).toEqual(DAYS.slice(5)),
  );
  it.each(["daily", "todos los días", "täglich", "tous les jours"])(
    "daily group %s",
    (s) => expect(parseDays([s]).days).toEqual(DAYS),
  );
  it("reports unknowns and deduplicates", () =>
    expect(parseDays(["MON", "lunes", "nonsense"])).toEqual({
      days: ["MON"],
      unknown: ["nonsense"],
    }));
});
