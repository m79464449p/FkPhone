import scrapy


class PhoneItem(scrapy.Item):
    id = scrapy.Field()
    source = scrapy.Field()
    source_product_id = scrapy.Field()
    name = scrapy.Field()
    brand = scrapy.Field()
    series = scrapy.Field()
    score = scrapy.Field()
    price = scrapy.Field()
    specs = scrapy.Field()
    image_url = scrapy.Field()
    source_url = scrapy.Field()


class PhoneVersionItem(scrapy.Item):
    config_id = scrapy.Field()
    phone_id = scrapy.Field()
    source = scrapy.Field()
    source_product_id = scrapy.Field()
    title = scrapy.Field()
    price = scrapy.Field()
    specs = scrapy.Field()
    source_url = scrapy.Field()
