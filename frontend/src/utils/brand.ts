import type { Phone } from "../types";

type BrandRule = {
  canonical: string;
  prefixes: RegExp[];
};

const BRAND_RULES: BrandRule[] = [
  { canonical: "REDMI", prefixes: [/^redmi/i, /^红米/i] },
  { canonical: "Apple", prefixes: [/^iphone/i, /^apple/i] },
  { canonical: "华为", prefixes: [/^huawei/i, /^华为/i, /^mate\b/i, /^pura\b/i, /^nova\b/i, /^畅享/i, /^麦芒/i] },
  { canonical: "荣耀", prefixes: [/^honor/i, /^荣耀/i] },
  { canonical: "OPPO", prefixes: [/^oppo/i, /^find\b/i, /^reno\b/i] },
  { canonical: "vivo", prefixes: [/^vivo/i] },
  { canonical: "iQOO", prefixes: [/^iqoo/i] },
  { canonical: "小米", prefixes: [/^xiaomi/i, /^小米/i, /^mi\b/i, /^mix\b/i, /^civi\b/i] },
  { canonical: "一加", prefixes: [/^oneplus/i, /^一加/i] },
  { canonical: "三星", prefixes: [/^samsung/i, /^三星/i, /^galaxy\b/i] },
  { canonical: "realme", prefixes: [/^realme/i, /^真我/i] },
  { canonical: "魅族", prefixes: [/^meizu/i, /^魅族/i, /^魅蓝/i] },
  { canonical: "努比亚", prefixes: [/^nubia/i, /^努比亚/i, /^红魔/i, /^腾讯红魔/i] },
  { canonical: "联想", prefixes: [/^lenovo/i, /^联想/i, /^拯救者/i, /^zuk/i] },
  { canonical: "moto", prefixes: [/^moto/i, /^motorola/i, /^摩托罗拉/i] },
  { canonical: "索尼", prefixes: [/^sony/i, /^索尼/i, /^xperia/i] },
  { canonical: "Google", prefixes: [/^google/i, /^谷歌/i, /^pixel/i, /^nexus/i] },
  { canonical: "中兴", prefixes: [/^zte/i, /^中兴/i] },
  { canonical: "ROG", prefixes: [/^rog/i] },
  { canonical: "Nothing", prefixes: [/^nothing/i] },
  { canonical: "LG", prefixes: [/^lg/i] },
  { canonical: "360", prefixes: [/^360/i] },
  { canonical: "黑鲨", prefixes: [/^black\s*shark/i, /^黑鲨/i] },
  { canonical: "多亲", prefixes: [/^duoqin/i, /^qin/i, /^多亲/i] },
  { canonical: "酷派", prefixes: [/^coolpad/i, /^酷派/i] },
  { canonical: "Nokia", prefixes: [/^nokia/i, /^诺基亚/i] },
  { canonical: "美图", prefixes: [/^meitu/i, /^美图/i] },
  { canonical: "BlackBerry", prefixes: [/^blackberry/i, /^黑莓/i] },
  { canonical: "雷鸟", prefixes: [/^雷鸟/i] },
  { canonical: "天翼", prefixes: [/^天翼/i] },
  { canonical: "坚果", prefixes: [/^smartisan/i, /^坚果/i] },
  { canonical: "POCO", prefixes: [/^poco/i] },
  { canonical: "蔚来", prefixes: [/^nio/i, /^蔚来/i] },
  { canonical: "Unihertz", prefixes: [/^unihertz/i] },
  { canonical: "AGM", prefixes: [/^agm/i] },
  { canonical: "CMF", prefixes: [/^cmf/i] },
  { canonical: "TCL", prefixes: [/^tcl/i] },
  { canonical: "WIKO", prefixes: [/^wiko/i] },
  { canonical: "Essential", prefixes: [/^essential/i] },
  { canonical: "夏普", prefixes: [/^sharp/i, /^夏普/i] },
  { canonical: "华硕", prefixes: [/^asus/i, /^华硕/i] },
  { canonical: "柔宇", prefixes: [/^royole/i, /^柔宇/i] },
  { canonical: "水月雨", prefixes: [/^moondrop/i, /^水月雨/i] }
];

export function normalizePhoneBrand(phone: Pick<Phone, "brand" | "name">) {
  const candidates = [phone.brand, phone.name].map(cleanBrandText).filter(Boolean);
  for (const candidate of candidates) {
    for (const rule of BRAND_RULES) {
      if (rule.prefixes.some((prefix) => prefix.test(candidate))) {
        return rule.canonical;
      }
    }
  }

  const brand = cleanBrandText(phone.brand);
  if (!brand || brand === "未知") return "未知";
  return brand.split(/\s+/)[0];
}

export function normalizePhoneSeries(phone: Pick<Phone, "brand" | "name">) {
  if ("series" in phone && typeof phone.series === "string" && phone.series.trim()) {
    return phone.series.trim();
  }

  const brand = normalizePhoneBrand(phone);
  const name = cleanBrandText(phone.name);
  const compactName = name.replace(/\s+/g, "");
  const upperName = name.toUpperCase();

  if (brand === "小米") {
    if (/MIX/i.test(name) || /^小米MIX/i.test(compactName)) return "MIX 系列";
    if (/CIVI/i.test(name) || /^小米Civi/i.test(compactName)) return "CIVI 系列";
    if (/CC/i.test(name) || /^小米CC/i.test(compactName)) return "CC 系列";
    if (/NOTE/i.test(upperName) || /^小米Note/i.test(compactName)) return "Note 系列";
    if (/MAX/i.test(name) || /^小米Max/i.test(compactName)) return "Max 系列";
    if (/PLAY/i.test(name) || /^小米Play/i.test(compactName)) return "Play 系列";
    if (/^小米\d/i.test(compactName) || /^MI\s*\d/i.test(upperName) || /^XIAOMI\s*\d/i.test(upperName)) return "数字系列";
    return "其他系列";
  }

  if (brand === "REDMI") {
    if (/NOTE/i.test(upperName) || /红米Note/i.test(compactName)) return "Note 系列";
    if (/TURBO/i.test(upperName)) return "Turbo 系列";
    if (/\bK\d/i.test(upperName) || /红米K\d/i.test(compactName)) return "K 系列";
    if (/\bA\d/i.test(upperName) || /红米\d+A/i.test(compactName)) return "A 系列";
    if (/PAD/i.test(upperName)) return "Pad 系列";
    if (/\bR\d/i.test(upperName)) return "R 系列";
    if (/^红米\d/i.test(compactName) || /^REDMI\s*\d/i.test(upperName)) return "数字系列";
    return "其他系列";
  }

  if (brand === "华为") {
    if (/MATE/i.test(upperName) || /^华为Mate/i.test(compactName)) return "Mate 系列";
    if (/PURA/i.test(upperName) || /^华为Pura/i.test(compactName)) return "Pura 系列";
    if (/^华为P\d/i.test(compactName) || /^HUAWEI\s*P\d/i.test(upperName)) return "P 系列";
    if (/NOVA/i.test(upperName) || /nova/i.test(name)) return "nova 系列";
    if (/畅享/i.test(name)) return "畅享系列";
    if (/麦芒/i.test(name)) return "麦芒系列";
    if (/POCKET/i.test(upperName) || /Pocket/i.test(name)) return "Pocket 系列";
    if (/^华为G\d/i.test(compactName)) return "G 系列";
    return "其他系列";
  }

  if (brand === "荣耀") {
    if (/MAGIC/i.test(upperName) || /荣耀Magic/i.test(compactName)) return "Magic 系列";
    if (/PLAY/i.test(upperName) || /荣耀Play/i.test(compactName)) return "Play 系列";
    if (/畅玩/i.test(name)) return "畅玩系列";
    if (/GT/i.test(upperName)) return "GT 系列";
    if (/WIN/i.test(upperName)) return "WIN 系列";
    if (/^荣耀V/i.test(compactName) || /^HONOR\s*V/i.test(upperName)) return "V 系列";
    if (/X\d/i.test(upperName) || /荣耀X\d/i.test(compactName)) return "X 系列";
    if (/NOTE/i.test(upperName) || /荣耀Note/i.test(compactName)) return "Note 系列";
    if (/POWER/i.test(upperName) || /荣耀Power/i.test(compactName)) return "Power 系列";
    if (/^荣耀\d/i.test(compactName) || /^HONOR\s*\d/i.test(upperName)) return "数字系列";
    return "其他系列";
  }

  if (brand === "OPPO") {
    if (/FIND/i.test(upperName)) return "Find 系列";
    if (/RENO/i.test(upperName)) return "Reno 系列";
    if (/\bR\d/i.test(upperName) || /^OPPOR\d/i.test(compactName)) return "R 系列";
    if (/ACE/i.test(upperName)) return "Ace 系列";
    if (/K\d/i.test(upperName)) return "K 系列";
    if (/A\d/i.test(upperName)) return "A 系列";
    return "其他系列";
  }

  if (brand === "vivo") {
    if (/X\s*FOLD/i.test(upperName) || /XFold/i.test(compactName)) return "X Fold 系列";
    if (/X\s*FLIP/i.test(upperName) || /XFlip/i.test(compactName)) return "X Flip 系列";
    if (/X\s*NOTE/i.test(upperName) || /XNote/i.test(compactName)) return "X Note 系列";
    if (/X\d/i.test(upperName) || /^vivoX\d/i.test(compactName)) return "X 系列";
    if (/S\d/i.test(upperName) || /^vivoS\d/i.test(compactName)) return "S 系列";
    if (/Y\d/i.test(upperName) || /^vivoY\d/i.test(compactName)) return "Y 系列";
    if (/Z\d/i.test(upperName) || /^vivoZ\d/i.test(compactName)) return "Z 系列";
    if (/T\d/i.test(upperName) || /^vivoT\d/i.test(compactName)) return "T 系列";
    if (/V\d/i.test(upperName) || /^vivoV\d/i.test(compactName)) return "V 系列";
    if (/APEX/i.test(upperName)) return "APEX 系列";
    if (/NEX/i.test(upperName)) return "NEX 系列";
    return "其他系列";
  }

  if (brand === "iQOO") {
    if (/NEO/i.test(upperName)) return "Neo 系列";
    if (/Z\d/i.test(upperName)) return "Z 系列";
    if (/U\d/i.test(upperName)) return "U 系列";
    if (/PRO/i.test(upperName)) return "Pro 系列";
    if (/^IQOO\s*\d/i.test(upperName) || /^iQOO\d/i.test(compactName)) return "数字系列";
    if (/^IQOO$/i.test(name)) return "初代系列";
    return "其他系列";
  }

  if (brand === "一加") {
    if (/ACE/i.test(upperName) || /一加Ace/i.test(compactName)) return "Ace 系列";
    if (/TURBO/i.test(upperName) || /一加Turbo/i.test(compactName)) return "Turbo 系列";
    if (/NORD/i.test(upperName)) return "Nord 系列";
    if (/^一加\d/i.test(compactName) || /^ONEPLUS\s*\d/i.test(upperName)) return "数字系列";
    return "其他系列";
  }

  if (brand === "三星") {
    if (/GALAXY\s*S/i.test(upperName) || /^三星S\d/i.test(compactName)) return "Galaxy S 系列";
    if (/GALAXY\s*Z/i.test(upperName) || /Fold|Flip/i.test(name)) return "Galaxy Z 系列";
    if (/GALAXY\s*A/i.test(upperName) || /^三星A\d/i.test(compactName)) return "Galaxy A 系列";
    if (/GALAXY\s*NOTE/i.test(upperName) || /三星Note/i.test(compactName)) return "Galaxy Note 系列";
    if (/^三星W\d/i.test(compactName)) return "W 系列";
    if (/GALAXY\s*C/i.test(upperName) || /^三星GalaxyC/i.test(compactName)) return "Galaxy C 系列";
    return "其他系列";
  }

  if (brand === "realme") {
    if (/GT/i.test(upperName)) return "GT 系列";
    if (/NEO/i.test(upperName) || /真我Neo/i.test(compactName)) return "Neo 系列";
    if (/Q\d/i.test(upperName)) return "Q 系列";
    if (/V\d/i.test(upperName)) return "V 系列";
    if (/X\d/i.test(upperName) || /^REALME\s*X/i.test(upperName) || /^真我X/i.test(compactName)) return "X 系列";
    if (/^真我\d/i.test(compactName) || /^REALME\s*\d/i.test(upperName)) return "数字系列";
    if (/^REALME\s*Q$/i.test(upperName)) return "Q 系列";
    if (/^REALME\s*X$/i.test(upperName)) return "X 系列";
    return "其他系列";
  }

  if (brand === "Apple") {
    if (/PRO\s*MAX/i.test(upperName)) return "Pro Max";
    if (/PRO/i.test(upperName)) return "Pro";
    if (/PLUS/i.test(upperName)) return "Plus";
    if (/MINI/i.test(upperName)) return "mini";
    if (/SE/i.test(upperName)) return "SE";
    return "标准系列";
  }

  if (brand === "Google") {
    if (/NEXUS/i.test(upperName)) return "Nexus 系列";
    if (/PRO/i.test(upperName)) return "Pixel Pro";
    if (/A\b/i.test(upperName)) return "Pixel A";
    if (/FOLD/i.test(upperName)) return "Pixel Fold";
    return "Pixel 标准系列";
  }

  if (brand === "努比亚") {
    if (/红魔|REDMAGIC/i.test(name)) return "红魔系列";
    if (/Z\d/i.test(upperName)) return "Z 系列";
    if (/PLAY/i.test(upperName)) return "Play 系列";
    if (/FLIP/i.test(upperName)) return "Flip 系列";
    if (/V\d/i.test(upperName)) return "V 系列";
    if (/^努比亚X/i.test(compactName)) return "X 系列";
    if (/小牛/i.test(name)) return "小牛系列";
    if (/M\d/i.test(upperName)) return "M 系列";
    return "其他系列";
  }

  if (brand === "魅族") {
    if (/魅蓝/i.test(name)) return "魅蓝系列";
    if (/PRO/i.test(upperName)) return "PRO 系列";
    if (/NOTE/i.test(upperName) || /魅族Note/i.test(compactName)) return "Note 系列";
    if (/^魅族X/i.test(compactName)) return "X 系列";
    if (/^魅族M/i.test(compactName)) return "M 系列";
    if (/LUCKY/i.test(upperName)) return "Lucky 系列";
    if (/ZERO/i.test(upperName)) return "zero 系列";
    if (/^魅族\d/i.test(compactName) || /^MEIZU\s*\d/i.test(upperName)) return "数字系列";
    return "其他系列";
  }

  if (brand === "moto") {
    if (/RAZR/i.test(upperName)) return "razr 系列";
    if (/EDGE/i.test(upperName)) return "edge 系列";
    if (/\bG\d/i.test(upperName) || /^motoG\d/i.test(compactName)) return "G 系列";
    if (/\bX\d/i.test(upperName) || /^motoX\d/i.test(compactName)) return "X 系列";
    if (/\bZ\d?/i.test(upperName) || /^MotoZ/i.test(compactName)) return "Z 系列";
    if (/\bS\d/i.test(upperName) || /^motoS\d/i.test(compactName)) return "S 系列";
    if (/P\d/i.test(upperName)) return "P 系列";
    if (/青柚/i.test(name)) return "青柚系列";
    return "其他系列";
  }

  if (brand === "中兴") {
    if (/AXON/i.test(upperName) || /天机/i.test(name)) return "Axon 系列";
    if (/远航/i.test(name)) return "远航系列";
    if (/BLADE/i.test(upperName)) return "Blade 系列";
    if (/畅行/i.test(name)) return "畅行系列";
    if (/^中兴S\d/i.test(compactName)) return "S 系列";
    return "其他系列";
  }

  if (brand === "索尼") {
    if (/XPERIA\s*1/i.test(upperName)) return "Xperia 1 系列";
    if (/XPERIA\s*5/i.test(upperName)) return "Xperia 5 系列";
    if (/XPERIA\s*10/i.test(upperName)) return "Xperia 10 系列";
    if (/XPERIA\s*XZ/i.test(upperName)) return "Xperia XZ 系列";
    if (/XPERIA\s*XA/i.test(upperName)) return "Xperia XA 系列";
    if (/XPERIA\s*PRO/i.test(upperName)) return "Xperia Pro 系列";
    if (/XPERIA\s*X/i.test(upperName)) return "Xperia X 系列";
    return "其他系列";
  }

  if (brand === "联想") {
    if (/拯救者/i.test(name)) return "拯救者系列";
    if (/ZUK/i.test(upperName)) return "ZUK 系列";
    if (/^联想Z\d/i.test(compactName)) return "Z 系列";
    if (/^联想K\d/i.test(compactName)) return "K 系列";
    if (/^联想S\d/i.test(compactName)) return "S 系列";
    if (/VIBE/i.test(upperName)) return "VIBE 系列";
    return "其他系列";
  }

  if (brand === "黑鲨") {
    if (/HELO/i.test(upperName)) return "Helo 系列";
    if (/\d/i.test(name)) return "数字系列";
    return "初代系列";
  }

  if (brand === "ROG") {
    if (/\d/i.test(name)) return "游戏手机数字系列";
    return "游戏手机初代系列";
  }

  if (brand === "Nokia") {
    if (/X\d/i.test(upperName)) return "X 系列";
    if (/PUREVIEW/i.test(upperName)) return "PureView 系列";
    if (/SIROCCO/i.test(upperName)) return "Sirocco 系列";
    if (/\d/i.test(name)) return "数字系列";
    return "其他系列";
  }

  if (brand === "Nothing") {
    if (/\(.*A.*\)/i.test(name) || /\bA\b/i.test(upperName)) return "Phone a 系列";
    return "Phone 系列";
  }

  if (brand === "LG") {
    if (/\bV\d/i.test(upperName)) return "V 系列";
    if (/\bG\d/i.test(upperName)) return "G 系列";
    return "其他系列";
  }

  if (brand === "多亲") {
    if (/QIN/i.test(upperName)) return "Qin 系列";
    if (/K\d/i.test(upperName)) return "K 系列";
    if (/F\d/i.test(upperName)) return "F 系列";
    return "其他系列";
  }

  if (brand === "360") {
    if (/\bN\d/i.test(upperName)) return "N 系列";
    return "其他系列";
  }

  if (brand === "坚果") {
    if (/PRO/i.test(upperName)) return "Pro 系列";
    if (/R\d/i.test(upperName)) return "R 系列";
    if (/\d/i.test(name)) return "数字系列";
    return "其他系列";
  }

  if (brand === "酷派") {
    if (/COOL/i.test(upperName)) return "COOL 系列";
    if (/大观/i.test(name)) return "大观系列";
    return "其他系列";
  }

  if (brand === "HTC") {
    if (/\bU\d/i.test(upperName)) return "U 系列";
    return "其他系列";
  }

  if (brand === "BlackBerry") {
    if (/KEY/i.test(upperName)) return "KEY 系列";
    return "其他系列";
  }

  if (brand === "蔚来") return "NIO Phone 系列";
  if (brand === "Unihertz") {
    if (/JELLY/i.test(upperName)) return "Jelly 系列";
    if (/TITAN/i.test(upperName)) return "Titan 系列";
    return "其他系列";
  }
  if (brand === "AGM" && /X\d/i.test(upperName)) return "X 系列";
  if (brand === "美图" && /T\d/i.test(upperName)) return "T 系列";
  if (brand === "CMF") return "Phone 系列";
  if (brand === "TCL" && /P\d/i.test(upperName)) return "P 系列";
  if (brand === "雷鸟" && /FF/i.test(upperName)) return "FF 系列";
  if (brand === "POCO") {
    if (/X\d/i.test(upperName)) return "X 系列";
    if (/F\d/i.test(upperName)) return "F 系列";
    if (/M\d/i.test(upperName)) return "M 系列";
    return "其他系列";
  }
  if (brand === "柔宇" && /FLEXPAI/i.test(upperName)) return "FlexPai 系列";
  if (brand === "华硕" && /ZENFONE/i.test(upperName)) return "Zenfone 系列";
  if (brand === "WIKO" && /X\d/i.test(upperName)) return "X 系列";
  if (brand === "水月雨" && /MIAD/i.test(upperName)) return "MIAD 系列";
  if (brand === "夏普" && /AQUOS/i.test(upperName)) return "AQUOS 系列";
  if (brand === "Essential") return "Phone 系列";
  if (brand === "天翼" && /\d/i.test(name)) return "数字系列";

  return "其他系列";
}

function cleanBrandText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/[（(].*?[）)]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
