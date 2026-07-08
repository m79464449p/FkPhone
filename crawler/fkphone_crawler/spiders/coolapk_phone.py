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

    def parse(self, response):
        yield from self.parse_phone_list(response)

        max_pages = self.settings.getint("COOLAPK_MAX_PAGES", 1)
        if max_pages >= 2:
            yield self.build_page_request(2, max_pages)

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
                f"?page={page}&keyWord=&sortValue=default"
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
        for brand in self.known_brands:
            if name.lower().startswith(brand.lower()):
                return "Apple" if brand == "iPhone" else brand
        return name.split()[0] if " " in name else "未知"

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
