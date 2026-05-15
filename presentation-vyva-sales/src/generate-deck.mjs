import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  Presentation,
  PresentationFile,
  auto,
  column,
  fill,
  fixed,
  fr,
  grid,
  grow,
  hug,
  image,
  layers,
  panel,
  row,
  rule,
  shape,
  text,
  wrap,
} from "@oai/artifact-tool";

const W = 1920;
const H = 1080;
const OUT = "output";
const SCRATCH = "scratch";
const ASSETS = path.join(SCRATCH, "assets");
const LOGO = path.join(ASSETS, "0fc0cf3fa2c054a056945e2c5738efe1add32e3e.png");
const SENIOR_PHONE = path.join(ASSETS, "43ece571d97b3cc52e42f97e43f30d4eafe1f97a.png");
const SENIOR_ALONE = path.join(ASSETS, "ff16b97be98646d3f3f930e34b73ac7378b248b7.png");

const C = {
  purple: "#8253AB",
  purpleDark: "#4B216F",
  purpleDeep: "#2C143F",
  purpleSoft: "#F2EBFA",
  yellow: "#F7C900",
  ink: "#171321",
  slate: "#5D5668",
  muted: "#80778A",
  line: "#E7E0EE",
  green: "#2F8A6D",
  greenSoft: "#E8F4EF",
  blue: "#3266A8",
  blueSoft: "#EAF0FA",
  white: "#FFFFFF",
  bg: "#FBFAFD",
};

const P = (color) =>
  color === "transparent" ? undefined : { type: "solid", color };

const SOFT = {
  [C.purple]: "#F2EBFA",
  [C.green]: "#E8F4EF",
  [C.blue]: "#EAF0FA",
  [C.yellow]: "#FFF8D6",
  [C.purpleDark]: "#EFE6F5",
  "#B7791F": "#FFF4DD",
};

const presentation = Presentation.create({
  slideSize: { width: W, height: H },
});

const t = (value, opts = {}) =>
  text(value, {
    width: opts.width ?? fill,
    height: opts.height ?? hug,
    name: opts.name,
    style: {
      fontFace: opts.fontFace ?? "Aptos",
      fontSize: opts.size ?? 28,
      bold: opts.bold ?? false,
      italic: opts.italic ?? false,
      color: opts.color ?? C.ink,
      alignment: opts.align ?? "left",
      lineSpacingMultiple: opts.lineSpacing ?? 1.05,
    },
  });

const spacer = (h = 16, w = fill) =>
  shape({
    name: "spacer",
    width: w,
    height: fixed(h),
    fill: P("transparent"),
    line: P("transparent"),
  });

const dot = (color = C.purple, size = 18) =>
  shape({
    name: "dot",
    geometry: "ellipse",
    width: fixed(size),
    height: fixed(size),
    fill: P(color),
    line: P(color),
  });

const bg = (fillColor = C.bg) =>
  shape({ name: "slide-bg", width: fill, height: fill, fill: P(fillColor), line: P(fillColor) });

const slide = (root) => {
  const s = presentation.slides.add();
  s.compose(root, { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 8 });
  return s;
};

const hydrateLocalImages = async () => {
  const requests = presentation.getPendingImageHydrationRequests();
  const payloads = [];
  for (const request of requests) {
    const uri = request.uri;
    if (!uri) continue;
    const bytes = await readFile(path.resolve(uri));
    payloads.push({
      assetId: request.assetId,
      contentType: request.contentType,
      data: new Uint8Array(bytes),
    });
  }
  presentation.hydrateImageAssets(payloads);
};

const deckTitle = (title, kicker, subtitle, opts = {}) =>
  column(
    { name: "title-stack", width: fill, height: hug, gap: 14 },
    [
      kicker
        ? t(kicker.toUpperCase(), {
            size: 18,
            bold: true,
            color: opts.kickerColor ?? C.purple,
            lineSpacing: 1,
          })
        : spacer(0),
      t(title, {
        name: "slide-title",
        size: opts.titleSize ?? 56,
        bold: true,
        color: opts.titleColor ?? C.ink,
        width: opts.titleWidth ?? fill,
        lineSpacing: 0.95,
      }),
      subtitle
        ? t(subtitle, {
            name: "slide-subtitle",
            size: opts.subtitleSize ?? 25,
            color: opts.subtitleColor ?? C.slate,
            width: opts.subtitleWidth ?? wrap(1120),
            lineSpacing: 1.12,
          })
        : spacer(0),
    ],
  );

const miniLabel = (label, color = C.purple) =>
  panel(
    {
      name: `label-${label}`,
      width: hug,
      height: hug,
      padding: { x: 18, y: 9 },
      fill: P(SOFT[color] ?? C.purpleSoft),
      line: P("transparent"),
      borderRadius: 999,
    },
    t(label, { width: hug, size: 17, bold: true, color }),
  );

const valueLine = (title, body, color = C.purple) =>
  row(
    { name: `value-${title}`, width: fill, height: hug, gap: 16, alignItems: "start" },
    [
      dot(color, 14),
      column(
        { width: fill, height: hug, gap: 4 },
        [
          t(title, { size: 26, bold: true, color: C.ink }),
          t(body, { size: 20, color: C.slate, lineSpacing: 1.18 }),
        ],
      ),
    ],
  );

const metric = (number, label, color = C.purple) =>
  column(
    { width: fill, height: hug, gap: 6 },
    [
      t(number, { size: 52, bold: true, color, align: "center" }),
      t(label, { size: 18, color: C.slate, align: "center", lineSpacing: 1.1 }),
    ],
  );

const step = (num, title, body, color = C.purple) =>
  row(
    { width: fill, height: hug, gap: 18, alignItems: "start" },
    [
      panel(
        {
          width: fixed(54),
          height: fixed(54),
          padding: 0,
          fill: P(color),
          line: P(color),
          borderRadius: 999,
          align: "center",
          justify: "center",
        },
        t(String(num), { width: fill, size: 24, bold: true, color: C.white, align: "center" }),
      ),
      column(
        { width: fill, height: hug, gap: 5 },
        [
          t(title, { size: 25, bold: true, color: C.ink }),
          t(body, { size: 19, color: C.slate, lineSpacing: 1.18 }),
        ],
      ),
    ],
  );

slide(
  layers(
    { name: "cover-root", width: fill, height: fill },
    [
      bg(C.purpleDeep),
      grid(
        {
          width: fill,
          height: fill,
          columns: [fr(1.1), fr(0.9)],
          rows: [fr(1)],
          columnGap: 64,
          padding: { x: 92, y: 74 },
        },
        [
          column(
            { width: fill, height: fill, gap: 28, justifyContent: "center" },
            [
              column(
                { width: hug, height: hug, gap: 0 },
                [
                  t("VYVA", { width: fixed(220), size: 42, bold: true, color: C.white, lineSpacing: 0.9 }),
                  t("Your AI health assistant", { width: fixed(220), size: 13, bold: true, color: C.yellow, lineSpacing: 1 }),
                ],
              ),
              t("Extending care beyond the visit", {
                name: "cover-title",
                size: 78,
                bold: true,
                color: C.white,
                width: wrap(820),
                lineSpacing: 0.92,
              }),
              t("AI voice companion and caregiver dashboard for home care agencies.", {
                size: 30,
                color: "#E7DDF2",
                width: wrap(720),
              }),
              row(
                { width: hug, height: hug, gap: 14 },
                [
                  miniLabel("Voice check-ins", C.yellow),
                  miniLabel("Alerts", C.yellow),
                  miniLabel("Care dashboard", C.yellow),
                ],
              ),
            ],
          ),
          panel(
            {
              width: fill,
              height: fill,
              padding: 0,
              fill: P("transparent"),
              line: P("transparent"),
              borderRadius: 28,
            },
            image({ name: "senior-phone-cover", path: SENIOR_PHONE, width: fill, height: fill, fit: "cover", alt: "Senior speaking on phone" }),
          ),
        ],
      ),
    ],
  ),
);

slide(
  layers(
    { width: fill, height: fill },
    [
      bg(),
      grid(
        {
          width: fill,
          height: fill,
          columns: [fr(0.92), fr(1.08)],
          rows: [fr(1)],
          columnGap: 58,
          padding: { x: 86, y: 70 },
        },
        [
          panel(
            { width: fill, height: fill, padding: 0, fill: P(C.ink), line: P(C.ink), borderRadius: 28 },
            image({ name: "senior-alone", path: SENIOR_ALONE, width: fill, height: fill, fit: "cover", alt: "Senior alone between visits" }),
          ),
          column(
            { width: fill, height: fill, gap: 32, justifyContent: "center" },
            [
              deckTitle(
                "Home care is strong during the visit. The gap is the hours in between.",
                "The problem",
                '"Who is watching when the caregiver leaves?"',
                { titleSize: 54, subtitleSize: 28 },
              ),
              column(
                { width: fill, height: hug, gap: 22 },
                [
                  valueLine("Seniors alone between visits", "Hours of isolation where anxiety and confusion can set in without support."),
                  valueLine("Missed medications", "Complex schedules often lead to errors or skipped doses when unsupervised.", C.green),
                  valueLine("Unnoticed symptoms", "Health declines may not be caught until the next scheduled visit.", C.blue),
                ],
              ),
              rule({ width: fixed(280), stroke: C.yellow, weight: 6 }),
              t("VYVA covers the hours in between.", { size: 30, bold: true, color: C.purple }),
            ],
          ),
        ],
      ),
    ],
  ),
);

slide(
  layers(
    { width: fill, height: fill },
    [
      bg(C.white),
      column(
        { width: fill, height: fill, padding: { x: 92, y: 70 }, gap: 42 },
        [
          deckTitle("How VYVA supports the senior day to day", "Senior experience", "Simple voice moments that create visibility for the care team."),
          grid(
            { width: fill, height: fill, columns: [fr(1), fr(1)], rows: [fr(1), fr(1)], columnGap: 30, rowGap: 30 },
            [
              valueLine("Daily voice check-ins", "A friendly call asks how the senior feels and captures mood signals.", C.purple),
              valueLine("Medication reminders", "VYVA reminds the senior, waits for confirmation, and logs the response.", C.green),
              valueLine("Fall detection voice check", "A possible fall triggers an immediate check-in and alert if there is no answer.", C.blue),
              valueLine("Requests without a smartphone", "Seniors can ask by voice for food, groceries, or supplies.", "#B7791F"),
            ],
          ),
        ],
      ),
    ],
  ),
);

slide(
  layers(
    { width: fill, height: fill },
    [
      bg(C.purpleSoft),
      grid(
        {
          width: fill,
          height: fill,
          columns: [fr(1.1), fr(0.9)],
          columnGap: 46,
          padding: { x: 92, y: 70 },
        },
        [
          column(
            { width: fill, height: fill, gap: 34, justifyContent: "center" },
            [
              deckTitle("VYVA is a digital companion for every senior", "What it is", "It works alongside caregivers, not instead of them."),
              column(
                { width: fill, height: hug, gap: 18 },
                [
                  step(1, "Phone, smartphone, or WhatsApp", "Seniors connect through channels they already understand."),
                  step(2, "Configured to each routine", "Language, medication schedules, contacts, and alert rules are personalized."),
                  step(3, "Signals flow to the dashboard", "Care teams see what changed between visits and can respond earlier."),
                ],
              ),
            ],
          ),
          panel(
            { width: fill, height: fill, padding: 36, fill: P(C.white), line: P(C.line), borderRadius: 28 },
            column(
              { width: fill, height: fill, gap: 26, justifyContent: "center" },
              [
                metric("24/7", "monitoring presence between visits"),
                metric("Voice", "natural interaction for seniors", C.green),
                metric("Alerts", "actionable visibility for coordinators", C.blue),
              ],
            ),
          ),
        ],
      ),
    ],
  ),
);

slide(
  layers(
    { width: fill, height: fill },
    [
      bg(),
      column(
        { width: fill, height: fill, padding: { x: 92, y: 70 }, gap: 34 },
        [
          deckTitle("Your remote control room: the VYVA caregiver dashboard", "Care dashboard", "A live view of seniors, risks, tasks, and follow-up moments."),
          grid(
            { width: fill, height: fill, columns: [fr(0.72), fr(1.28)], columnGap: 36 },
            [
              column(
                { width: fill, height: fill, gap: 20, justifyContent: "center" },
                [
                  valueLine("Live overview", "Medication, symptoms, falls, and mood in one place."),
                  valueLine("Prioritized alerts", "Know who needs attention first.", C.green),
                  valueLine("Family transparency", "Give families peace of mind without adding manual work.", C.blue),
                ],
              ),
              panel(
                { width: fill, height: fill, padding: 30, fill: P(C.white), line: P(C.line), borderRadius: 24 },
                column(
                  { width: fill, height: fill, gap: 18 },
                  [
                    row(
                      { width: fill, height: hug, gap: 18 },
                      [
                        t("Care dashboard", { size: 28, bold: true, color: C.ink }),
                        miniLabel("Live", C.green),
                      ],
                    ),
                    grid(
                      { width: fill, height: fixed(155), columns: [fr(1), fr(1), fr(1)], columnGap: 18 },
                      [
                        metric("18", "seniors monitored"),
                        metric("4", "alerts to review", "#B7791F"),
                        metric("91%", "check-ins completed", C.green),
                      ],
                    ),
                    rule({ width: fill, stroke: C.line, weight: 2 }),
                    valueLine("Maria L.", "Medication confirmed. Mood: good. Next visit: today 15:00.", C.green),
                    valueLine("George R.", "No response to morning check-in. Follow-up recommended.", "#B7791F"),
                    valueLine("Elena P.", "Possible fall signal cleared by voice confirmation.", C.blue),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    ],
  ),
);

slide(
  layers(
    { width: fill, height: fill },
    [
      bg(C.white),
      grid(
        { width: fill, height: fill, columns: [fr(0.95), fr(1.05)], columnGap: 56, padding: { x: 92, y: 70 } },
        [
          column(
            { width: fill, height: fill, gap: 30, justifyContent: "center" },
            [
              deckTitle("More control between visits", "For care providers", "VYVA gives agencies an added layer of visibility without adding a new care shift."),
              t("Caregivers arrive already knowing what happened since the last visit.", {
                size: 34,
                bold: true,
                color: C.purple,
                width: wrap(720),
              }),
            ],
          ),
          column(
            { width: fill, height: fill, gap: 22, justifyContent: "center" },
            [
              valueLine("Agency management dashboard", "Real-time view across all enrolled seniors."),
              valueLine("Alerts and escalation rules", "Falls, no answers, medication issues, and concerning symptoms.", C.green),
              valueLine("Senior profiles", "Language, routines, and contact rules for each senior.", C.blue),
              valueLine("Multi-role access", "Built for nurses, coordinators, and family members.", "#B7791F"),
              valueLine("No complex hardware", "Seniors connect by phone, smartphone, or WhatsApp.", C.purpleDark),
            ],
          ),
        ],
      ),
    ],
  ),
);

slide(
  layers(
    { width: fill, height: fill },
    [
      bg(C.purpleDeep),
      column(
        { width: fill, height: fill, padding: { x: 92, y: 70 }, gap: 48 },
        [
          deckTitle("Easy onboarding for your team and seniors", "Onboarding", "A small pilot can be set up without changing the way your agency delivers care.", {
            titleColor: C.white,
            subtitleColor: "#E6DDF0",
            kickerColor: C.yellow,
          }),
          grid(
            { width: fill, height: fill, columns: [fr(1), fr(1), fr(1)], columnGap: 28 },
            [
              panel(
                { width: fill, height: fill, padding: 30, fill: P(C.white), line: P("transparent"), borderRadius: 24 },
                column(
                  { width: fill, height: fill, gap: 20 },
                  [
                    step(1, "Set up the agency", "Choose pilot seniors, define alert rules, and invite caregivers to the dashboard."),
                    rule({ width: fill, stroke: C.line, weight: 2 }),
                    valueLine("Small group", "Start with a contained pilot population."),
                    valueLine("Clear escalation", "Agree who gets alerted and when.", C.green),
                  ],
                ),
              ),
              panel(
                { width: fill, height: fill, padding: 30, fill: P(C.white), line: P("transparent"), borderRadius: 24 },
                column(
                  { width: fill, height: fill, gap: 20 },
                  [
                    step(2, "Onboard the senior", "Register consent, set preferences, and explain the voice interaction in plain language.", C.green),
                    rule({ width: fill, stroke: C.line, weight: 2 }),
                    valueLine("Known routines", "Medication times, language, and contact preferences."),
                    valueLine("Simple explanation", "No complex hardware or new app required.", C.green),
                  ],
                ),
              ),
              panel(
                { width: fill, height: fill, padding: 30, fill: P(C.white), line: P("transparent"), borderRadius: 24 },
                column(
                  { width: fill, height: fill, gap: 20 },
                  [
                    step(3, "Run daily support", "VYVA handles calls, reminders, check-ins, and alerts in the background.", C.blue),
                    rule({ width: fill, stroke: C.line, weight: 2 }),
                    valueLine("Less manual chasing", "Routine check-ins run automatically."),
                    valueLine("Better visit prep", "Caregivers see what happened since the last visit.", C.blue),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    ],
  ),
);

slide(
  layers(
    { width: fill, height: fill },
    [
      bg(),
      column(
        { width: fill, height: fill, padding: { x: 92, y: 70 }, gap: 38 },
        [
          deckTitle("A partnership model built for pilots, then rollout", "Collaboration", "Start with a small group, prove value in real life, and expand with confidence."),
          grid(
            { width: fill, height: fill, columns: [fr(1.1), fr(0.9)], columnGap: 44 },
            [
              column(
                { width: fill, height: fill, gap: 28, justifyContent: "center" },
                [
                  step(1, "Pilot setup", "Choose a small group of seniors. VYVA trains your team and sets up the dashboard."),
                  step(2, "Care + VYVA offer", "You offer VYVA as part of your care packages; VYVA runs calls and alerts in the background.", C.green),
                  step(3, "Review and scale", "Review alerts, usage, and family feedback; decide how many more seniors to enroll.", C.blue),
                ],
              ),
              panel(
                { width: fill, height: fill, padding: 34, fill: P(C.white), line: P(C.line), borderRadius: 24 },
                column(
                  { width: fill, height: fill, gap: 22, justifyContent: "center" },
                  [
                    t("What agencies gain", { size: 30, bold: true, color: C.ink }),
                    valueLine("New recurring revenue", "Per senior using VYVA."),
                    valueLine("Stronger value proposition", '"We are there between visits, not only during them."', C.green),
                    valueLine("Minimal extra workload", "Your team registers seniors; VYVA automates the rest.", C.blue),
                    valueLine("Marketing and training support", "VYVA helps you sell and run the service.", "#B7791F"),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    ],
  ),
);

slide(
  layers(
    { width: fill, height: fill },
    [
      bg(C.white),
      column(
        { width: fill, height: fill, padding: { x: 92, y: 70 }, gap: 38 },
        [
          deckTitle("Why home care agencies choose VYVA", "Agency value", "A premium service layer that helps agencies differentiate, reduce risk, and reassure families."),
          grid(
            { width: fill, height: fill, columns: [fr(1), fr(1)], rows: [fr(1), fr(1)], columnGap: 34, rowGap: 28 },
            [
              valueLine("Competitive advantage", 'Offer a premium, tech-enabled service that differentiates you from traditional agencies.'),
              valueLine("Risk reduction", "Catch issues earlier through proactive monitoring and alerts.", C.green),
              valueLine("Value for families", "Give families peace of mind when a caregiver is not physically present.", C.blue),
              valueLine("Better retention", "Caregivers feel more supported and prepared before each visit.", "#B7791F"),
            ],
          ),
        ],
      ),
    ],
  ),
);

slide(
  layers(
    { width: fill, height: fill },
    [
      bg(C.purpleDeep),
      grid(
        { width: fill, height: fill, columns: [fr(1), fr(0.92)], columnGap: 54, padding: { x: 92, y: 74 } },
        [
          column(
            { width: fill, height: fill, gap: 32, justifyContent: "center" },
            [
              column(
                { width: hug, height: hug, gap: 0 },
                [
                  t("VYVA", { width: fixed(200), size: 38, bold: true, color: C.white, lineSpacing: 0.9 }),
                  t("Your AI health assistant", { width: fixed(200), size: 12, bold: true, color: C.yellow, lineSpacing: 1 }),
                ],
              ),
              t("Let's build better care together", {
                size: 70,
                bold: true,
                color: C.white,
                width: wrap(760),
                lineSpacing: 0.95,
              }),
              t("Your expertise. Our AI. Thousands of seniors supported.", {
                size: 30,
                color: "#E7DDF2",
                width: wrap(700),
              }),
              row(
                { width: hug, height: hug, gap: 18 },
                [
                  miniLabel("Seniors", C.yellow),
                  t("+", { width: hug, size: 24, bold: true, color: "#E7DDF2" }),
                  miniLabel("Care agency", C.yellow),
                  t("+", { width: hug, size: 24, bold: true, color: "#E7DDF2" }),
                  miniLabel("AI companion", C.yellow),
                ],
              ),
            ],
          ),
          panel(
            { width: fill, height: fill, padding: 42, fill: P(C.white), line: P("transparent"), borderRadius: 28 },
            column(
              { width: fill, height: fill, gap: 30, justifyContent: "center" },
              [
                t("Contact", { size: 34, bold: true, color: C.ink }),
                valueLine("Email", "partnerships@mokadigital.net"),
                valueLine("Website", "vyva.life", C.green),
                valueLine("Company", "VYVA Health - MOKA DIGITECK, S.L.", C.blue),
                spacer(12),
                t("Pilot VYVA with a small group of your seniors and prove the value in real life.", {
                  size: 28,
                  bold: true,
                  color: C.purple,
                  lineSpacing: 1.08,
                }),
              ],
            ),
          ),
        ],
      ),
    ],
  ),
);

await mkdir(OUT, { recursive: true });
await mkdir(path.join(SCRATCH, "previews"), { recursive: true });
await mkdir(path.join(SCRATCH, "layouts"), { recursive: true });
await hydrateLocalImages();

const finalPptx = path.join(OUT, "VYVA_Home_Care_Agencies_Sales_Deck.pptx");
const compatibilityPptx = path.join(OUT, "output.pptx");
const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(finalPptx);
await pptx.save(compatibilityPptx);

for (const [index, s] of presentation.slides.items.entries()) {
  const png = await presentation.export({ slide: s, format: "png" });
  await writeFile(
    path.join(SCRATCH, "previews", `slide-${String(index + 1).padStart(2, "0")}.png`),
    Buffer.from(await png.arrayBuffer()),
  );

  const layout = await presentation.export({ slide: s, format: "layout" });
  await writeFile(
    path.join(SCRATCH, "layouts", `slide-${String(index + 1).padStart(2, "0")}.json`),
    await layout.text(),
  );
}

console.log(JSON.stringify({ slides: presentation.slides.items.length, finalPptx }, null, 2));
