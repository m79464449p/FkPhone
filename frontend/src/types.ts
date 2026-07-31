export type Phone = {
  id: string;
  name: string;
  brand: string;
  series: string | null;
  score: number;
  source: string | null;
  source_product_id: string | null;
  price: number | null;
  specs: string | null;
  image_url: string | null;
  source_url: string | null;
  version_count: number;
};

export type SortKey = "release_desc" | "score" | "price_asc" | "price_desc" | "name";
export type WorkspaceTab = "parameters" | "ranking" | "goofish";
export type PerformanceFloor = "" | "snapdragon_8_gen3" | "snapdragon_8_elite" | "snapdragon_8_elite_gen5";

export type VersionSpec = {
  group: string;
  subgroup: string;
  name: string;
  value: string;
};

export type PhoneVersion = {
  config_id: string;
  phone_id: string;
  title: string;
  price: number | null;
  specs: VersionSpec[];
  source_url: string | null;
};

export type PhoneSpecFilterValue = {
  value: string;
  phone_count: number;
  version_count: number;
};

export type PhoneSpecFilter = {
  key: string;
  group: string;
  subgroup: string;
  name: string;
  label: string;
  phone_count: number;
  values: PhoneSpecFilterValue[];
};

export type SelectedSpecFilter = {
  key: string;
  label: string;
  value: string;
};

export type CompareSelection = {
  config_id: string;
  phone_name: string;
  title: string;
};

export type CompareColumn = {
  config_id: string;
  phone_id: string;
  phone_name: string;
  title: string;
  price: number | null;
  source_url: string | null;
};

export type CompareRow = {
  group: string;
  subgroup: string;
  name: string;
  values: Record<string, string | null>;
};

export type PhoneCompare = {
  columns: CompareColumn[];
  rows: CompareRow[];
};

export type GoofishListing = {
  item_id: string;
  title: string;
  price: number | null;
  location: string | null;
  want_count: number | null;
  browse_count: number | null;
  seller_credit: string | null;
  image_url: string | null;
  image_urls: string[];
  source_url: string;
  raw_text: string;
  keywords: string[];
  last_seen_at: string | null;
};

export type GoofishSearchResponse = {
  status: string;
  keywords: string[];
  inserted: number;
  updated: number;
  matched: number;
  login_required: boolean;
  message: string | null;
};

export type GoofishLoginStatus = {
  status: string;
  active: boolean;
  message: string;
  screenshot_available: boolean;
  screenshot_version: number;
};

export type GoofishSpec = {
  label: string;
  value: string;
};
