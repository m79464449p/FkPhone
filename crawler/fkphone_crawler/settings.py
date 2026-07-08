BOT_NAME = "fkphone_crawler"

SPIDER_MODULES = ["fkphone_crawler.spiders"]
NEWSPIDER_MODULE = "fkphone_crawler.spiders"

ROBOTSTXT_OBEY = True
REQUEST_FINGERPRINTER_IMPLEMENTATION = "2.7"
TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"
FEED_EXPORT_ENCODING = "utf-8"

ITEM_PIPELINES = {
    "fkphone_crawler.pipelines.PostgresPhonePipeline": 300,
}

COOLAPK_MAX_PAGES = 3
DOWNLOAD_DELAY = 1
DEFAULT_REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}
