import unittest

from app.services.goofish_browser_search import extract_mtop_image_url, extract_mtop_image_urls, normalize_image_url


class GoofishImageExtractionTest(unittest.TestCase):
    def test_extract_mtop_image_url_prefers_product_pic_over_tag_assets(self):
        row = {
            "data": {
                "item": {
                    "main": {
                        "exContent": {
                            "fishTags": {
                                "r1": {
                                    "tagList": [
                                        {
                                            "data": {
                                                "url": "https://gw.alicdn.com/imgextra/i1/O1CN-tag_!!6000000003181-2-tps-228-42.png"
                                            }
                                        }
                                    ]
                                }
                            },
                            "picUrl": "http://img.alicdn.com/bao/uploaded/i2/730168246/O1CN-product_!!4611686018427386806-0-xy_item.jpg",
                            "userAvatarUrl": "http://img.alicdn.com/bao/uploaded/i1/O1CN-avatar_!!0-mtopupload.jpg",
                        }
                    }
                }
            }
        }

        self.assertEqual(
            extract_mtop_image_url(row),
            "https://img.alicdn.com/bao/uploaded/i2/730168246/O1CN-product_!!4611686018427386806-0-xy_item.jpg",
        )
        self.assertEqual(
            extract_mtop_image_urls(row),
            ["https://img.alicdn.com/bao/uploaded/i2/730168246/O1CN-product_!!4611686018427386806-0-xy_item.jpg"],
        )

    def test_normalize_image_url_unwraps_goofish_photo_search_urls(self):
        wrapped = (
            "https://h5.m.goofish.com/wow/moyu/moyu-project/idle-photo-search/pages/home"
            "?extra=%7B%22imageInfo%22%3A%7B%22url%22%3A%22http%3A%2F%2Fimg.alicdn.com%2Fbao%2Fuploaded%2Fi4%2F1%2FO1CN-demo_%21%21x-53-xy_item.heic_640x640q90.jpg%22%7D%7D"
        )

        self.assertEqual(
            normalize_image_url(wrapped),
            "https://img.alicdn.com/bao/uploaded/i4/1/O1CN-demo_!!x-53-xy_item.heic_640x640q90.jpg",
        )


if __name__ == "__main__":
    unittest.main()
