import { describe, expect, it } from "vitest";
import de from "./i18n/de";
import en from "./i18n/en";
import es from "./i18n/es";
import fr from "./i18n/fr";
import itCopy from "./i18n/it";
import pt from "./i18n/pt";
import { SHOW_VYVA_LIVE_CAMERA_STATUSES } from "./lib/showVyvaEvidence";
import { SHOW_VYVA_USE_CASES } from "../shared/showVyvaFlow";

describe("Show VYVA capture translations", () => {
  it.each(Object.entries({ en, es, fr, de, it: itCopy, pt }))("covers capture coaching in %s", (_language, copy) => {
    const capture = copy.showVyva.capture;
    expect(capture.previewTitle).toBeTruthy();
    expect(capture.privacyBody).toBeTruthy();
    expect(capture.imageNotRetained).toBeTruthy();
    expect(capture.retake).toBeTruthy();
    expect(capture.rotate).toBeTruthy();
    expect(capture.useThis).toBeTruthy();
    expect(capture.quality.dark).toBeTruthy();
    expect(capture.quality.glare).toBeTruthy();
    expect(capture.quality.blur).toBeTruthy();
    expect(capture.quality.framing).toBeTruthy();
    for (const useCase of SHOW_VYVA_USE_CASES) {
      expect(capture.instruction[useCase.id]).toBeTruthy();
    }

    const liveCamera = copy.showVyva.liveCamera;
    expect(liveCamera.title).toBeTruthy();
    expect(liveCamera.taskOpen).toBeTruthy();
    expect(liveCamera.autoCapture).toBeTruthy();
    expect(liveCamera.takePhoto).toBeTruthy();
    expect(liveCamera.unavailableTitle).toBeTruthy();
    expect(liveCamera.useDeviceCamera).toBeTruthy();
    for (const status of SHOW_VYVA_LIVE_CAMERA_STATUSES) {
      expect(liveCamera.status[status]).toBeTruthy();
    }
    expect(liveCamera.spoken.turnOffGuidance).toBeTruthy();
    expect(liveCamera.spoken.turnOnGuidance).toBeTruthy();
    expect(liveCamera.spoken.turnOffCommands).toBeTruthy();
    expect(liveCamera.spoken.turnOnCommands).toBeTruthy();
    expect(liveCamera.spoken.commandsUnavailable).toBeTruthy();
    expect(liveCamera.spoken.commandHint).toBeTruthy();
    expect(liveCamera.spoken.preparingCommands).toBeTruthy();
    expect(liveCamera.spoken.prompt.find_more_light).toBeTruthy();
    expect(liveCamera.spoken.prompt.move_closer).toBeTruthy();
    expect(liveCamera.spoken.prompt.tilt_away_from_glare).toBeTruthy();
    expect(liveCamera.spoken.prompt.hold_steady).toBeTruthy();
    expect(liveCamera.spoken.countdown.three).toBeTruthy();
    expect(liveCamera.spoken.countdown.two).toBeTruthy();
    expect(liveCamera.spoken.countdown.one).toBeTruthy();
    expect(liveCamera.spoken.captured).toBeTruthy();
  });
});
