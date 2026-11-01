export const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export type Day = (typeof DAYS)[number];
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\./g, "")
    .trim();
const aliases: Record<string, readonly Day[]> = {};
const names = [
  [
    "monday mon lunes lun l montag mo lundi lunedi lun segunda-feira segunda seg",
  ],
  ["tuesday tue martes mar m dienstag di mardi martedi terca-feira terca ter"],
  [
    "wednesday wed miercoles mie x mittwoch mi mercredi mer mercoledi mercoledi quarta-feira quarta qua",
  ],
  [
    "thursday thu jueves jue j donnerstag do jeudi jeu giovedi gio quinta-feira quinta qui",
  ],
  [
    "friday fri viernes vie v freitag fr vendredi ven venerdi sexta-feira sexta sex",
  ],
  ["saturday sat sabado sab s samstag sa samedi sam sabato"],
  ["sunday sun domingo dom d sonntag so dimanche dim domenica"],
];
names.forEach((group, i) => {
  for (const name of group[0].split(" ")) aliases[name] = [DAYS[i]];
});
for (const word of [
  "weekdays",
  "entre semana",
  "laborables",
  "de lunes a viernes",
  "werktags",
  "wochentage",
  "en semaine",
])
  aliases[word] = DAYS.slice(0, 5);
for (const word of ["weekend", "fin de semana", "wochenende", "week-end"])
  aliases[word] = DAYS.slice(5);
for (const word of ["daily", "todos los dias", "taglich", "tous les jours"])
  aliases[word] = DAYS;
export function parseDays(input: string[]): { days: Day[]; unknown: string[] } {
  const found = new Set<Day>();
  const unknown: string[] = [];
  for (const value of input) {
    const mapped = aliases[normalize(value)];
    if (mapped) mapped.forEach((d) => found.add(d));
    else unknown.push(value);
  }
  return { days: DAYS.filter((d) => found.has(d)), unknown };
}
