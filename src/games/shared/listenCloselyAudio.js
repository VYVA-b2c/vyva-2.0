import { getListenCloselyTimeline } from "./listenCloselyData";

function getAudioConstructor() {
  if (typeof window === "undefined") return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

export function canUseListenCloselyAudio() {
  return Boolean(getAudioConstructor());
}

export function createListenCloselyAudioContext() {
  const AudioConstructor = getAudioConstructor();
  if (!AudioConstructor) return null;
  return new AudioConstructor();
}

function createGainEnvelope(context, when, duration, peak = 0.24) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.06, duration));
  gain.connect(context.destination);
  return gain;
}

function playTone(context, {
  when,
  duration = 0.35,
  frequency = 440,
  endFrequency = null,
  type = "sine",
  volume = 0.24,
}) {
  const oscillator = context.createOscillator();
  const gain = createGainEnvelope(context, when, duration, volume);

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, when);
  if (endFrequency && oscillator.frequency.exponentialRampToValueAtTime) {
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, when + duration);
  }
  oscillator.connect(gain);
  oscillator.start(when);
  oscillator.stop(when + duration + 0.05);
}

function playNoise(context, {
  when,
  duration = 0.16,
  volume = 0.2,
  filterType = "bandpass",
  frequency = 1200,
}) {
  if (!context.createBuffer || !context.createBufferSource) {
    playTone(context, { when, duration, frequency, type: "triangle", volume });
    return;
  }

  const sampleRate = context.sampleRate || 44100;
  const buffer = context.createBuffer(1, Math.max(1, Math.floor(sampleRate * duration)), sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = createGainEnvelope(context, when, duration, volume);
  filter.type = filterType;
  filter.frequency.setValueAtTime(frequency, when);
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  source.start(when);
  source.stop(when + duration + 0.05);
}

export function playListenCloselySound(context, soundCharacter, when = context?.currentTime ?? 0, options = {}) {
  if (!context) return;
  const volume = options.volume ?? 0.25;

  switch (soundCharacter) {
    case "chime":
      playTone(context, { when, duration: 0.62, frequency: 740, endFrequency: 880, type: "sine", volume });
      playTone(context, { when: when + 0.04, duration: 0.55, frequency: 1110, type: "triangle", volume: volume * 0.45 });
      break;
    case "chirp":
      playTone(context, { when, duration: 0.22, frequency: 520, endFrequency: 1420, type: "sine", volume });
      break;
    case "tap":
      playNoise(context, { when, duration: 0.08, volume: volume * 0.9, filterType: "bandpass", frequency: 900 });
      break;
    case "whoosh":
      playNoise(context, { when, duration: 0.42, volume: volume * 0.68, filterType: "lowpass", frequency: 780 });
      break;
    case "drip":
      playTone(context, { when, duration: 0.16, frequency: 820, endFrequency: 350, type: "sine", volume });
      playTone(context, { when: when + 0.17, duration: 0.14, frequency: 500, endFrequency: 260, type: "sine", volume: volume * 0.55 });
      break;
    case "hum":
      playTone(context, { when, duration: 0.72, frequency: 165, type: "sine", volume: volume * 0.55 });
      playTone(context, { when, duration: 0.72, frequency: 220, type: "triangle", volume: volume * 0.25 });
      break;
    case "click":
      playTone(context, { when, duration: 0.055, frequency: 1350, type: "square", volume: volume * 0.72 });
      break;
    case "ring":
      playTone(context, { when, duration: 0.5, frequency: 980, type: "sine", volume });
      playTone(context, { when: when + 0.18, duration: 0.44, frequency: 980, type: "sine", volume: volume * 0.72 });
      break;
    default:
      playTone(context, { when, duration: 0.25, frequency: 520, type: "sine", volume });
  }
}

export function scheduleListenCloselySoundscape(context, soundscape, startAt = context?.currentTime ?? 0) {
  if (!context || !soundscape) return;

  getListenCloselyTimeline(soundscape).forEach((event) => {
    const volume = event.role === "distractor" ? 0.16 : 0.27;
    playListenCloselySound(context, event.sound_character, startAt + (event.time_ms / 1000), { volume });
  });

  if (soundscape.ambient_layer?.type === "soft_room") {
    const durationSeconds = Number(soundscape.duration_seconds ?? 18);
    for (let second = 0; second < durationSeconds; second += 6) {
      playListenCloselySound(context, "hum", startAt + second + 0.8, { volume: 0.05 });
    }
  }
}
