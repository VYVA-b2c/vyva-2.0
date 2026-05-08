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

const EYES = {
  brown: "#4B2E1F",
  blue: "#2563A8",
  green: "#237A4C",
  hazel: "#805C28",
};

const CLOTHES = ["#6B21A8", "#0F766E", "#7C3AED", "#B45309", "#1D4E89", "#A23A55"];

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

function colorIndex(value = "") {
  return [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0) % CLOTHES.length;
}

function Head({ shape, fill }) {
  if (shape === "square") {
    return <path d="M36 42 C39 29 49 22 60 22 C72 22 82 29 85 42 L86 67 C86 88 75 100 60 100 C45 100 34 88 34 67 Z" fill={fill} />;
  }

  if (shape === "round") {
    return <path d="M29 62 C29 38 42 24 60 24 C78 24 91 38 91 62 C91 87 78 101 60 101 C42 101 29 87 29 62 Z" fill={fill} />;
  }

  return <path d="M33 61 C33 37 44 22 60 22 C76 22 87 37 87 61 C87 86 76 101 60 101 C44 101 33 86 33 61 Z" fill={fill} />;
}

function Hair({ style, color }) {
  if (style === "bald") {
    return <path d="M40 39 C45 27 75 27 80 39" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" opacity="0.55" />;
  }

  if (style === "bun") {
    return (
      <>
        <circle cx="60" cy="20" r="13" fill={color} />
        <path d="M29 58 C29 34 41 21 60 21 C79 21 91 34 91 58 C82 44 74 39 60 39 C46 39 38 44 29 58 Z" fill={color} />
        <path d="M39 35 C46 45 75 45 82 35 C76 27 45 27 39 35 Z" fill={color} opacity="0.78" />
      </>
    );
  }

  if (style === "short_curly") {
    return (
      <>
        <path d="M29 57 C29 35 42 23 60 23 C78 23 91 35 91 57 C82 45 74 39 60 39 C46 39 38 45 29 57 Z" fill={color} />
        {[35, 45, 55, 65, 75, 85].map((cx, index) => (
          <circle key={cx} cx={cx} cy={34 + (index % 2) * 3} r="8" fill={color} />
        ))}
      </>
    );
  }

  if (style === "medium_wavy") {
    return <path d="M25 79 C24 45 37 23 60 23 C83 23 96 45 95 79 C83 68 84 45 68 42 C53 40 44 64 25 79 Z" fill={color} />;
  }

  if (style === "long_straight") {
    return <path d="M22 104 C23 58 31 22 60 21 C89 22 97 58 98 104 C88 95 80 82 80 62 C75 49 45 49 40 62 C40 82 32 95 22 104 Z" fill={color} />;
  }

  if (style === "short_textured") {
    return <path d="M29 55 L35 37 L43 47 L50 28 L59 45 L68 28 L76 47 L84 37 L91 55 C77 45 43 45 29 55 Z" fill={color} />;
  }

  return <path d="M29 57 C30 34 43 22 60 22 C77 22 90 34 91 57 C82 47 75 42 60 42 C45 42 38 47 29 57 Z" fill={color} />;
}

function Eyes({ color, shape }) {
  const ry = shape === "hooded" ? 2.2 : shape === "almond" ? 3 : 4;
  const rx = shape === "round" ? 4 : 5;
  return (
    <g>
      <path d="M42 53 C46 49 52 49 56 53" fill="none" stroke="#4B352D" strokeWidth="2.2" strokeLinecap="round" opacity="0.65" />
      <path d="M64 53 C68 49 74 49 78 53" fill="none" stroke="#4B352D" strokeWidth="2.2" strokeLinecap="round" opacity="0.65" />
      <ellipse cx="49" cy="60" rx={rx} ry={ry} fill="#FFFFFF" />
      <ellipse cx="71" cy="60" rx={rx} ry={ry} fill="#FFFFFF" />
      <circle cx="49" cy="60" r="2.8" fill={color} />
      <circle cx="71" cy="60" r="2.8" fill={color} />
      <circle cx="50" cy="59" r="1" fill="#15100E" />
      <circle cx="72" cy="59" r="1" fill="#15100E" />
    </g>
  );
}

function Glasses({ style }) {
  if (style === "none") return null;
  const frame = { fill: "none", stroke: "#49345F", strokeWidth: 2.8 };
  if (style === "rectangle") {
    return (
      <g>
        <rect x="38" y="53" width="20" height="14" rx="4" {...frame} />
        <rect x="62" y="53" width="20" height="14" rx="4" {...frame} />
        <path d="M58 60 H62" {...frame} />
      </g>
    );
  }

  return (
    <g>
      <circle cx="49" cy="60" r="10" {...frame} />
      <circle cx="71" cy="60" r="10" {...frame} />
      <path d="M59 60 H61" {...frame} />
    </g>
  );
}

function Wrinkles({ level }) {
  if (level === "none") return null;
  const opacity = level === "moderate" ? 0.38 : 0.24;
  return (
    <g stroke="#6A4737" strokeWidth="1.5" strokeLinecap="round" opacity={opacity} fill="none">
      <path d="M37 65 C40 63 43 63 46 65" />
      <path d="M74 65 C77 63 80 63 83 65" />
      <path d="M48 82 C56 86 65 86 73 82" />
      {level === "moderate" && (
        <>
          <path d="M46 45 C54 42 66 42 74 45" />
          <path d="M45 76 C55 79 65 79 75 76" />
        </>
      )}
    </g>
  );
}

function FacialHair({ style, color }) {
  if (style === "none") return null;
  if (style === "stubble") {
    return <path d="M43 75 C48 91 72 91 77 75 C72 98 48 98 43 75 Z" fill={color} opacity="0.16" />;
  }
  if (style === "moustache") {
    return <path d="M43 74 C50 68 56 69 60 74 C64 69 70 68 77 74 C70 79 64 79 60 75 C56 79 50 79 43 74 Z" fill={color} />;
  }
  return (
    <g>
      <path d="M41 73 C47 95 73 95 79 73 C75 101 45 101 41 73 Z" fill={color} opacity="0.82" />
      <path d="M43 74 C50 68 56 69 60 74 C64 69 70 68 77 74 C70 79 64 79 60 75 C56 79 50 79 43 74 Z" fill={color} />
    </g>
  );
}

function Accessory({ type }) {
  if (type === "earrings") {
    return (
      <g>
        <circle cx="30" cy="70" r="3.2" fill="#F59E0B" />
        <circle cx="90" cy="70" r="3.2" fill="#F59E0B" />
      </g>
    );
  }
  if (type === "necklace") {
    return <path d="M43 104 C51 111 69 111 77 104" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />;
  }
  if (type === "hat") {
    return (
      <g>
        <path d="M35 35 C40 18 80 18 85 35 Z" fill="#6B21A8" />
        <rect x="29" y="33" width="62" height="8" rx="4" fill="#4C1D95" />
      </g>
    );
  }
  return null;
}

export default function FaceAvatar({ config, size = 120 }) {
  const face = normalizeConfig(config);
  const skin = SKIN[face.skinTone] ?? SKIN.medium;
  const hair = HAIR[face.hairColor] ?? HAIR.brown;
  const eye = EYES[face.eyeColor] ?? EYES.brown;
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
      <circle cx="92" cy="24" r="20" fill="#FFFFFF" opacity="0.24" />
      <path d="M21 115 C26 97 39 88 60 88 C81 88 94 97 99 115 Z" fill={clothes} />
      <path d="M50 84 H70 V105 C66 109 54 109 50 105 Z" fill={skin} />
      <ellipse cx="31" cy="66" rx="7" ry="10" fill={skin} opacity="0.92" />
      <ellipse cx="89" cy="66" rx="7" ry="10" fill={skin} opacity="0.92" />
      <Hair style={face.hairStyle} color={hair} />
      <Head shape={face.faceShape} fill={skin} />
      <Accessory type={face.accessory} />
      <Eyes color={eye} shape={face.eyeShape} />
      <Glasses style={face.glassStyle} />
      <path d="M59 65 C57 70 57 73 61 75" fill="none" stroke="#7B5140" strokeWidth="2" strokeLinecap="round" opacity="0.46" />
      <path d="M49 86 C55 91 66 91 72 86" fill="none" stroke="#743A36" strokeWidth="3" strokeLinecap="round" />
      <Wrinkles level={face.wrinkles} />
      <FacialHair style={face.facialHair} color={hair} />
      <rect x="5" y="5" width="110" height="110" rx="32" fill="none" stroke="#FFFFFF" strokeWidth="2" opacity="0.65" />
    </svg>
  );
}
