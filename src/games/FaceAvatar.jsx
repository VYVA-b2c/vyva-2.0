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
  light: "#F6D2A4",
  medium: "#D69462",
  tan: "#B6783B",
  dark: "#744226",
  deep: "#3F2114",
};

const HAIR = {
  black: "#201716",
  brown: "#5F3B2A",
  blonde: "#C99A36",
  red: "#9E4328",
  grey: "#8E8E87",
  white: "#EAE5DA",
};

const CLOTHES = ["#6B21A8", "#0F766E", "#2563EB", "#B45309", "#A23A55", "#4C1D95"];
const MARKS = ["#F59E0B", "#14B8A6", "#7C3AED", "#DB2777", "#2563EB", "#16A34A"];

function normalizeConfig(config = {}) {
  const hasGlasses = Boolean(config.hasGlasses);
  return {
    skinTone: config.skinTone ?? "medium",
    hairColor: config.hairColor ?? "brown",
    hairStyle: config.hairStyle ?? "short_straight",
    hasGlasses,
    glassStyle: hasGlasses ? config.glassStyle ?? "round" : "none",
    facialHair: config.facialHair ?? "none",
    faceShape: config.faceShape ?? "oval",
    accessory: config.accessory ?? "none",
    bgColor: config.bgColor ?? "#E8D5F5",
  };
}

function colorIndex(value = "", count) {
  return [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0) % count;
}

function Head({ shape, fill }) {
  if (shape === "square") {
    return <rect x="35" y="35" width="50" height="59" rx="18" fill={fill} />;
  }

  if (shape === "round") {
    return <circle cx="60" cy="63" r="35" fill={fill} />;
  }

  return <ellipse cx="60" cy="63" rx="32" ry="41" fill={fill} />;
}

function HairBack({ style, color }) {
  if (style === "bald") return null;

  if (style === "bun") {
    return (
      <g>
        <circle cx="60" cy="23" r="13" fill={color} />
        <path d="M29 67 C29 40 42 24 60 24 C78 24 91 40 91 67 C82 56 74 49 60 49 C46 49 38 56 29 67 Z" fill={color} />
      </g>
    );
  }

  if (style === "short_curly") {
    return (
      <g>
        <path d="M29 63 C29 39 42 25 60 25 C78 25 91 39 91 63 C81 54 73 50 60 50 C47 50 39 54 29 63 Z" fill={color} />
        {[38, 49, 60, 71, 82].map((cx) => (
          <circle key={cx} cx={cx} cy="38" r="8" fill={color} />
        ))}
      </g>
    );
  }

  if (style === "medium_wavy") {
    return <path d="M26 88 C24 54 37 25 60 25 C83 25 96 54 94 88 C83 76 80 58 68 51 C53 45 44 75 26 88 Z" fill={color} />;
  }

  if (style === "long_straight") {
    return <path d="M23 108 C24 60 32 24 60 23 C88 24 96 60 97 108 C85 98 79 83 79 63 C73 52 47 52 41 63 C41 83 35 98 23 108 Z" fill={color} />;
  }

  return <path d="M30 63 C31 40 43 26 60 26 C77 26 89 40 90 63 C80 55 72 50 60 50 C48 50 40 55 30 63 Z" fill={color} />;
}

function HairFront({ style, color }) {
  if (style === "bald") {
    return <path d="M44 41 C51 37 69 37 76 41" fill="none" stroke={color} strokeLinecap="round" strokeWidth="4" opacity="0.45" />;
  }

  if (style === "bun") {
    return <path d="M36 47 C44 38 76 38 84 47 C73 43 47 43 36 47 Z" fill={color} />;
  }

  if (style === "short_curly") {
    return (
      <g>
        {[42, 51, 60, 69, 78].map((cx, index) => (
          <circle key={cx} cx={cx} cy={45 + (index % 2)} r="7" fill={color} />
        ))}
      </g>
    );
  }

  if (style === "medium_wavy") {
    return <path d="M33 57 C41 45 51 41 62 43 C72 45 79 50 86 59 C74 54 67 54 60 57 C50 62 42 61 33 57 Z" fill={color} />;
  }

  if (style === "long_straight") {
    return <path d="M31 68 C33 47 44 33 60 32 C76 33 87 47 89 68 C78 58 70 53 60 53 C50 53 42 58 31 68 Z" fill={color} />;
  }

  if (style === "short_textured") {
    return (
      <g>
        <path d="M34 54 C40 44 49 39 60 39 C71 39 80 44 86 54 C74 50 46 50 34 54 Z" fill={color} />
        <path d="M43 50 C49 47 54 47 60 50 C66 47 71 47 77 50" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeWidth="2.2" opacity="0.18" />
      </g>
    );
  }

  return <path d="M34 54 C40 42 49 36 60 36 C71 36 80 42 86 54 C74 49 46 49 34 54 Z" fill={color} />;
}

function Glasses({ style }) {
  if (style === "none") return null;
  const frame = { fill: "none", stroke: "#49345F", strokeWidth: 4 };

  if (style === "rectangle") {
    return (
      <g>
        <rect x="38" y="57" width="20" height="15" rx="5" {...frame} />
        <rect x="62" y="57" width="20" height="15" rx="5" {...frame} />
        <path d="M58 64 H62" {...frame} />
      </g>
    );
  }

  return (
    <g>
      <circle cx="49" cy="64" r="10" {...frame} />
      <circle cx="71" cy="64" r="10" {...frame} />
      <path d="M59 64 H61" {...frame} />
    </g>
  );
}

function FacialHair({ style, color }) {
  if (style === "none") return null;
  if (style === "stubble") {
    return <path d="M45 79 C50 91 70 91 75 79 C69 96 51 96 45 79 Z" fill={color} opacity="0.14" />;
  }
  if (style === "moustache") {
    return <path d="M45 76 C51 71 57 72 60 76 C63 72 69 71 75 76 C69 80 63 80 60 77 C57 80 51 80 45 76 Z" fill={color} />;
  }
  return <path d="M42 75 C48 96 72 96 78 75 C75 101 45 101 42 75 Z" fill={color} opacity="0.78" />;
}

function Accessory({ type }) {
  if (type === "earrings") {
    return (
      <g fill="#F59E0B">
        <circle cx="30" cy="70" r="4" />
        <circle cx="90" cy="70" r="4" />
      </g>
    );
  }
  if (type === "necklace") {
    return <path d="M44 101 C52 109 68 109 76 101" fill="none" stroke="#F59E0B" strokeLinecap="round" strokeWidth="4" />;
  }
  if (type === "hat") {
    return (
      <g>
        <path d="M36 38 C41 21 79 21 84 38 Z" fill="#6B21A8" />
        <rect x="30" y="36" width="60" height="9" rx="5" fill="#4C1D95" />
      </g>
    );
  }
  return null;
}

function Bust({ skin, clothes }) {
  return (
    <g>
      <path d="M21 115 C26 98 40 89 60 89 C80 89 94 98 99 115 Z" fill={clothes} />
      <path d="M50 84 H70 V104 C66 108 54 108 50 104 Z" fill={skin} />
      <path d="M44 100 C52 107 68 107 76 100 L84 115 H36 Z" fill="#FFFFFF" opacity="0.16" />
    </g>
  );
}

function IdentityMark({ color }) {
  return (
    <g>
      <circle cx="92" cy="93" r="13" fill="#FFFFFF" opacity="0.82" />
      <circle cx="92" cy="93" r="8" fill={color} />
    </g>
  );
}

export default function FaceAvatar({ config, size = 120 }) {
  const face = normalizeConfig(config);
  const skin = SKIN[face.skinTone] ?? SKIN.medium;
  const hair = HAIR[face.hairColor] ?? HAIR.brown;
  const clothes = CLOTHES[colorIndex(`${face.bgColor}-${face.hairStyle}-${face.accessory}`, CLOTHES.length)];
  const mark = MARKS[colorIndex(`${face.skinTone}-${face.hairColor}-${face.glassStyle}`, MARKS.length)];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-hidden="true"
      focusable="false"
      className="block shrink-0"
    >
      <rect x="5" y="5" width="110" height="110" rx="32" fill={face.bgColor} />
      <circle cx="91" cy="27" r="21" fill="#FFFFFF" opacity="0.28" />
      <circle cx="29" cy="95" r="26" fill="#FFFFFF" opacity="0.16" />
      <ellipse cx="60" cy="114" rx="36" ry="4" fill="#2E193F" opacity="0.08" />
      <Bust skin={skin} clothes={clothes} />
      <HairBack style={face.hairStyle} color={hair} />
      <circle cx="29" cy="65" r="7" fill={skin} opacity="0.96" />
      <circle cx="91" cy="65" r="7" fill={skin} opacity="0.96" />
      <Head shape={face.faceShape} fill={skin} />
      <HairFront style={face.hairStyle} color={hair} />
      <Accessory type={face.accessory} />
      <Glasses style={face.glassStyle} />
      <FacialHair style={face.facialHair} color={hair} />
      <IdentityMark color={mark} />
      <rect x="5" y="5" width="110" height="110" rx="32" fill="none" stroke="#FFFFFF" strokeWidth="2" opacity="0.7" />
    </svg>
  );
}
