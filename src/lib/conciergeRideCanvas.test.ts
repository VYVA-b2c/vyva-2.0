import { buildConciergeRideCanvasViewModel, type ConciergeRideCanvasCopy } from "./conciergeRideCanvas";

const copy = new Proxy({}, { get: (_target, key) => String(key) }) as ConciergeRideCanvasCopy;
const base = {
  copy,
  destination: "City Clinic",
  pickup: "Saved home",
  requestedTime: "tomorrow morning",
  mobilityNeeds: [],
  savedPickupLabel: "Saved home",
  savedProviderName: "Trusted Taxi",
};

describe("concierge ride Canvas scenes", () => {
  it("collects each ride detail in a short, ordered scene", () => {
    expect(buildConciergeRideCanvasViewModel({ ...base, step: "destination" })).toMatchObject({
      sceneId: "ride-destination",
      kind: "text-entry",
      progress: { current: 1, total: 5 },
    });
    expect(buildConciergeRideCanvasViewModel({ ...base, step: "pickup" })).toMatchObject({
      sceneId: "ride-pickup",
      choices: [{ id: "saved_home" }, { id: "another_pickup" }],
    });
    expect(buildConciergeRideCanvasViewModel({ ...base, step: "time" }).choices).toHaveLength(5);
    expect(buildConciergeRideCanvasViewModel({ ...base, step: "mobility" }).choices?.[0].id).toBe("none");
  });

  it("blocks the flow at trusted provider setup without offering contact", () => {
    const scene = buildConciergeRideCanvasViewModel({ ...base, step: "provider" });
    expect(scene.kind).toBe("blocked");
    expect(scene.primaryAction?.label).toBe("addProvider");
    expect(scene.summaryRows).toBeUndefined();
  });

  it("keeps preparing and confirming as separate safety steps", () => {
    const selectedOption = { id: "taxi-1", label: "Radio Taxi", providerName: "Radio Taxi" };
    const prepare = buildConciergeRideCanvasViewModel({ ...base, step: "option_review", selectedOption });
    const confirm = buildConciergeRideCanvasViewModel({ ...base, step: "pending_confirm", selectedOption });

    expect(prepare.primaryAction?.label).toBe("prepareRide");
    expect(confirm.primaryAction?.label).toBe("confirmContact");
    expect(confirm.sceneId).not.toBe(prepare.sceneId);
  });

  it("shows pending detail, waiting, and completion states", () => {
    expect(buildConciergeRideCanvasViewModel({
      ...base,
      step: "pending_detail",
      pendingDetail: { label: "Pickup", prompt: "Where should it start?", placeholder: "Address" },
    }).kind).toBe("text-entry");
    expect(buildConciergeRideCanvasViewModel({ ...base, step: "waiting" }).status).toBe("loading");
    expect(buildConciergeRideCanvasViewModel({ ...base, step: "completed" }).status).toBe("success");
  });
});
