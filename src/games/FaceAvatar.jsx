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
  light: "#F8D7B1",
  medium: "#D99A6C",
  tan: "#B8793F",
  dark: "#7D442A",
  deep: "#44200F",
};

const HAIR = {
  black: "#211816",
  brown: "#68402C",
  blonde: "#C99738",
  red: "#A44727",
  grey: "#9B9B95",
  white: "#E9E5DD",
};

const CLOTHES = ["#6B21A8", "#0F766E", "#7C3AED", "#B45309", "#1D4E89", "#A23A55"];

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
    wrinkles: config.wrinkles ?? "none",
    accessory: config.accessory ?? "none",
    bgColor: config.bgColor ?? "#E8D5F5",
  };
}

function colorIndex(value = "") {
  return [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0) % CLOTHES.length;
}

function Head({ shape, fill }) {
  if (shape === "square") {
    return <path d="M36 42 C39 30 49 24 60 24 C71 24 81 30 84 42 L84 68 C84 88 75 99 60 99 C45 99 36 88 36 68 Z" fill={fill} />;
  }

  if (shape === "round") {
    return <circle cx="60" cy="63" r="38" fill={fill} />;
  }

  return <ellipse cx="60" cy="63" rx="34" ry="42" fill={fill} />;
}

function Ears({ fill }) {
  return (
    <g opacity="0.96">
      <circle cx="28" cy="65" r="7" fill={fill} />
      <circle cx="92" cy="65" r="7" fill={fill} />
    </g>
  );
}

function HairBack({ style, color }) {
  if (style === "bald") return null;

  if (style === "bun") {
    return (
      <g>
        <circle cx="60" cy="22" r="13" fill={color} />
        <path d="M29 61 C30 34 43 21 60 21 C77 21 90 34 91 61 C82 47 74 40 60 40 C46 40 38 47 29 61 Z" fill={color} />
      </g>
    );
  }

  if (style === "short_curly") {
    return (
      <g>
        <path d="M29 58 C30 34 43 23 60 23 C77 23 90 34 91 58 C81 48 73 42 60 42 C47 42 39 48 29 58 Z" fill={color} />
        {[36, 47, 58, 69, 80].map((cx, index) => (
          <circle key={cx} cx={cx} cy={34 + (index % 2) * 3} r="8" fill={color} />
        ))}
      </g>
    );
  }

  if (style === "medium_wavy") {
    return <path d="M26 80 C24 49 37 24 60 24 C83 24 96 49 94 80 C84 70 83 49 68 45 C53 42 44 67 26 80 Z" fill={color} />;
  }

  if (style === "long_straight") {
    return <path d="M23 106 C23 58 31 23 60 22 C89 23 97 58 97 106 C87 97 78 83 78 63 C72 51 48 51 42 63 C42 83 33 97 23 106 Z" fill={color} />;
  }

  if (style === "short_textured") {
    return <path d="M30 57 C30 36 43 24 60 24 C77 24 90 36 90 57 C81 49 73 45 60 45 C47 45 39 49 30 57 Z" fill={color} />;
  }

  return <path d="M30 57 C31 35 44 23 60 23 C76 23 89 35 90 57 C80 49 72 44 60 44 C48 44 40 49 30 57 Z" fill={color} />;
}

function HairFront({ style, color }) {
  if (style === "bald") {
    return <path d="M44 40 C51 36 69 36 76 40" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.45" />;
  }

  if (style === "bun") {
    return <path d="M36 45 C44 35 76 35 84 45 C72 40 48 40 36 45 Z" fill={color} />;
  }

  if (style === "short_curly") {
    return (
      <g>
        {[42, 52, 63, 74].map((cx, index) => (
          <circle key={cx} cx={cx} cy={42 + (index % 2) * 2} r="7" fill={color} />
        ))}
      </g>
    );
  }

  if (style === "medium_wavy") {
    return <path d="M33 55 C40 42 50 38 61 40 C72 42 79 48 86 57 C75 51 68 50 60 53 C50 57 42 57 33 55 Z" fill={color} />;
  }

  if (style === "long_straight") {
    return <path d="M31 66 C33 45 44 31 60 30 C76 31 87 45 89 66 C78 55 70 50 60 50 C50 50 42 55 31 66 Z" fill={color} />;
  }

  if (style === "short_textured") {
    return (
      <g>
        <path d="M34 52 C39 42 49 37 60 37 C71 37 81 42 86 52 C73 47 47 47 34 52 Z" fill={color} />
        <path d="M42 49 C48 44 54 44 60 49 C66 44 72 44 78 49" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeWidth="2" opacity="0.18" />
      </g>
    );
  }

  return <path d="M34 51 C40 39 49 33 60 33 C71 33 80 39 86 51 C73 45 47 45 34 51 Z" fill={color} />;
}

function Eyes({ shape }) {
  const radius = shape === "hooded" ? 2.4 : 3;
  return (
    <g fill="#2E2520">
      <circle cx="49" cy="63" r={radius} />
      <circle cx="71" cy="63" r={radius} />
    </g>
  );
}

function Glasses({ style }) {
  if (style === "none") return null;
  const frame = { fill: "none", stroke: "#49345F", strokeWidth: 3 };
  if (style === "rectangle") {
    return (
      <g>
        <rect x="39" y="57" width="19" height="13" rx="4" {...frame} />
        <rect x="62" y="57" width="19" height="13" rx="4" {...frame} />
        <path d="M58 63 H62" {...frame} />
      </g>
    );
  }
  return (
    <g>
      <circle cx="49" cy="63" r="9" {...frame} />
      <circle cx="71" cy="63" r="9" {...frame} />
      <path d="M58 63 H62" {...frame} />
    </g>
  );
}

function FacialHair({ style, color }) {
  if (style === "none") return null;
  if (style === "stubble") {
    return <path d="M44 78 C49 91 71 91 76 78 C70 96 50 96 44 78 Z" fill={color} opacity="0.16" />;
  }
  if (style === "moustache") {
    return <path d="M45 76 C51 71 57 72 60 76 C63 72 69 71 75 76 C68 80 63 80 60 77 C57 80 52 80 45 76 Z" fill={color} />;
  }
  return (
    <g>
      <path d="M42 75 C47 95 73 95 78 75 C75 101 45 101 42 75 Z" fill={color} opacity="0.78" />
      <path d="M45 76 C51 71 57 72 60 76 C63 72 69 71 75 76 C68 80 63 80 60 77 C57 80 52 80 45 76 Z" fill={color} />
    </g>
  );
}

function Wrinkles({ level }) {
  if (level === "none") return null;
  const opacity = level === "moderate" ? 0.32 : 0.18;
  return (
    <g fill="none" stroke="#6A4737" strokeLinecap="round" strokeWidth="1.7" opacity={opacity}>
      <path d="M46 48 C54 45 66 45 74 48" />
      {level === "moderate" && <path d="M48 83 C55 87 65 87 72 83" />}
    </g>
  );
}

function Accessory({ type }) {
  if (type === "earrings") {
    return (
      <g fill="#F59E0B">
        <circle cx="29" cy="70" r="3" />
        <circle cx="91" cy="70" r="3" />
      </g>
    );
  }
  if (type === "necklace") {
    return <path d="M44 101 C52 108 68 108 76 101" fill="none" stroke="#F59E0B" strokeLinecap="round" strokeWidth="3" />;
  }
  if (type === "hat") {
    return (
      <g>
        <path d="M36 36 C41 20 79 20 84 36 Z" fill="#6B21A8" />
        <rect x="30" y="34" width="60" height="8" rx="4" fill="#4C1D95" />
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
      <path d="M44 100 C52 107 68 107 76 100 L84 115 H36 Z" fill="#FFFFFF" opacity="0.14" />
    </g>
  );
}

export default function FaceAvatar({ config, size = 120 }) {
  const face = normalizeConfig(config);
  const skin = SKIN[face.skinTone] ?? SKIN.medium;
  const hair = HAIR[face.hairColor] ?? HAIR.brown;
  const clothes = CLOTHES[colorIndex(`${face.bgColor}-${face.hairStyle}-${face.accessory}`)];

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
      <circle cx="92" cy="25" r="20" fill="#FFFFFF" opacity="0.28" />
      <circle cx="29" cy="95" r="26" fill="#FFFFFF" opacity="0.16" />
      <ellipse cx="60" cy="114" rx="36" ry="4" fill="#2E193F" opacity="0.09" />
      <Bust skin={skin} clothes={clothes} />
      <HairBack style={face.hairStyle} color={hair} />
      <Ears fill={skin} />
      <Head shape={face.faceShape} fill={skin} />
      <HairFront style={face.hairStyle} color={hair} />
      <Accessory type={face.accessory} />
      <ellipse cx="44" cy="74" rx="6" ry="3.5" fill="#F7A8A8" opacity="0.18" />
      <ellipse cx="76" cy="74" rx="6" ry="3.5" fill="#F7A8A8" opacity="0.18" />
      <Eyes shape={face.eyeShape} />
      <Glasses style={face.glassStyle} />
      <path d="M60 67 C58 72 58 75 61 77" fill="none" stroke="#7B5140" strokeLinecap="round" strokeWidth="2" opacity="0.42" />
      <FacialHair style={face.facialHair} color={hair} />
      <path d="M50 86 C56 91 65 91 71 86" fill="none" stroke="#743A36" strokeLinecap="round" strokeWidth="3" />
      <Wrinkles level={face.wrinkles} />
      <rect x="5" y="5" width="110" height="110" rx="32" fill="none" stroke="#FFFFFF" strokeWidth="2" opacity="0.7" />
    </svg>
  );
}
