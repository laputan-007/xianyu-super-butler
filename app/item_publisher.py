"""闲鱼商品发布客户端：mtop 接口直连。

协议于 2026-10-14 从 goofish.com/publish 网页版实测抓取：
- 图片上传：POST https://stream-upload.goofish.com/api/upload.api（multipart，字段名 file）
- 类目/成色推荐：mtop.taobao.idle.kgraph.property.recommend/2.0
- 默认发货地址：mtop.taobao.idle.local.poi.get/1.0（commonAddresses[0]）
- 违禁词预检：mtop.taobao.idleitem.badwords.prepubcheck/2.0
- 发布：mtop.idle.pc.idleitem.publish/1.0

签名机制与 XianyuAutoAsync 的现有 mtop 调用一致（token 取 _m_h5_tk 首段，
token 过期时合并响应 Set-Cookie 重试一次）。
"""

import asyncio
import json
import random
import time
from typing import Any, Dict, List, Optional, Tuple

import aiohttp
from loguru import logger
from utils.user_agents import CHROME_UA
from utils.xianyu_utils import generate_sign, trans_cookies

H5_API_BASE = 'https://h5api.m.goofish.com/h5'
STREAM_UPLOAD_URL = 'https://stream-upload.goofish.com/api/upload.api'


class ItemPublishError(Exception):
    """发布流程中的业务性失败（带面向用户的中文原因）。"""


def _unique_code() -> str:
    """发布/推荐接口要求的 uniqueCode：13 位毫秒时间戳 + 3 位随机数。"""
    return f"{int(time.time() * 1000)}{random.randint(100, 999)}"


async def _mtop_request(
    session: aiohttp.ClientSession,
    cookies_str: str,
    api: str,
    version: str,
    data: Dict[str, Any],
    timeout_seconds: float = 25.0,
    retry_on_token: bool = True,
) -> Dict[str, Any]:
    """发起一次签名的 mtop 调用并返回 data 字段；非 SUCCESS 时抛 ItemPublishError。

    token 过期（FAIL_SYS_TOKEN_*）时合并响应 Set-Cookie 后重试一次。
    """
    data_val = json.dumps(data, separators=(',', ':'), ensure_ascii=False)
    cookies = trans_cookies(cookies_str)
    token = cookies.get('_m_h5_tk', '').split('_')[0]
    timestamp = str(int(time.time() * 1000))
    params = {
        'jsv': '2.7.2',
        'appKey': '34839810',
        't': timestamp,
        'sign': generate_sign(timestamp, token, data_val),
        'v': version,
        'type': 'originaljson',
        'accountSite': 'xianyu',
        'dataType': 'json',
        'timeout': '20000',
        'api': api,
        'sessionOption': 'AutoLoginOnly',
        'spm_cnt': 'a21ybx.publish.0.0',
    }
    headers = {
        'accept': 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
        'origin': 'https://www.goofish.com',
        'referer': 'https://www.goofish.com/publish',
        'user-agent': CHROME_UA,
        'cookie': cookies_str.replace('\n', '').replace('\r', ''),
    }
    url = f'{H5_API_BASE}/{api}/{version}/'
    try:
        async with session.post(url, params=params, data={'data': data_val}, headers=headers,
                                timeout=aiohttp.ClientTimeout(total=timeout_seconds)) as response:
            result = await response.json(content_type=None)
            set_cookies = response.headers.getall('set-cookie', []) if 'set-cookie' in response.headers else []
    except Exception as exc:
        raise ItemPublishError(f'网络请求失败：{exc}') from exc

    ret = result.get('ret', []) if isinstance(result, dict) else []
    ret_text = ';'.join(str(item) for item in ret)

    # token 失效：合并新 token 重试一次
    if retry_on_token and any(flag in ret_text for flag in ('FAIL_SYS_TOKEN_EXOIRED', 'FAIL_SYS_TOKEN_EMPTY', 'TOKEN_EMPTY')):
        merged = dict(cookies)
        for cookie in set_cookies:
            if '=' in cookie:
                name, value = cookie.split(';', 1)[0].split('=', 1)
                merged[name.strip()] = value.strip()
        new_cookies_str = '; '.join(f"{key}={value}" for key, value in merged.items())
        logger.info(f"mtop {api} token 失效，携带新 token 重试")
        return await _mtop_request(session, new_cookies_str, api, version, data,
                                   timeout_seconds, retry_on_token=False)

    if not any('SUCCESS' in str(item) for item in ret):
        # 风控/参数等业务错误码集中在 ret 里，透传给前端
        raise ItemPublishError(f'闲鱼接口返回失败：{ret_text[:300] or "未知错误"}')
    return result.get('data') or {}


async def upload_publish_image(
    session: aiohttp.ClientSession,
    cookies_str: str,
    file_bytes: bytes,
    filename: str,
    mime: str = 'image/jpeg',
) -> Dict[str, Any]:
    """把本地图片上传到闲鱼图片空间，返回 {url, widthSize, heightSize}。

    网页版发布页的 rc-upload 组件默认字段名是 file，实测同款。
    """
    headers = {
        'accept': '*/*',
        'origin': 'https://www.goofish.com',
        'referer': 'https://www.goofish.com/publish',
        'user-agent': CHROME_UA,
        'cookie': cookies_str.replace('\n', '').replace('\r', ''),
    }

    async def _do_upload() -> Optional[Dict[str, Any]]:
        """一次上传尝试；FormData 是一次性对象，每次都要新建。"""
        form = aiohttp.FormData()
        form.add_field('file', file_bytes, filename=filename, content_type=mime)
        async with session.post(
            STREAM_UPLOAD_URL,
            params={'floderId': '0', 'appkey': 'fleamarket', '_input_charset': 'utf-8'},
            data=form,
            headers=headers,
            timeout=aiohttp.ClientTimeout(total=30),
        ) as response:
            raw = await response.read()
        if not raw:
            return None
        try:
            return json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            return None

    try:
        # 服务端偶发返回空 body（状态 200），重试两次通常即可
        result = None
        for attempt in range(3):
            result = await _do_upload()
            if result is not None:
                break
            await asyncio.sleep(0.5)
            logger.info(f"图片上传返回空响应，第 {attempt + 1} 次重试")
    except Exception as exc:
        raise ItemPublishError(f'图片上传失败：{exc}') from exc
    if result is None:
        raise ItemPublishError('图片上传失败：闲鱼图片空间连续返回空响应，请稍后重试')

    obj = (result or {}).get('object') or {}
    url = obj.get('url')
    if not result.get('success') or not url:
        raise ItemPublishError(f'图片上传失败：{str(result)[:200]}')
    pix = (obj.get('pix') or '0x0').split('x')
    try:
        width, height = int(pix[0]), int(pix[1])
    except (ValueError, IndexError):
        width = height = 0
    return {'url': url, 'widthSize': width, 'heightSize': height}


def _safe_upload_filename(raw: str) -> str:
    """图片空间对文件名长度有限制（实测长 alicdn 名会报 FILE_NAME_LENGTH_IS_OVER_RANGE）。"""
    base = (raw.split('/')[-1].split('?')[0] or 'item').strip() or 'item'
    stem, dot, ext = base.partition('.')
    ext = f'.{ext}'[:10] if dot else ''
    return f"{stem[:32]}{ext}"


async def prepare_publish_image(
    session: aiohttp.ClientSession,
    cookies_str: str,
    image_url: str,
) -> Dict[str, Any]:
    """把任意来源的图片（本地 /static 路径或外链）转存到闲鱼图片空间。

    统一转存（即使是 alicdn 地址）：既保证图片在当前账号的图片空间里，
    也能拿到发布 payload 需要的宽高信息。
    返回 {url, widthSize, heightSize}。
    """
    url = (image_url or '').strip()
    if not url:
        raise ItemPublishError('商品缺少图片，请先在编辑商品里上传图片')

    file_bytes: Optional[bytes] = None
    filename = 'item.jpg'
    if url.startswith('/'):
        # 本地上传的静态资源路径
        import os
        local_path = os.path.abspath(url.lstrip('/').replace('/', os.sep))
        if not os.path.exists(local_path):
            raise ItemPublishError(f'本地图片文件不存在：{url}')
        with open(local_path, 'rb') as f:
            file_bytes = f.read()
        filename = _safe_upload_filename(os.path.basename(local_path))
    elif url.startswith('http'):
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=30),
                                   headers={'user-agent': CHROME_UA}) as resp:
                if resp.status != 200:
                    raise ItemPublishError(f'下载商品图片失败（HTTP {resp.status}）')
                file_bytes = await resp.read()
        except ItemPublishError:
            raise
        except Exception as exc:
            raise ItemPublishError(f'下载商品图片失败：{exc}') from exc
        filename = _safe_upload_filename(url)
    else:
        raise ItemPublishError(f'无法识别的图片地址：{url[:80]}')

    if not file_bytes:
        raise ItemPublishError('商品图片内容为空')
    mime = 'image/png' if filename.lower().endswith('.png') else 'image/jpeg'
    return await upload_publish_image(session, cookies_str, file_bytes, filename, mime)


async def fetch_addresses(
    session: aiohttp.ClientSession,
    cookies_str: str,
) -> Dict[str, Any]:
    """取账号的发货地址信息（selectedPoi 默认地址 + commonAddresses 常用地址）。"""
    data = await _mtop_request(session, cookies_str, 'mtop.taobao.idle.local.poi.get', '1.0',
                               {'longitude': 116.403324, 'latitude': 39.919353})
    return data


async def fetch_default_address(
    session: aiohttp.ClientSession,
    cookies_str: str,
) -> Dict[str, Any]:
    """取账号保存的默认发货地址（selectedPoi，兼容 commonAddresses[0]）。"""
    data = await fetch_addresses(session, cookies_str)
    address = data.get('selectedPoi') or (data.get('commonAddresses') or [None])[0]
    if not address:
        raise ItemPublishError('未找到账号的默认发货地址，请先在闲鱼 APP 设置宝贝所在地')
    return address


async def downshelf_item(
    session: aiohttp.ClientSession,
    cookies_str: str,
    item_id: str,
) -> None:
    """把商品从闲鱼下架（保留本地记录，状态标为已下架）。"""
    data = await _mtop_request(session, cookies_str, 'mtop.taobao.idle.item.downshelf', '2.0',
                               {'itemId': str(item_id)})
    if data is not None and data.get('success') is False:
        raise ItemPublishError('闲鱼返回下架失败')


async def delete_platform_item(
    session: aiohttp.ClientSession,
    cookies_str: str,
    item_id: str,
) -> None:
    """从闲鱼平台彻底删除商品。"""
    await _mtop_request(session, cookies_str, 'com.taobao.idle.item.delete', '1.1',
                        {'itemId': str(item_id)})


async def check_badwords(
    session: aiohttp.ClientSession,
    cookies_str: str,
    title: str,
    cookie_id: str,
) -> None:
    """违禁词预检：命中时闲鱼会拒绝发布，提前给出明确原因。"""
    data = await _mtop_request(session, cookies_str, 'mtop.taobao.idleitem.badwords.prepubcheck', '2.0', {
        'title': title,
        'scene': 'pcPublish',
        'sessionId': f'{int(time.time() * 1000)}{cookie_id}',
    })
    if data.get('forbidPublish') or data.get('result'):
        raise ItemPublishError('描述命中闲鱼违禁词，请修改后再发布')


async def recommend_category(
    session: aiohttp.ClientSession,
    cookies_str: str,
    title: str,
    description: str,
    image_infos: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """根据描述与首图推荐类目，返回首选候选（发布时使用）。"""
    data = await _mtop_request(session, cookies_str, 'mtop.taobao.idle.kgraph.property.recommend', '2.0', {
        'title': title,
        'lockCpv': False,
        'multiSKU': False,
        'publishScene': 'mainPublish',
        'scene': 'newPublishChoice',
        'description': description,
        'imageInfos': image_infos,
        'uniqueCode': _unique_code(),
    })
    card_list = data.get('cardList') or []
    category_card = next((card for card in card_list
                          if (card.get('cardData') or {}).get('propertyName') == '分类'), None)
    if not category_card:
        raise ItemPublishError('闲鱼未能识别商品分类，请把描述写得更具体一些')
    candidates = (category_card.get('cardData') or {}).get('valuesList') or []
    if not candidates:
        raise ItemPublishError('闲鱼未能识别商品分类，请把描述写得更具体一些')

    # 成色卡片可选：取「几乎全新」等候选，让发布数据更完整
    condition_card = next((card for card in card_list
                           if (card.get('cardData') or {}).get('propertyName') == '成色'), None)
    condition = None
    if condition_card:
        condition_candidates = (condition_card.get('cardData') or {}).get('valuesList') or []
        if condition_candidates:
            condition = condition_candidates[0]

    return {'category': candidates[0], 'condition': condition, 'candidates': candidates[:5]}


def _build_image_entry(image: Dict[str, Any], major: bool) -> Dict[str, Any]:
    return {
        'extraInfo': {'isH': 'false', 'isT': 'false', 'raw': 'false'},
        'isQrCode': False,
        'url': image['url'],
        'heightSize': image.get('heightSize') or 0,
        'widthSize': image.get('widthSize') or 0,
        'major': major,
        'type': 0,
        'status': 'done',
    }


# 发货方式到 itemPostFeeDTO 的映射（与官方发布页选项一一对应，实测抓包校准）
SHIPPING_MODES = {
    # 包邮
    'free': {'canFreeShipping': True, 'supportFreight': True, 'onlyTakeSelf': False},
    # 按距离计费
    'freight': {'canFreeShipping': False, 'supportFreight': True, 'onlyTakeSelf': False, 'templateId': '-100'},
    # 无需邮寄（仅自提）
    'self': {'canFreeShipping': False, 'supportFreight': False, 'onlyTakeSelf': True},
}


async def publish_item(
    session: aiohttp.ClientSession,
    cookies_str: str,
    cookie_id: str,
    *,
    title: str,
    description: str,
    price: float,
    images: List[Dict[str, Any]],
    category: Dict[str, Any],
    condition: Optional[Dict[str, Any]],
    address: Dict[str, Any],
    quantity: int = 1,
    original_price: Optional[float] = None,
    shipping_mode: str = 'free',
) -> Dict[str, Any]:
    """发布商品到闲鱼，成功时返回 {itemId}。

    payload 结构与网页版发布实测报文一致（来源 pcMainPublish）。
    original_price 为可选原价（划线价）；shipping_mode 见 SHIPPING_MODES。
    """
    cat = category
    label_list: List[Dict[str, Any]] = [{
        'channelCateName': cat.get('channelCateName'),
        'valueId': None,
        'channelCateId': cat.get('channelCatId'),
        'valueName': None,
        'tbCatId': cat.get('tbCatId'),
        'subPropertyId': None,
        'labelType': 'common',
        'subValueId': None,
        'labelId': None,
        'propertyName': '分类',
        'isUserClick': '0',
        'isUserCancel': None,
        'from': 'newPublishChoice',
        'propertyId': '-10000',
        'labelFrom': 'newPublish',
        'text': cat.get('catName'),
        'properties': f"-10000##分类:{cat.get('channelCatId')}##{cat.get('catName')}",
    }]
    if condition:
        label_list.append({
            'channelCateName': None,
            'valueId': condition.get('valueId'),
            'channelCateId': cat.get('channelCatId'),
            'valueName': condition.get('valueName'),
            'tbCatId': cat.get('tbCatId'),
            'subPropertyId': None,
            'labelType': 'common',
            'subValueId': None,
            'labelId': None,
            'propertyName': '成色',
            'isUserClick': '0',
            'isUserCancel': None,
            'from': 'newPublishChoice',
            'propertyId': condition.get('propertyId') or '20879',
            'labelFrom': 'newPublish',
            'AUTO_SELECT_BY_SPU_OR_BRAND': '1',
            'text': condition.get('valueName'),
            'properties': f"{condition.get('propertyId') or '20879'}##成色:{condition.get('valueId')}##{condition.get('valueName')}",
        })

    price_in_cent = str(int(round(price * 100)))
    item_price: Dict[str, Any] = {'priceInCent': price_in_cent}
    if original_price is not None and original_price > 0:
        item_price['origPriceInCent'] = str(int(round(original_price * 100)))
    post_fee = dict(SHIPPING_MODES.get(shipping_mode, SHIPPING_MODES['free']))
    payload = {
        'freebies': False,
        'itemTypeStr': 'b',
        'quantity': str(max(1, quantity)),
        'simpleItem': 'true',
        'imageInfoDOList': [
            _build_image_entry(image, index == 0)
            for index, image in enumerate(images[:9])
        ],
        'itemTextDTO': {
            'desc': description,
            'title': title,
            'titleDescSeparate': False,
        },
        'itemLabelExtList': label_list,
        'itemPriceDTO': item_price,
        'userRightsProtocols': [],
        'itemPostFeeDTO': post_fee,
        'itemAddrDTO': {
            'area': address.get('area'),
            'city': address.get('city'),
            'divisionId': address.get('divisionId'),
            'gps': f"{address.get('latitude')},{address.get('longitude')}",
            'poiId': address.get('poiId'),
            'poiName': address.get('poi') or address.get('aoi'),
            'prov': address.get('prov'),
        },
        'defaultPrice': False,
        'itemCatDTO': {
            'catId': cat.get('catId'),
            'catName': cat.get('catName'),
            'channelCatId': cat.get('channelCatId'),
            'leafId': cat.get('leafId'),
            'tbCatId': cat.get('tbCatId'),
        },
        'uniqueCode': _unique_code(),
        'sourceId': 'pcMainPublish',
        'bizcode': 'pcMainPublish',
        'publishScene': 'pcMainPublish',
    }

    data = await _mtop_request(session, cookies_str, 'mtop.idle.pc.idleitem.publish', '1.0', payload)

    item_id = None
    for key in ('itemId', 'itemID', 'id'):
        value = data.get(key)
        if value:
            item_id = str(value)
            break
    if not item_id:
        item_dto = data.get('itemDO') or data.get('itemDTO') or {}
        item_id = str(item_dto.get('itemId') or '') or None
    if not item_id:
        # 发布成功但响应里找不到 itemId（页面是拿它跳转的，正常都会带）
        raise ItemPublishError(f'发布已提交，但响应中未找到商品 ID：{str(data)[:200]}')
    return {'itemId': item_id}


async def run_publish(
    cookies_str: str,
    cookie_id: str,
    *,
    title: str,
    description: str,
    price: float,
    images: List[Dict[str, Any]],
    quantity: int = 1,
    original_price: Optional[float] = None,
    shipping_mode: str = 'free',
    address: Optional[Dict[str, Any]] = None,
    category: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """发布全流程入口：违禁词 → 类目推荐 → 发布。images 为已上传的图片列表。

    address 不传时使用账号默认发货地址。
    category 可传推荐接口返回的候选分类对象（用户手动选择时），不传取首选。
    """
    async with aiohttp.ClientSession() as session:
        await check_badwords(session, cookies_str, title, cookie_id)
        recommend = await recommend_category(
            session, cookies_str, title, description,
            [_build_image_entry(image, index == 0) for index, image in enumerate(images[:9])],
        )
        if address is None:
            address = await fetch_default_address(session, cookies_str)
        chosen_category = category if category and category.get('catId') else recommend['category']
        result = await publish_item(
            session, cookies_str, cookie_id,
            title=title, description=description, price=price, images=images,
            category=chosen_category, condition=recommend['condition'],
            address=address, quantity=quantity,
            original_price=original_price, shipping_mode=shipping_mode,
        )
        result['category'] = chosen_category.get('catName')
        return result


async def run_recommend(
    cookies_str: str,
    cookie_id: str,
    *,
    title: str,
    description: str,
    images: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """仅做类目推荐（供前端在确认弹窗展示分类候选供用户选择）。"""
    async with aiohttp.ClientSession() as session:
        recommend = await recommend_category(
            session, cookies_str, title, description,
            [_build_image_entry(image, index == 0) for index, image in enumerate(images[:9])],
        )
        return {
            'category': recommend['category'],
            'candidates': recommend['candidates'],
        }
