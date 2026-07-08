import scrapy

from fkphone_crawler.items import PhoneItem


class DemoPhoneSpider(scrapy.Spider):
    name = "demo_phone"
    allowed_domains = ["example.com"]
    start_urls = ["https://example.com"]

    def parse(self, response):
        yield PhoneItem(
            name="Demo Phone",
            brand="Demo",
            price="0",
            source_url=response.url,
        )
