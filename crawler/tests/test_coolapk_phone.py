import json
import unittest
from urllib.parse import parse_qs, urlparse

from scrapy.crawler import Crawler
from scrapy.http import HtmlResponse, TextResponse
from scrapy.settings import Settings

from fkphone_crawler.items import PhoneItem
from fkphone_crawler.spiders.coolapk_phone import CoolapkPhoneSpider


class CoolapkPhoneSpiderTest(unittest.TestCase):
    def make_spider(self, **settings):
        crawler = Crawler(CoolapkPhoneSpider, Settings(settings))
        return CoolapkPhoneSpider.from_crawler(crawler)

    def test_initial_page_uses_newest_sort(self):
        spider = self.make_spider(COOLAPK_MAX_PAGES=3)
        response = HtmlResponse(
            url=spider.start_urls[0],
            body=b'<div class="phone-item" data-product-id="old"></div>',
            encoding="utf-8",
        )

        requests = list(spider.parse(response))

        self.assertEqual(len(requests), 1)
        request = requests[0]
        query = parse_qs(urlparse(request.url).query)
        self.assertEqual(query["page"], ["1"])
        self.assertEqual(query["sortValue"], ["create_time"])
        self.assertEqual(request.meta["max_pages"], 3)
        self.assertEqual(request.callback, spider.parse_ajax)

    def test_ajax_pagination_keeps_newest_sort(self):
        spider = self.make_spider(COOLAPK_FETCH_VERSIONS=False)
        request = spider.build_page_request(1, 2)
        payload = {
            "data": """
                <div class="phone-item" data-product-id="9001">
                    <div class="phone-image"><img src="//image.coolapk.com/new.png" alt="vivo X300E"></div>
                    <div class="phone-info">
                        <dev class="phone-name">vivo X300E</dev>
                        <div class="phone-specs-tags"><div class="tag-item">评分9.1</div></div>
                        <div class="phone-specs">天玑9500 | 7000mAh | 2026年7月</div>
                        <div class="phone-price"><span>¥</span>3999</div>
                    </div>
                </div>
            """
        }
        response = TextResponse(
            url=request.url,
            request=request,
            body=json.dumps(payload).encode(),
            encoding="utf-8",
        )

        results = list(spider.parse_ajax(response))

        self.assertEqual(len(results), 2)
        self.assertIsInstance(results[0], PhoneItem)
        self.assertEqual(results[0]["id"], "coolapk-9001")
        next_query = parse_qs(urlparse(results[1].url).query)
        self.assertEqual(next_query["page"], ["2"])
        self.assertEqual(next_query["sortValue"], ["create_time"])


if __name__ == "__main__":
    unittest.main()
