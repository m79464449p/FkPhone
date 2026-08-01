import json
import re

import scrapy

from fkphone_crawler.items import PhoneItem, PhoneVersionItem


class CoolapkPhoneSpider(scrapy.Spider):
    name = "coolapk_phone"
    allowed_domains = ["m.coolapk.com", "www.coolapk.com"]
    custom_settings = {
        "ROBOTSTXT_OBEY": False,
        "CONCURRENT_REQUESTS": 4,
        # A stalled version endpoint must not hold the whole sync until the
        # backend's 180-second subprocess timeout.
        "DOWNLOAD_TIMEOUT": 15,
        "RETRY_TIMES": 0,
        "LOG_LEVEL": "INFO",
    }
    start_urls = [
        "https://m.coolapk.com/mp/productSelector/configSearch?&callFunction=indexSearch"
    ]

    ajax_headers = {
        "x-requested-with": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json, text/javascript, */*; q=0.01",
    }

    known_brands = [
        "REDMI",
        "红米",
        "iPhone",
        "华为",
        "小米",
        "荣耀",
        "OPPO",
        "vivo",
        "一加",
        "三星",
        "realme",
        "真我",
        "魅族",
        "努比亚",
        "联想",
        "moto",
        "索尼",
        "ROG",
        "Nothing",
        "谷歌",
        "中兴",
    ]

    brand_aliases = [
        ("REDMI", [r"^redmi", r"^红米"]),
        ("Apple", [r"^iphone", r"^apple"]),
        ("华为", [r"^huawei", r"^华为", r"^mate\b", r"^pura\b", r"^nova\b", r"^畅享", r"^麦芒"]),
        ("荣耀", [r"^honor", r"^荣耀"]),
        ("OPPO", [r"^oppo", r"^find\b", r"^reno\b"]),
        ("vivo", [r"^vivo"]),
        ("iQOO", [r"^iqoo"]),
        ("小米", [r"^xiaomi", r"^小米", r"^mi\b", r"^mix\b", r"^civi\b"]),
        ("一加", [r"^oneplus", r"^一加"]),
        ("三星", [r"^samsung", r"^三星", r"^galaxy\b"]),
        ("realme", [r"^realme", r"^真我"]),
        ("魅族", [r"^meizu", r"^魅族", r"^魅蓝"]),
        ("努比亚", [r"^nubia", r"^努比亚", r"^红魔", r"^腾讯红魔"]),
        ("联想", [r"^lenovo", r"^联想", r"^拯救者", r"^zuk"]),
        ("moto", [r"^moto", r"^motorola", r"^摩托罗拉"]),
        ("索尼", [r"^sony", r"^索尼", r"^xperia"]),
        ("Google", [r"^google", r"^谷歌", r"^pixel", r"^nexus"]),
        ("中兴", [r"^zte", r"^中兴"]),
        ("ROG", [r"^rog"]),
        ("Nothing", [r"^nothing"]),
        ("LG", [r"^lg"]),
        ("360", [r"^360"]),
        ("黑鲨", [r"^black\s*shark", r"^黑鲨"]),
        ("多亲", [r"^duoqin", r"^qin", r"^多亲"]),
        ("酷派", [r"^coolpad", r"^酷派"]),
        ("Nokia", [r"^nokia", r"^诺基亚"]),
        ("美图", [r"^meitu", r"^美图"]),
        ("BlackBerry", [r"^blackberry", r"^黑莓"]),
        ("雷鸟", [r"^雷鸟"]),
        ("天翼", [r"^天翼"]),
        ("坚果", [r"^smartisan", r"^坚果"]),
        ("POCO", [r"^poco"]),
        ("蔚来", [r"^nio", r"^蔚来"]),
        ("Unihertz", [r"^unihertz"]),
        ("AGM", [r"^agm"]),
        ("CMF", [r"^cmf"]),
        ("TCL", [r"^tcl"]),
        ("WIKO", [r"^wiko"]),
        ("Essential", [r"^essential"]),
        ("夏普", [r"^sharp", r"^夏普"]),
        ("华硕", [r"^asus", r"^华硕"]),
        ("柔宇", [r"^royole", r"^柔宇"]),
        ("水月雨", [r"^moondrop", r"^水月雨"]),
    ]

    def parse(self, response):
        # The landing page is the popularity ranking. Reuse its session, then
        # request the AJAX list ordered by when products were added to Coolapk.
        max_pages = self.settings.getint("COOLAPK_MAX_PAGES", 1)
        yield self.build_page_request(1, max_pages)

    def parse_ajax(self, response):
        payload = json.loads(response.text)
        html = (payload.get("data") or "").strip()
        if not html:
            return

        selector = scrapy.Selector(text=f"<div class='phone-list'>{html}</div>")
        yield from self.parse_phone_list(selector, base_url=response.url)

        current_page = response.meta["page"]
        max_pages = response.meta["max_pages"]
        next_page = current_page + 1
        if next_page <= max_pages:
            yield self.build_page_request(next_page, max_pages)

    def build_page_request(self, page: int, max_pages: int):
        return scrapy.FormRequest(
            url=(
                "https://m.coolapk.com/mp/productSelector/configSearch"
                f"?page={page}&keyWord=&sortValue=create_time"
            ),
            formdata={"selectedFilters": ""},
            headers=self.ajax_headers,
            callback=self.parse_ajax,
            meta={"page": page, "max_pages": max_pages},
        )

    def parse_phone_list(self, response_or_selector, base_url=None):
        for node in response_or_selector.css(".phone-item"):
            product_id = self.clean_text(node.attrib.get("data-product-id"))
            name = self.clean_text(node.css(".phone-name::text").get())
            if not name:
                name = self.clean_text(node.css(".phone-image img::attr(alt)").get())
            if not product_id or not name:
                continue

            price_text = self.clean_text("".join(node.css(".phone-price *::text, .phone-price::text").getall()))
            score_text = self.clean_text(" ".join(node.css(".phone-specs-tags .tag-item::text").getall()))
            specs = self.clean_text(" ".join(node.css(".phone-specs::text").getall()))
            image_url = node.css(".phone-image img::attr(src)").get()
            source_url = f"https://www.coolapk.com/product/{product_id}"

            phone_id = f"coolapk-{product_id}"
            yield PhoneItem(
                id=phone_id,
                source="coolapk",
                source_product_id=product_id,
                name=name,
                brand=self.infer_brand(name),
                series=self.infer_series(name),
                score=self.parse_score(score_text),
                price=self.parse_price(price_text),
                specs=specs,
                image_url=self.normalize_image_url(image_url),
                source_url=source_url if base_url is None else source_url,
            )

            if self.settings.getbool("COOLAPK_FETCH_VERSIONS", False):
                yield scrapy.FormRequest(
                    url="https://m.coolapk.com/mp/productSelector/getProductVersion",
                    formdata={"callFunction": "indexSearch", "productId": product_id},
                    headers=self.ajax_headers,
                    callback=self.parse_versions,
                    meta={"phone_id": phone_id, "product_id": product_id},
                    dont_filter=True,
                )

    def parse_versions(self, response):
        payload = json.loads(response.text)
        for version in payload.get("versionList") or []:
            config_id = str(version.get("id") or "")
            if not config_id:
                continue

            request = scrapy.Request(
                url=f"https://m.coolapk.com/mp/product/configInfo?id={config_id}&drawNav=1",
                callback=self.parse_config_info,
                meta={
                    "phone_id": response.meta["phone_id"],
                    "product_id": str(version.get("product_id") or response.meta["product_id"]),
                    "config_id": config_id,
                    "title": self.clean_text(str(version.get("title") or "")),
                    "price": version.get("price"),
                },
                dont_filter=True,
            )
            yield request

    def parse_config_info(self, response):
        yield PhoneVersionItem(
            config_id=response.meta["config_id"],
            phone_id=response.meta["phone_id"],
            source="coolapk",
            source_product_id=response.meta["product_id"],
            title=response.meta["title"],
            price=response.meta["price"],
            specs=self.extract_config_specs(response),
            source_url=response.url,
        )

    def extract_config_specs(self, response):
        specs = []
        for group_node in response.css(".config-group"):
            group_name = self.clean_text(group_node.xpath("./p[contains(@class, 'group-name')][1]/text()").get())
            sub_group_name = ""
            for child in group_node.xpath("./*"):
                class_name = child.attrib.get("class", "")
                if "sub-group-name" in class_name:
                    sub_group_name = self.clean_text(" ".join(child.xpath(".//text()").getall()))
                    continue
                if "config-item" not in class_name:
                    continue

                name = self.clean_text(" ".join(child.css(".config-item-name ::text, .config-item-name::text").getall()))
                value = self.clean_text(" ".join(child.css(".config-item-value ::text, .config-item-value::text").getall()))
                if name and value:
                    specs.append(
                        {
                            "group": group_name,
                            "subgroup": sub_group_name,
                            "name": name,
                            "value": value,
                        }
                    )
        return specs

    def infer_brand(self, name: str) -> str:
        normalized_name = self.clean_text(name)
        for canonical_brand, patterns in self.brand_aliases:
            if any(re.search(pattern, normalized_name, re.IGNORECASE) for pattern in patterns):
                return canonical_brand
        fallback = normalized_name.split()[0] if " " in normalized_name else ""
        return fallback or "未知"

    def infer_series(self, name: str) -> str:
        brand = self.infer_brand(name)
        text = self.clean_text(name)
        compact = re.sub(r"\s+", "", text)
        upper = text.upper()

        if brand == "小米":
            if re.search(r"MIX", text, re.I):
                return "MIX 系列"
            if re.search(r"CIVI", text, re.I):
                return "CIVI 系列"
            if re.search(r"CC", text, re.I):
                return "CC 系列"
            if re.search(r"NOTE", upper) or compact.startswith("小米Note"):
                return "Note 系列"
            if re.search(r"MAX", text, re.I):
                return "Max 系列"
            if re.search(r"PLAY", text, re.I):
                return "Play 系列"
            if re.search(r"^小米\d", compact) or re.search(r"^(MI|XIAOMI)\s*\d", upper):
                return "数字系列"
            return "其他系列"

        if brand == "REDMI":
            if re.search(r"NOTE", upper) or compact.startswith("红米Note"):
                return "Note 系列"
            if re.search(r"TURBO", upper):
                return "Turbo 系列"
            if re.search(r"\bK\d", upper) or re.search(r"红米K\d", compact):
                return "K 系列"
            if re.search(r"\bA\d", upper) or re.search(r"红米\d+A", compact):
                return "A 系列"
            if re.search(r"\bR\d", upper):
                return "R 系列"
            if re.search(r"^红米\d", compact) or re.search(r"^REDMI\s*\d", upper):
                return "数字系列"
            return "其他系列"

        if brand == "华为":
            if re.search(r"MATE", upper):
                return "Mate 系列"
            if re.search(r"PURA", upper):
                return "Pura 系列"
            if re.search(r"^华为P\d", compact) or re.search(r"^HUAWEI\s*P\d", upper):
                return "P 系列"
            if re.search(r"NOVA", upper):
                return "nova 系列"
            if "畅享" in text:
                return "畅享系列"
            if "麦芒" in text:
                return "麦芒系列"
            if re.search(r"POCKET", upper):
                return "Pocket 系列"
            if re.search(r"^华为G\d", compact):
                return "G 系列"
            return "其他系列"

        if brand == "荣耀":
            if re.search(r"MAGIC", upper):
                return "Magic 系列"
            if re.search(r"PLAY", upper):
                return "Play 系列"
            if "畅玩" in text:
                return "畅玩系列"
            if re.search(r"GT", upper):
                return "GT 系列"
            if re.search(r"WIN", upper):
                return "WIN 系列"
            if re.search(r"^荣耀V", compact) or re.search(r"^HONOR\s*V", upper):
                return "V 系列"
            if re.search(r"X\d", upper):
                return "X 系列"
            if re.search(r"NOTE", upper):
                return "Note 系列"
            if re.search(r"POWER", upper):
                return "Power 系列"
            if re.search(r"^荣耀\d", compact) or re.search(r"^HONOR\s*\d", upper):
                return "数字系列"
            return "其他系列"

        if brand == "OPPO":
            if re.search(r"FIND", upper):
                return "Find 系列"
            if re.search(r"RENO", upper):
                return "Reno 系列"
            if re.search(r"\bR\d", upper) or re.search(r"^OPPOR\d", compact, re.I):
                return "R 系列"
            if re.search(r"ACE", upper):
                return "Ace 系列"
            if re.search(r"K\d", upper):
                return "K 系列"
            if re.search(r"A\d", upper):
                return "A 系列"
            return "其他系列"

        if brand == "vivo":
            if re.search(r"X\s*FOLD", upper) or "XFold" in compact:
                return "X Fold 系列"
            if re.search(r"X\s*FLIP", upper) or "XFlip" in compact:
                return "X Flip 系列"
            if re.search(r"X\s*NOTE", upper) or "XNote" in compact:
                return "X Note 系列"
            if re.search(r"X\d", upper):
                return "X 系列"
            if re.search(r"S\d", upper):
                return "S 系列"
            if re.search(r"Y\d", upper):
                return "Y 系列"
            if re.search(r"Z\d", upper):
                return "Z 系列"
            if re.search(r"T\d", upper):
                return "T 系列"
            if re.search(r"V\d", upper):
                return "V 系列"
            if re.search(r"APEX", upper):
                return "APEX 系列"
            if re.search(r"NEX", upper):
                return "NEX 系列"
            return "其他系列"

        if brand == "iQOO":
            if re.search(r"NEO", upper):
                return "Neo 系列"
            if re.search(r"Z\d", upper):
                return "Z 系列"
            if re.search(r"U\d", upper):
                return "U 系列"
            if re.search(r"PRO", upper):
                return "Pro 系列"
            if re.search(r"^IQOO\s*\d", upper):
                return "数字系列"
            if upper == "IQOO":
                return "初代系列"
            return "其他系列"

        if brand == "一加":
            if re.search(r"ACE", upper):
                return "Ace 系列"
            if re.search(r"TURBO", upper):
                return "Turbo 系列"
            if re.search(r"NORD", upper):
                return "Nord 系列"
            if re.search(r"^一加\d", compact) or re.search(r"^ONEPLUS\s*\d", upper):
                return "数字系列"
            return "其他系列"

        if brand == "三星":
            if re.search(r"GALAXY\s*S", upper) or re.search(r"^三星S\d", compact):
                return "Galaxy S 系列"
            if re.search(r"GALAXY\s*Z", upper) or re.search(r"FOLD|FLIP", upper):
                return "Galaxy Z 系列"
            if re.search(r"GALAXY\s*A", upper) or re.search(r"^三星A\d", compact):
                return "Galaxy A 系列"
            if re.search(r"GALAXY\s*NOTE", upper) or "三星Note" in compact:
                return "Galaxy Note 系列"
            if re.search(r"^三星W\d", compact):
                return "W 系列"
            if re.search(r"GALAXY\s*C", upper) or "三星GalaxyC" in compact:
                return "Galaxy C 系列"
            return "其他系列"

        if brand == "realme":
            if re.search(r"GT", upper):
                return "GT 系列"
            if re.search(r"NEO", upper):
                return "Neo 系列"
            if re.search(r"Q\d", upper) or upper == "REALME Q":
                return "Q 系列"
            if re.search(r"V\d", upper):
                return "V 系列"
            if re.search(r"X\d", upper) or re.search(r"^REALME\s*X", upper) or compact.startswith("真我X"):
                return "X 系列"
            if re.search(r"^真我\d", compact) or re.search(r"^REALME\s*\d", upper):
                return "数字系列"
            return "其他系列"

        common_rules = [
            ("moto", [(r"RAZR", "razr 系列"), (r"EDGE", "edge 系列"), (r"\bG\d", "G 系列"), (r"\bX\d", "X 系列"), (r"\bZ\d?", "Z 系列"), (r"\bS\d", "S 系列"), (r"P\d", "P 系列"), (r"青柚", "青柚系列")]),
            ("中兴", [(r"AXON|天机", "Axon 系列"), (r"远航", "远航系列"), (r"BLADE", "Blade 系列"), (r"畅行", "畅行系列"), (r"^中兴S\d", "S 系列")]),
            ("索尼", [(r"XPERIA\s*1", "Xperia 1 系列"), (r"XPERIA\s*5", "Xperia 5 系列"), (r"XPERIA\s*10", "Xperia 10 系列"), (r"XPERIA\s*XZ", "Xperia XZ 系列"), (r"XPERIA\s*XA", "Xperia XA 系列"), (r"XPERIA\s*PRO", "Xperia Pro 系列"), (r"XPERIA\s*X", "Xperia X 系列")]),
            ("联想", [(r"拯救者", "拯救者系列"), (r"ZUK", "ZUK 系列"), (r"^联想Z\d", "Z 系列"), (r"^联想K\d", "K 系列"), (r"^联想S\d", "S 系列"), (r"VIBE", "VIBE 系列")]),
            ("魅族", [(r"魅蓝", "魅蓝系列"), (r"PRO", "PRO 系列"), (r"NOTE", "Note 系列"), (r"^魅族X", "X 系列"), (r"^魅族M", "M 系列"), (r"LUCKY", "Lucky 系列"), (r"ZERO", "zero 系列"), (r"^魅族\d", "数字系列")]),
            ("努比亚", [(r"红魔|REDMAGIC", "红魔系列"), (r"Z\d", "Z 系列"), (r"PLAY", "Play 系列"), (r"FLIP", "Flip 系列"), (r"V\d", "V 系列"), (r"^努比亚X", "X 系列"), (r"小牛", "小牛系列"), (r"M\d", "M 系列")]),
        ]
        for rule_brand, patterns in common_rules:
            if brand != rule_brand:
                continue
            for pattern, series in patterns:
                if re.search(pattern, upper if re.match(r"^[A-Z\\\b\s\d|]+$", pattern) else text, re.IGNORECASE):
                    return series

        if brand == "Google":
            if re.search(r"NEXUS", upper):
                return "Nexus 系列"
            if re.search(r"PRO", upper):
                return "Pixel Pro"
            if re.search(r"\bA\b", upper):
                return "Pixel A"
            if re.search(r"FOLD", upper):
                return "Pixel Fold"
            return "Pixel 标准系列"

        if brand == "黑鲨":
            if re.search(r"HELO", upper):
                return "Helo 系列"
            return "数字系列" if re.search(r"\d", text) else "初代系列"
        if brand == "ROG":
            return "游戏手机数字系列" if re.search(r"\d", text) else "游戏手机初代系列"
        if brand == "Nokia":
            if re.search(r"X\d", upper):
                return "X 系列"
            if re.search(r"PUREVIEW", upper):
                return "PureView 系列"
            if re.search(r"SIROCCO", upper):
                return "Sirocco 系列"
            return "数字系列" if re.search(r"\d", text) else "其他系列"
        if brand == "Nothing":
            return "Phone a 系列" if re.search(r"\(.*A.*\)|\bA\b", upper) else "Phone 系列"
        if brand == "LG":
            if re.search(r"\bV\d", upper):
                return "V 系列"
            if re.search(r"\bG\d", upper):
                return "G 系列"
            return "其他系列"
        if brand == "多亲":
            if re.search(r"QIN", upper):
                return "Qin 系列"
            if re.search(r"K\d", upper):
                return "K 系列"
            if re.search(r"F\d", upper):
                return "F 系列"
            return "其他系列"
        if brand == "360":
            return "N 系列" if re.search(r"\bN\d", upper) else "其他系列"
        if brand == "坚果":
            if re.search(r"PRO", upper):
                return "Pro 系列"
            if re.search(r"R\d", upper):
                return "R 系列"
            return "数字系列" if re.search(r"\d", text) else "其他系列"
        if brand == "酷派":
            if re.search(r"COOL", upper):
                return "COOL 系列"
            if "大观" in text:
                return "大观系列"
            return "其他系列"
        if brand == "HTC":
            return "U 系列" if re.search(r"\bU\d", upper) else "其他系列"
        if brand == "BlackBerry":
            return "KEY 系列" if re.search(r"KEY", upper) else "其他系列"
        if brand == "蔚来":
            return "NIO Phone 系列"
        if brand == "Unihertz":
            if re.search(r"JELLY", upper):
                return "Jelly 系列"
            if re.search(r"TITAN", upper):
                return "Titan 系列"
            return "其他系列"
        if brand == "AGM" and re.search(r"X\d", upper):
            return "X 系列"
        if brand == "美图" and re.search(r"T\d", upper):
            return "T 系列"
        if brand == "CMF":
            return "Phone 系列"
        if brand == "TCL" and re.search(r"P\d", upper):
            return "P 系列"
        if brand == "雷鸟" and re.search(r"FF", upper):
            return "FF 系列"
        if brand == "POCO":
            if re.search(r"X\d", upper):
                return "X 系列"
            if re.search(r"F\d", upper):
                return "F 系列"
            if re.search(r"M\d", upper):
                return "M 系列"
            return "其他系列"
        if brand == "柔宇" and re.search(r"FLEXPAI", upper):
            return "FlexPai 系列"
        if brand == "华硕" and re.search(r"ZENFONE", upper):
            return "Zenfone 系列"
        if brand == "WIKO" and re.search(r"X\d", upper):
            return "X 系列"
        if brand == "水月雨" and re.search(r"MIAD", upper):
            return "MIAD 系列"
        if brand == "夏普" and re.search(r"AQUOS", upper):
            return "AQUOS 系列"
        if brand == "Essential":
            return "Phone 系列"
        if brand == "天翼" and re.search(r"\d", text):
            return "数字系列"

        return "其他系列"

    def parse_score(self, text: str) -> int:
        match = re.search(r"评分\s*([0-9]+(?:\.[0-9]+)?)", text)
        if not match:
            return 0
        return round(float(match.group(1)) * 10)

    def parse_price(self, text: str) -> int | None:
        match = re.search(r"([0-9]+)", text.replace(",", ""))
        return int(match.group(1)) if match else None

    def normalize_image_url(self, image_url: str | None) -> str | None:
        if not image_url:
            return None
        if image_url.startswith("//"):
            return f"https:{image_url}"
        return image_url.replace("http://", "https://", 1)

    def clean_text(self, value: str | None) -> str:
        return re.sub(r"\s+", " ", value or "").strip()
