"""
订单获取优化模块
合并订单状态查询和订单详情获取，减少浏览器启动次数
"""
import asyncio
import time
import json
import re
from typing import Dict, Any, Optional, List
from playwright.async_api import Browser, BrowserContext, Page
from loguru import logger
from collections import defaultdict

from utils.browser_pool import get_browser_pool


class OrderFetcherOptimized:
    """
    优化的订单获取器

    特性:
    - 一次浏览器访问同时获取订单状态和订单详情
    - 使用浏览器池复用实例
    - 同时监听API响应和解析DOM
    """

    # 类级别的锁字典，为每个order_id维护一个锁
    _order_locks = defaultdict(lambda: asyncio.Lock())

    def __init__(self, cookie_id: str, cookie_string: str, use_pool: bool = True):
        """
        初始化订单获取器

        Args:
            cookie_id: Cookie ID
            cookie_string: Cookie字符串
            use_pool: 是否使用浏览器池（默认True）
        """
        self.cookie_id = cookie_id
        self.cookie_string = cookie_string
        self.use_pool = use_pool
        self.api_responses = []

        # 浏览器实例
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None

    async def fetch_order_complete(
        self,
        order_id: str,
        timeout: int = 30,
        headless: bool = True
    ) -> Optional[Dict[str, Any]]:
        """
        获取完整的订单信息（优化版：一次浏览器访问）

        在一次浏览器访问中同时：
        1. 拦截API获取订单状态、买家ID、商品ID
        2. 解析DOM获取收货人信息、金额、规格

        Args:
            order_id: 订单ID
            timeout: 超时时间（秒）
            headless: 是否无头模式

        Returns:
            完整的订单信息字典，失败返回None
        """
        # 获取该订单ID的锁
        order_lock = self._order_locks[order_id]

        async with order_lock:
            logger.info(f"🔒 获取订单 {order_id} 的锁，开始处理...")
            print(f"🔍 开始获取订单完整信息: {order_id}")

            try:
                # 首先查询数据库中是否已存在该订单
                from db_manager import db_manager
                existing_order = db_manager.get_order_by_id(order_id)

                if existing_order:
                    # 检查金额字段是否有效
                    amount = existing_order.get('amount', '')
                    amount_valid = False

                    if amount:
                        amount_clean = str(amount).replace('¥', '').replace('￥', '').replace('$', '').strip()
                        try:
                            amount_value = float(amount_clean)
                            amount_valid = amount_value > 0
                        except (ValueError, TypeError):
                            amount_valid = False

                    # 检查收货人信息是否完整
                    receiver_name = existing_order.get('receiver_name', '')
                    receiver_phone = existing_order.get('receiver_phone', '')
                    receiver_address = existing_order.get('receiver_address', '')
                    receiver_info_complete = (
                        receiver_name and receiver_name != 'unknown' and
                        receiver_phone and receiver_phone != 'unknown' and
                        receiver_address and receiver_address != 'unknown'
                    )

                    # 只有金额有效且收货人信息完整时才使用缓存
                    if amount_valid and receiver_info_complete:
                        logger.info(f"📋 订单 {order_id} 已存在于数据库中且数据完整，直接返回缓存数据")
                        print(f"✅ 订单 {order_id} 使用缓存数据")

                        result = {
                            'order_id': existing_order['order_id'],
                            'url': f"https://www.goofish.com/order-detail?orderId={order_id}&role=seller",
                            'title': f"订单详情 - {order_id}",
                            'order_status': existing_order.get('order_status', 'unknown'),
                            'status_text': existing_order.get('status_text', ''),
                            'item_title': existing_order.get('item_title', ''),
                            'spec_name': existing_order.get('spec_name', ''),
                            'spec_value': existing_order.get('spec_value', ''),
                            'quantity': existing_order.get('quantity', ''),
                            'amount': existing_order.get('amount', ''),
                            'order_time': existing_order.get('created_at', ''),
                            'receiver_name': receiver_name,
                            'receiver_phone': receiver_phone,
                            'receiver_address': receiver_address,
                            'receiver_city': existing_order.get('receiver_city', ''),
                            'buyer_id': existing_order.get('buyer_id', ''),
                            'item_id': existing_order.get('item_id', ''),
                            'can_rate': existing_order.get('can_rate', False),
                            'timestamp': time.time(),
                            'from_cache': True
                        }
                        return result
                    else:
                        if not amount_valid:
                            logger.info(f"📋 订单 {order_id} 金额无效({amount})，需要重新获取")
                            print(f"⚠️ 订单 {order_id} 金额无效，重新获取...")
                        if not receiver_info_complete:
                            logger.info(f"📋 订单 {order_id} 收货人信息不完整，需要重新获取")
                            print(f"⚠️ 订单 {order_id} 收货人信息不完整，重新获取...")

                # 获取浏览器实例（使用浏览器池或创建新实例）
                if self.use_pool:
                    logger.info(f"🌐 从浏览器池获取浏览器实例...")
                    browser_pool = get_browser_pool()
                    result = await browser_pool.get_browser(self.cookie_id, self.cookie_string, headless)

                    if not result:
                        logger.error("从浏览器池获取浏览器失败")
                        return None

                    self.browser, self.context, self.page = result
                else:
                    logger.error("非池模式暂未实现")
                    return None

                # 重置API响应列表
                self.api_responses = []

                # 设置路由拦截器（拦截API响应）
                async def handle_route(route, request):
                    """拦截网络请求"""
                    # 拦截订单详情API
                    if 'mtop.idle.web.trade.order.detail' in request.url:
                        logger.info(f"[拦截] 发现订单详情API请求")

                        # 继续请求并获取响应
                        response = await route.fetch()
                        body = await response.body()

                        try:
                            result = json.loads(body)
                            self.api_responses.append(result)
                            logger.info(f"[拦截] API响应已保存")
                        except Exception as e:
                            logger.error(f"解析API响应失败: {e}")

                    # 继续所有请求
                    await route.continue_()

                # 设置路由拦截
                await self.page.route('**/*', handle_route)

                # 访问订单详情页面
                url = f"https://www.goofish.com/order-detail?orderId={order_id}&role=seller"
                logger.info(f"访问订单详情页面: {url}")
                print(f"🌐 访问页面: {url}")

                response = await self.page.goto(url, wait_until='networkidle', timeout=timeout * 1000)

                if not response or response.status != 200:
                    logger.error(f"页面访问失败，状态码: {response.status if response else 'None'}")
                    return None

                logger.info(f"页面访问成功，状态码: {response.status}")

                # 等待API响应和页面渲染
                logger.info("等待API响应和页面渲染...")
                await asyncio.sleep(2)

                # 快速滚动，触发延迟加载的内容
                await self.page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
                await asyncio.sleep(0.5)
                await self.page.evaluate('window.scrollTo(0, 0)')
                await asyncio.sleep(1)

                # 解析API响应数据
                api_data = {}
                if self.api_responses:
                    logger.info(f"拦截到 {len(self.api_responses)} 个API响应")
                    api_result = self.api_responses[0]

                    if api_result.get('ret') and api_result['ret'][0].startswith('SUCCESS'):
                        order_data = api_result.get('data', {})
                        api_data = self._parse_api_response(order_data)
                        logger.info(f"API数据解析成功: {api_data.keys()}")
                    else:
                        logger.warning(f"API响应失败: {api_result.get('ret', ['未知错误'])[0]}")
                else:
                    logger.warning("未拦截到API响应，仅使用DOM解析数据")

                # 解析DOM数据
                dom_data = await self._parse_dom_content()
                logger.info(f"DOM数据解析成功: {dom_data.keys()}")

                # 合并数据（API数据优先，DOM数据补充）
                result = {
                    'order_id': order_id,
                    'url': url,
                    'title': await self.page.title() if self.page else f"订单详情 - {order_id}",
                    'timestamp': time.time(),
                    'from_cache': False
                }

                # 从API获取的数据
                result['order_status'] = api_data.get('order_status', 'unknown')
                result['status_text'] = api_data.get('status_text', '')
                result['item_title'] = api_data.get('item_title', '')
                result['buyer_id'] = api_data.get('buyer_id', '')
                result['item_id'] = api_data.get('item_id', '')
                result['can_rate'] = api_data.get('can_rate', False)

                # 从DOM获取的数据（更可靠）
                result['spec_name'] = dom_data.get('spec_name', '')
                result['spec_value'] = dom_data.get('spec_value', '')
                result['quantity'] = dom_data.get('quantity', '1')
                result['amount'] = dom_data.get('amount', api_data.get('price', ''))
                result['order_time'] = dom_data.get('order_time', '')
                result['receiver_name'] = dom_data.get('receiver_name', api_data.get('receiver_name', ''))
                result['receiver_phone'] = dom_data.get('receiver_phone', api_data.get('receiver_phone', ''))
                result['receiver_address'] = dom_data.get('receiver_address', api_data.get('receiver_address', ''))
                result['receiver_city'] = api_data.get('receiver_city', '')

                logger.info(f"订单 {order_id} 完整信息获取成功")
                print(f"✅ 订单 {order_id} 信息获取成功")

                return result

            except Exception as e:
                logger.error(f"获取订单完整信息失败: {e}")
                print(f"❌ 获取订单 {order_id} 失败: {e}")
                return None
            finally:
                # 清理：关闭页面（因为浏览器池为每个请求创建新页面）
                if self.page and self.use_pool:
                    try:
                        await self.page.close()
                        logger.debug(f"已关闭页面: {order_id}")
                    except Exception as e:
                        logger.debug(f"关闭页面失败: {e}")
                    self.page = None

    def _parse_api_response(self, order_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        解析API响应数据

        Args:
            order_data: API返回的订单数据

        Returns:
            解析后的数据字典
        """
        result = {}

        try:
            # 提取订单状态
            result['order_status'] = order_data.get('status', 'unknown')
            result['status_text'] = order_data.get('utArgs', {}).get('orderStatusName', '')

            # 提取商品信息
            components = order_data.get('components', [])
            for component in components:
                if component.get('render') == 'orderInfoVO':
                    # 商品信息
                    item_info = component.get('data', {}).get('itemInfo', {})
                    result['item_title'] = item_info.get('title', '')
                    result['item_id'] = item_info.get('itemId', '')

                    # 价格信息
                    price_info = component.get('data', {}).get('priceInfo', {})
                    amount = price_info.get('amount', {})
                    result['price'] = amount.get('value', '')

                    # 收货地址信息
                    address_info = component.get('data', {}).get('addressInfo', {})
                    if address_info:
                        result['receiver_name'] = address_info.get('receiverName', '')
                        result['receiver_phone'] = address_info.get('receiverMobile', '')

                        # 构建完整地址
                        province = address_info.get('province', '')
                        city = address_info.get('city', '')
                        district = address_info.get('district', '')
                        detail_address = address_info.get('detailAddress', '')
                        full_address = address_info.get('fullAddress', '')

                        result['receiver_city'] = city

                        if full_address:
                            result['receiver_address'] = full_address
                        elif province or city or district or detail_address:
                            address_parts = [p for p in [province, city, district, detail_address] if p]
                            result['receiver_address'] = ' '.join(address_parts)

                    # 买家ID
                    buyer_info = component.get('data', {}).get('buyerInfo', {})
                    result['buyer_id'] = buyer_info.get('userId', '')

            # 检查是否可评价
            bottom_bar = order_data.get('bottomBarVO', {})
            button_list = bottom_bar.get('buttonList', [])
            result['can_rate'] = any(btn.get('tradeAction') == 'RATE' for btn in button_list)

        except Exception as e:
            logger.error(f"解析API响应失败: {e}")

        return result

    async def _parse_dom_content(self) -> Dict[str, Any]:
        """
        解析页面DOM内容

        Returns:
            解析后的数据字典
        """
        result = {}

        try:
            # 获取金额
            amount_selector = '.boldNum--JgEOXfA3'
            amount_element = await self.page.query_selector(amount_selector)
            if amount_element:
                amount_text = await amount_element.text_content()
                if amount_text:
                    result['amount'] = amount_text.strip()
                    logger.info(f"找到金额: {result['amount']}")

            # 获取订单时间
            await self._get_order_time(result)

            # 获取收货人信息
            await self._get_receiver_info(result)

            # 获取SKU信息
            sku_selector = '.sku--u_ddZval'
            sku_elements = await self.page.query_selector_all(sku_selector)
            logger.info(f"找到 {len(sku_elements)} 个sku元素")

            if len(sku_elements) >= 1:
                # 第一个元素是规格
                spec_content = await sku_elements[0].text_content()
                if spec_content and ':' in spec_content:
                    parts = spec_content.split(':', 1)
                    result['spec_name'] = parts[0].strip()
                    result['spec_value'] = parts[1].strip()
                    logger.info(f"规格: {result['spec_name']} = {result['spec_value']}")

            if len(sku_elements) >= 2:
                # 第二个元素是数量
                quantity_content = await sku_elements[1].text_content()
                if quantity_content:
                    if ':' in quantity_content:
                        quantity_value = quantity_content.split(':', 1)[1].strip()
                    else:
                        quantity_value = quantity_content.strip()

                    # 去掉 'x' 符号
                    if quantity_value.startswith('x'):
                        quantity_value = quantity_value[1:]

                    result['quantity'] = quantity_value
                    logger.info(f"数量: {result['quantity']}")

            # 确保数量字段存在
            if 'quantity' not in result:
                result['quantity'] = '1'

        except Exception as e:
            logger.error(f"解析DOM内容失败: {e}")

        return result

    async def _get_order_time(self, result: Dict[str, str]) -> None:
        """获取订单创建时间"""
        try:
            time_selectors = [
                'text=/下单时间/',
                'text=/订单创建时间/',
                'text=/创建时间/',
            ]

            for selector in time_selectors:
                try:
                    time_element = await self.page.query_selector(selector)
                    if time_element:
                        time_text = await time_element.text_content()
                        if time_text:
                            time_match = re.search(r'(\d{4}[-/]\d{2}[-/]\d{2}\s+\d{2}:\d{2}(?::\d{2})?)', time_text)
                            if time_match:
                                result['order_time'] = time_match.group(1).replace('/', '-')
                                logger.info(f"订单时间: {result['order_time']}")
                                return
                except Exception:
                    continue

            # 从页面源码查找
            page_content = await self.page.content()
            time_match = re.search(r'(?:下单时间|订单创建时间|创建时间).*?(\d{4}[-/]\d{2}[-/]\d{2}\s+\d{2}:\d{2}(?::\d{2})?)', page_content)
            if time_match:
                result['order_time'] = time_match.group(1).replace('/', '-')
                logger.info(f"订单时间: {result['order_time']}")

        except Exception as e:
            logger.error(f"获取订单时间失败: {e}")

    async def _get_receiver_info(self, result: Dict[str, str]) -> None:
        """获取收货人信息"""
        try:
            # 方法1: 查找"收货地址"标签
            address_label = await self.page.query_selector('text=/收货地址/')
            if address_label:
                parent_li = await address_label.evaluate_handle('el => el.closest("li")')
                if parent_li:
                    address_span = await parent_li.query_selector('span.textItemValue--w9qCWO1o')
                    if not address_span:
                        address_span = await parent_li.query_selector('[class*="textItemValue"]')

                    if address_span:
                        address_text = await address_span.text_content()
                        if address_text:
                            address_text = address_text.strip()
                            logger.info(f"收货地址文本: {address_text}")

                            # 提取手机号
                            phone_match = re.search(r'1[3-9]\d[\d\*]{8}', address_text)
                            if phone_match:
                                result['receiver_phone'] = phone_match.group(0)

                                # 提取姓名
                                name_part = address_text[:phone_match.start()].strip()
                                if name_part:
                                    result['receiver_name'] = name_part

                                # 提取地址
                                address_part = address_text[phone_match.end():].strip()
                                if address_part:
                                    result['receiver_address'] = address_part

                            if 'receiver_name' in result and 'receiver_phone' in result:
                                return

            # 方法2: 从页面文本查找
            body_text = await self.page.inner_text('body')
            lines = body_text.split('\n')
            for i, line in enumerate(lines):
                if '收货地址' in line and i + 1 < len(lines):
                    next_line = lines[i + 1].strip()
                    phone_match = re.search(r'1[3-9]\d[\d\*]{8}', next_line)
                    if phone_match:
                        result['receiver_phone'] = phone_match.group(0)
                        result['receiver_name'] = next_line[:phone_match.start()].strip()
                        result['receiver_address'] = next_line[phone_match.end():].strip()
                        result['receiver_address'] = re.sub(r'复制$', '', result['receiver_address']).strip()
                    break

        except Exception as e:
            logger.error(f"获取收货人信息失败: {e}")


async def fetch_order_complete(
    order_id: str,
    cookie_id: str,
    cookie_string: str,
    timeout: int = 30,
    headless: bool = True,
    use_pool: bool = True
) -> Optional[Dict[str, Any]]:
    """
    获取完整的订单信息（便捷函数）

    Args:
        order_id: 订单ID
        cookie_id: Cookie ID
        cookie_string: Cookie字符串
        timeout: 超时时间（秒）
        headless: 是否无头模式
        use_pool: 是否使用浏览器池

    Returns:
        完整的订单信息字典，失败返回None
    """
    fetcher = OrderFetcherOptimized(cookie_id, cookie_string, use_pool)
    return await fetcher.fetch_order_complete(order_id, timeout, headless)


async def process_orders_batch(
    order_ids: List[str],
    cookie_id: str,
    cookie_string: str,
    max_concurrent: int = 5,
    timeout: int = 30,
    headless: bool = True,
    use_pool: bool = True
) -> List[Dict[str, Any]]:
    """
    并发批量处理订单

    使用asyncio.gather()并发处理多个订单，控制并发数避免被封

    Args:
        order_ids: 订单ID列表
        cookie_id: Cookie ID
        cookie_string: Cookie字符串
        max_concurrent: 最大并发数（默认5）
        timeout: 超时时间（秒）
        headless: 是否无头模式
        use_pool: 是否使用浏览器池

    Returns:
        订单信息字典列表（包含成功和失败的结果）
    """
    logger.info(f"开始批量处理 {len(order_ids)} 个订单，最大并发数: {max_concurrent}")
    print(f"🚀 批量处理 {len(order_ids)} 个订单（并发数: {max_concurrent}）")

    # 创建信号量控制并发数
    semaphore = asyncio.Semaphore(max_concurrent)

    async def process_single_order(order_id: str, index: int) -> Dict[str, Any]:
        """
        处理单个订单（带并发控制）

        Args:
            order_id: 订单ID
            index: 订单索引

        Returns:
            订单信息字典（成功或失败）
        """
        async with semaphore:
            try:
                logger.info(f"[{index + 1}/{len(order_ids)}] 开始处理订单: {order_id}")
                print(f"[{index + 1}/{len(order_ids)}] 处理订单: {order_id}")

                result = await fetch_order_complete(
                    order_id=order_id,
                    cookie_id=cookie_id,
                    cookie_string=cookie_string,
                    timeout=timeout,
                    headless=headless,
                    use_pool=use_pool
                )

                if result:
                    logger.info(f"[{index + 1}/{len(order_ids)}] 订单 {order_id} 处理成功")
                    print(f"✅ [{index + 1}/{len(order_ids)}] 订单 {order_id} 成功")
                    return result
                else:
                    logger.warning(f"[{index + 1}/{len(order_ids)}] 订单 {order_id} 处理失败")
                    print(f"❌ [{index + 1}/{len(order_ids)}] 订单 {order_id} 失败")
                    return {
                        'order_id': order_id,
                        'success': False,
                        'error': '获取订单信息失败'
                    }

            except Exception as e:
                logger.error(f"[{index + 1}/{len(order_ids)}] 订单 {order_id} 处理异常: {e}")
                print(f"❌ [{index + 1}/{len(order_ids)}] 订单 {order_id} 异常: {e}")
                return {
                    'order_id': order_id,
                    'success': False,
                    'error': str(e)
                }

    # 创建所有任务
    tasks = [
        process_single_order(order_id, index)
        for index, order_id in enumerate(order_ids)
    ]

    # 并发执行所有任务（asyncio.gather会等待所有任务完成）
    logger.info(f"开始并发执行 {len(tasks)} 个任务...")
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # 处理异常结果
    processed_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.error(f"任务 {i} 抛出异常: {result}")
            processed_results.append({
                'order_id': order_ids[i],
                'success': False,
                'error': str(result)
            })
        else:
            processed_results.append(result)

    # 统计结果
    success_count = sum(1 for r in processed_results if r and not r.get('error'))
    fail_count = len(processed_results) - success_count

    logger.info(f"批量处理完成: 成功 {success_count}，失败 {fail_count}")
    print(f"\n📊 批量处理完成:")
    print(f"   ✅ 成功: {success_count}")
    print(f"   ❌ 失败: {fail_count}")

    return processed_results


async def process_orders_in_batches(
    order_ids: List[str],
    cookie_id: str,
    cookie_string: str,
    batch_size: int = 10,
    max_concurrent: int = 5,
    timeout: int = 30,
    headless: bool = True,
    use_pool: bool = True,
    batch_delay: float = 2.0
) -> List[Dict[str, Any]]:
    """
    分批并发处理订单（适合大量订单）

    将订单分成多个批次，每批次内部并发处理，批次之间串行执行并延迟

    Args:
        order_ids: 订单ID列表
        cookie_id: Cookie ID
        cookie_string: Cookie字符串
        batch_size: 每批次的订单数（默认10）
        max_concurrent: 每批次内的最大并发数（默认5）
        timeout: 超时时间（秒）
        headless: 是否无头模式
        use_pool: 是否使用浏览器池
        batch_delay: 批次之间的延迟时间（秒，默认2秒）

    Returns:
        所有订单的信息字典列表
    """
    total_orders = len(order_ids)
    total_batches = (total_orders + batch_size - 1) // batch_size

    logger.info(f"开始分批处理 {total_orders} 个订单，分为 {total_batches} 批，每批 {batch_size} 个，批内并发 {max_concurrent}")
    print(f"🔄 分批处理 {total_orders} 个订单:")
    print(f"   📦 总批次: {total_batches}")
    print(f"   📊 每批: {batch_size} 个")
    print(f"   ⚡ 批内并发: {max_concurrent}")

    all_results = []

    for batch_index in range(total_batches):
        start_idx = batch_index * batch_size
        end_idx = min((batch_index + 1) * batch_size, total_orders)
        batch_order_ids = order_ids[start_idx:end_idx]

        logger.info(f"\n批次 {batch_index + 1}/{total_batches}: 处理订单 {start_idx + 1}-{end_idx}")
        print(f"\n📦 批次 {batch_index + 1}/{total_batches} ({len(batch_order_ids)} 个订单)")

        # 处理当前批次
        batch_results = await process_orders_batch(
            order_ids=batch_order_ids,
            cookie_id=cookie_id,
            cookie_string=cookie_string,
            max_concurrent=max_concurrent,
            timeout=timeout,
            headless=headless,
            use_pool=use_pool
        )

        all_results.extend(batch_results)

        # 批次之间延迟（最后一批不需要延迟）
        if batch_index < total_batches - 1:
            logger.info(f"批次 {batch_index + 1} 完成，等待 {batch_delay} 秒后开始下一批...")
            print(f"⏳ 等待 {batch_delay} 秒...")
            await asyncio.sleep(batch_delay)

    # 总体统计
    success_count = sum(1 for r in all_results if r and not r.get('error'))
    fail_count = len(all_results) - success_count

    logger.info(f"\n所有批次处理完成: 成功 {success_count}，失败 {fail_count}")
    print(f"\n🎉 所有批次处理完成:")
    print(f"   ✅ 成功: {success_count}/{total_orders}")
    print(f"   ❌ 失败: {fail_count}/{total_orders}")

    return all_results
