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
  light: "#FDDBB4",
  medium: "#E8A87C",
  tan: "#C68642",
  dark: "#8D4A2A",
  deep: "#4A2010",
};

const HAIR = {
  black: "#1A1A1A",
  brown: "#6B3A2A",
  blonde: "#D4A853",
  red: "#A0351A",
  grey: "#9E9E9E",
  white: "#E8E8E8",
};

const EYES = {
  brown: "#4B2E1F",
  blue: "#2563EB",
  green: "#15803D",
  hazel: "#8A5A22",
};

function normalizeConfig(config = {}) {
  const hasGlasses = Boolean(config.hasGlasses);
  return {
    skinTone: config.skinTone ?? "medium",
    hairColor: config.hairColor ?? "brown",
    hairStyle: config.hairStyle ?? "short_straight",
    eyeColor: config.eyeColor ?? "brown",
    eyeShape: config.eyeShape ?? "round",
    hasGlasses,
    glassStyle: hasGlasses ? config.glassStyle ?? "round" : "none",
    facialHair: config.facialHair ?? "none",
    faceShape: config.faceShape ?? "oval",
    wrinkles: config.wrinkles ?? "none",
    accessory: config.accessory ?? "none",
    bgColor: config.bgColor ?? "#E8D5F5",
  };
}

function FaceShape({ shape, fill }) {
  if (shape === "square") {
    return <rect x="34" y="31" width="52" height="61" rx="16" fill={fill} />;
  }

  if (shape === "round") {
    return <ellipse cx="60" cy="62" rx="49" ry="50" fill={fill} />;
  }

  return <ellipse cx="60" cy="62" rx="44" ry="55" fill={fill} />;
}

function Hair({ style, color }) {
  if (style === "bald") {
    return <path d="M39 42 C46 26 74 26 81 42" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" opacity="0.55" />;
  }

  if (style === "bun") {
    return (
      <>
        <circle cx="60" cy="20" r="14" fill={color} />
        <path d="M28 58 C29 29 43 18 60 18 C78 18 91 29 92 58 C82 44 39 44 28 58 Z" fill={color} />
      </>
    );
  }

  if (style === "short_curly") {
    return (
      <>
        <path d="M28 55 C28 33 42 23 60 23 C79 23 91 34 92 55 C80 43 41 43 28 55 Z" fill={color} />
        {[38, 48, 59, 70, 80].map((cx) => (
          <circle key={cx} cx={cx} cy={34 + (cx % 2) * 3} r="9" fill={color} />
        ))}
      </>
    );
  }

  if (style === "medium_wavy") {
    return <path d="M25 77 C24 42 37 23 59 23 C82 23 95 42 94 78 C84 65 82 42 67 41 C51 39 42 63 25 77 Z" fill={color} />;
  }

  if (style === "long_straight") {
    return <path d="M22 100 C23 54 30 22 60 21 C90 22 97 54 98 100 C85 90 35 90 22 100 Z" fill={color} />;
  }

  if (style === "short_textured") {
    return <path d="M28 55 L35 35 L43 47 L51 28 L60 45 L69 28 L77 47 L85 35 L92 55 C76 43 44 43 28 55 Z" fill={color} />;
  }

  return <path d="M28 56 C29 33 42 22 60 22 C78 22 91 33 92 56 C80 45 40 45 28 56 Z" fill={color} />;
}

function Eyes({ color, shape }) {
  const ry = shape === "hooded" ? 2.4 : shape === "almond" ? 3.2 : 4.2;
  const rx = shape === "round" ? 4.4 : 5.4;
  return (
    <>
      <path d="M42 49 C47 45 52 45 56 49" fill="none" stroke="#3A2722" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      <path d="M64 49 C68 45 73 45 78 49" fill="none" stroke="#3A2722" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      <ellipse cx="49" cy="56" rx={rx} ry={ry} fill="#FFFFFF" />
      <ellipse cx="71" cy="56" rx={rx} ry={ry} fill="#FFFFFF" />
      <circle cx="49" cy="56" r="2.9" fill={color} />
      <circle cx="71" cy="56" r="2.9" fill={color} />
      <circle cx="50" cy="55" r="1.1" fill="#111827" />
      <circle cx="72" cy="55" r="1.1" fill="#111827" />
    </>
  );
}

function Glasses({ style }) {
  if (style === "none") return null;
  const common = { fill: "none", stroke: "#3F2D56", strokeWidth: 2.5 };
  if (style === "rectangle") {
    return (
      <>
        <rect x="39" y="50" width="19" height="13" rx="4" {...common} />
        <rect x="62" y="50" width="19" height="13" rx="4" {...common} />
        <path d="M58 56 H62" {...common} />
      </>
    );
  }
  return (
    <>
      <circle cx="49" cy="56" r="9" {...common} />
      <circle cx="71" cy="56" r="9" {...common} />
      <path d="M58 56 H62" {...common} />
    </>
  );
}

function Wrinkles({ level }) {
  if (level === "none") return null;
  const opacity = level === "moderate" ? 0.45 : 0.28;
  return (
    <g stroke="#5C4036" strokeWidth="1.6" strokeLinecap="round" opacity={opacity} fill="none">
      <path d="M35 59 C38 57 41 57 44 59" />
      <path d="M76 59 C79 57 82 57 85 59" />
      <path d="M47 79 C55 84 65 84 73 79" />
      {level === "moderate" && (
        <>
          <path d="M45 72 C55 75 65 75 75 72" />
          <path d="M45 38 C54 35 66 35 75 38" />
        </>
      )}
    </g>
  );
}

function FacialHair({ style, color }) {
  if (style === "none") return null;
  if (style === "stubble") {
    return <ellipse cx="60" cy="78" rx="19" ry="12" fill={color} opacity="0.18" />;
  }
  if (style === "moustache") {
    return (
      <path
        d="M43 72 C49 66 56 67 60 72 C64 67 71 66 77 72 C71 78 64 77 60 73 C56 77 49 78 43 72 Z"
        fill={color}
      />
    );
  }
  return (
    <>
      <path d="M41 71 C47 91 73 91 79 71 C74 100 46 100 41 71 Z" fill={color} opacity="0.82" />
      <path d="M43 72 C49 66 56 67 60 72 C64 67 71 66 77 72 C71 78 64 77 60 73 C56 77 49 78 43 72 Z" fill={color} />
    </>
  );
}

function Accessory({ type }) {
  if (type === "earrings") {
    return (
      <>
        <circle cx="24" cy="68" r="3.5" fill="#F59E0B" />
        <circle cx="96" cy="68" r="3.5" fill="#F59E0B" />
      </>
    );
  }
  if (type === "necklace") {
    return <path d="M43 100 C51 108 69 108 77 100" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />;
  }
  if (type === "hat") {
    return (
      <>
        <path d="M35 32 C40 16 80 16 85 32 Z" fill="#6B21A8" />
        <rect x="29" y="31" width="62" height="8" rx="4" fill="#4C1D95" />
      </>
    );
  }
  return null;
}

export default function FaceAvatar({ config, size = 120 }) {
  const face = normalizeConfig(config);
  const skin = SKIN[face.skinTone] ?? SKIN.medium;
  const hair = HAIR[face.hairColor] ?? HAIR.brown;
  const eye = EYES[face.eyeColor] ?? EYES.brown;

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
      <circle cx="60" cy="60" r="58" fill={face.bgColor} />
      <Hair style={face.hairStyle} color={hair} />
      <FaceShape shape={face.faceShape} fill={skin} />
      <Accessory type={face.accessory} />
      <Eyes color={eye} shape={face.eyeShape} />
      <Glasses style={face.glassStyle} />
      <path d="M59 61 C57 67 56 70 60 72" fill="none" stroke="#8A5A44" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <path d="M49 83 C55 88 66 88 72 83" fill="none" stroke="#7A3A36" strokeWidth="3" strokeLinecap="round" />
      <Wrinkles level={face.wrinkles} />
      <FacialHair style={face.facialHair} color={hair} />
    </svg>
  );
}
