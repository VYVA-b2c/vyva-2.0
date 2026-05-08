import { useMemo } from "react";
import { createAvatar } from "@dicebear/core";
import * as micah from "@dicebear/micah";

export const AVATAR_OPTIONS = {
  skinTone: ["light", "medium", "tan", "dark", "deep"],
  hairColor: ["black", "brown", "blonde", "red", "grey", "white"],
  hairStyle: ["short_straight", "short_curly", "medium_wavy", "long_straight", "bun", "bald", "short_textured"],
  eyeColor: ["brown", "blue", "green", "hazel"],
  eyeShape: ["round", "almond", "hooded"],
  hasGlasses: [true, false],
  glassStyle: ["round", "rectangle", "none"],
  facialHair: ["none", "stubble", "moustache", "full_beard"],
  faceShape: ["oval", "round", "square"],
  wrinkles: ["none", "light", "moderate"],
  accessory: ["none", "earrings", "necklace", "hat"],
  bgColors: ["#E8D5F5", "#D5E8F5", "#D5F5E0", "#F5E8D5", "#F5D5E8", "#E8F5D5", "#F5F5D5", "#D5F5F5"],
};

const SKIN = {
  light: "F7D6AD",
  medium: "D99A6A",
  tan: "B9773D",
  dark: "794327",
  deep: "3F2114",
};

const HAIR = {
  black: "201716",
  brown: "5D3828",
  blonde: "C99936",
  red: "9D4228",
  grey: "8F8F88",
  white: "EAE5DA",
};

const SHIRTS = ["6B21A8", "0F766E", "2563EB", "B45309", "A23A55", "4C1D95"];

const HAIR_STYLE = {
  short_straight: "fonze",
  short_curly: "mrT",
  medium_wavy: "full",
  long_straight: "full",
  bun: "full",
  bald: "mrClean",
  short_textured: "dougFunny",
};

const FACE_SHAPE_NOSE = {
  oval: "curve",
  round: "tound",
  square: "pointed",
};

function normalizeConfig(config = {}) {
  const hasGlasses = Boolean(config.hasGlasses);
  return {
    skinTone: config.skinTone ?? "medium",
    hairColor: config.hairColor ?? "brown",
    hairStyle: config.hairStyle ?? "short_straight",
    eyeShape: config.eyeShape ?? "round",
    hasGlasses,
    glassStyle: hasGlasses ? config.glassStyle ?? "round" : "none",
    facialHair: config.facialHair ?? "none",
    faceShape: config.faceShape ?? "oval",
    accessory: config.accessory ?? "none",
    bgColor: config.bgColor ?? "#E8D5F5",
  };
}

function stripHex(value) {
  return String(value ?? "").replace("#", "") || "E8D5F5";
}

function colorIndex(value = "", count) {
  return [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0) % count;
}

function buildAvatarOptions(face, seedKey, size) {
  const hairStyle = face.accessory === "hat" ? "turban" : HAIR_STYLE[face.hairStyle] ?? "fonze";
  const shirtColor = SHIRTS[colorIndex(`${seedKey}-shirt`, SHIRTS.length)];
  const hasFacialHair = face.facialHair !== "none";

  return {
    seed: seedKey,
    size,
    radius: 24,
    scale: 92,
    backgroundColor: [stripHex(face.bgColor)],
    baseColor: [SKIN[face.skinTone] ?? SKIN.medium],
    hair: [hairStyle],
    hairColor: [HAIR[face.hairColor] ?? HAIR.brown],
    hairProbability: face.hairStyle === "bald" ? 30 : 100,
    shirt: [face.accessory === "necklace" ? "open" : "crew"],
    shirtColor: [shirtColor],
    eyes: [face.hasGlasses ? "eyes" : face.eyeShape === "hooded" ? "eyes" : "smiling"],
    eyebrows: [face.eyeShape === "almond" ? "eyelashesUp" : "up"],
    nose: [FACE_SHAPE_NOSE[face.faceShape] ?? "curve"],
    mouth: ["smile"],
    glasses: [face.glassStyle === "rectangle" ? "square" : "round"],
    glassesColor: ["49345F"],
    glassesProbability: face.hasGlasses ? 100 : 0,
    facialHair: [face.facialHair === "full_beard" ? "beard" : "scruff"],
    facialHairColor: [HAIR[face.hairColor] ?? HAIR.brown],
    facialHairProbability: hasFacialHair ? 100 : 0,
    earrings: ["stud"],
    earringColor: ["F59E0B"],
    earringsProbability: face.accessory === "earrings" ? 100 : 0,
  };
}

export default function FaceAvatar({ config, size = 120 }) {
  const seedKey = useMemo(() => JSON.stringify(normalizeConfig(config)), [config]);
  const svg = useMemo(() => {
    const face = JSON.parse(seedKey);
    return createAvatar(micah, buildAvatarOptions(face, seedKey, size)).toString();
  }, [seedKey, size]);

  return (
    <img
      src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable="false"
      className="block shrink-0 select-none rounded-[28%]"
      style={{
        width: size,
        height: size,
        filter: "drop-shadow(0 8px 12px rgba(37, 24, 45, 0.12))",
      }}
    />
  );
}
