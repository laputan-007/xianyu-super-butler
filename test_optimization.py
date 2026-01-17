"""
订单处理优化测试脚本

测试三个优化方案：
1. 浏览器实例池
2. 合并函数（一次浏览器调用）
3. 并发批量处理
"""
import asyncio
import time
from loguru import logger


async def test_browser_pool():
    """测试1: 浏览器实例池"""
    print("\n" + "=" * 60)
    print("测试1: 浏览器实例池")
    print("=" * 60)

    from utils.browser_pool import get_browser_pool

    # 获取浏览器池
    pool = get_browser_pool(max_size=3, idle_timeout=300)

    # 模拟Cookie（需要替换为真实Cookie）
    cookie_id = "test_user_1"
    cookie_string = "your_cookie_string_here"  # 替换为真实Cookie

    try:
        # 第一次获取浏览器（创建新实例）
        print("\n第一次获取浏览器...")
        start = time.time()
        result1 = await pool.get_browser(cookie_id, cookie_string, headless=True)
        elapsed1 = time.time() - start
        print(f"✅ 第一次获取成功，耗时: {elapsed1:.2f}秒")

        # 第二次获取浏览器（复用实例）
        print("\n第二次获取浏览器（应该复用）...")
        start = time.time()
        result2 = await pool.get_browser(cookie_id, cookie_string, headless=True)
        elapsed2 = time.time() - start
        print(f"✅ 第二次获取成功，耗时: {elapsed2:.2f}秒")

        # 对比
        print(f"\n⚡ 性能提升: {(elapsed1 - elapsed2) / elapsed1 * 100:.1f}%")

        # 查看池状态
        status = pool.get_pool_status()
        print(f"\n📊 浏览器池状态:")
        print(f"   总实例数: {status['total']}/{status['max_size']}")
        for instance in status['instances']:
            print(f"   - {instance['cookie_id']}: "
                  f"连接={instance['connected']}, "
                  f"闲置={instance['idle_time']:.1f}秒")

        # 清理
        await pool.close_all()
        print("\n✅ 浏览器池测试完成")

    except Exception as e:
        print(f"\n❌ 测试失败: {e}")


async def test_fetch_order_complete():
    """测试2: 合并函数（一次浏览器调用）"""
    print("\n" + "=" * 60)
    print("测试2: 合并函数（一次浏览器调用获取所有数据）")
    print("=" * 60)

    from utils.order_fetcher_optimized import fetch_order_complete

    # 测试订单ID（需要替换为真实订单ID）
    order_id = "2856024697612814489"  # 替换为真实订单ID
    cookie_id = "test_user_1"
    cookie_string = "your_cookie_string_here"  # 替换为真实Cookie

    try:
        print(f"\n开始获取订单: {order_id}")
        start = time.time()

        result = await fetch_order_complete(
            order_id=order_id,
            cookie_id=cookie_id,
            cookie_string=cookie_string,
            timeout=30,
            headless=True,
            use_pool=True
        )

        elapsed = time.time() - start

        if result:
            print(f"\n✅ 订单信息获取成功，耗时: {elapsed:.2f}秒")
            print("\n📋 订单详情:")
            print(f"   订单ID: {result['order_id']}")
            print(f"   订单状态: {result.get('status_text', 'N/A')}")
            print(f"   商品标题: {result.get('item_title', 'N/A')}")
            print(f"   金额: {result.get('amount', 'N/A')}")
            print(f"   规格: {result.get('spec_name', 'N/A')} = {result.get('spec_value', 'N/A')}")
            print(f"   数量: {result.get('quantity', 'N/A')}")
            print(f"   收货人: {result.get('receiver_name', 'N/A')}")
            print(f"   电话: {result.get('receiver_phone', 'N/A')}")
            print(f"   地址: {result.get('receiver_address', 'N/A')}")
            print(f"   买家ID: {result.get('buyer_id', 'N/A')}")
            print(f"   商品ID: {result.get('item_id', 'N/A')}")
            print(f"   数据来源: {'缓存' if result.get('from_cache') else '浏览器'}")
        else:
            print(f"\n❌ 订单信息获取失败")

    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()


async def test_batch_processing():
    """测试3: 并发批量处理"""
    print("\n" + "=" * 60)
    print("测试3: 并发批量处理")
    print("=" * 60)

    from utils.order_fetcher_optimized import process_orders_batch

    # 测试订单列表（需要替换为真实订单ID）
    order_ids = [
        "order_id_1",  # 替换为真实订单ID
        "order_id_2",
        "order_id_3",
        "order_id_4",
        "order_id_5",
    ]

    cookie_id = "test_user_1"
    cookie_string = "your_cookie_string_here"  # 替换为真实Cookie

    try:
        print(f"\n开始批量处理 {len(order_ids)} 个订单...")
        start = time.time()

        results = await process_orders_batch(
            order_ids=order_ids,
            cookie_id=cookie_id,
            cookie_string=cookie_string,
            max_concurrent=5,  # 并发5个
            timeout=30,
            headless=True,
            use_pool=True
        )

        elapsed = time.time() - start

        # 统计结果
        success_count = sum(1 for r in results if r and not r.get('error'))
        fail_count = len(results) - success_count

        print(f"\n✅ 批量处理完成，总耗时: {elapsed:.2f}秒")
        print(f"\n📊 处理结果:")
        print(f"   总订单数: {len(order_ids)}")
        print(f"   成功: {success_count}")
        print(f"   失败: {fail_count}")
        print(f"   平均耗时: {elapsed/len(order_ids):.2f}秒/订单")

        # 显示详细结果
        print(f"\n📋 详细结果:")
        for i, result in enumerate(results):
            if result and not result.get('error'):
                print(f"   [{i+1}] {result['order_id']}: ✅ 成功")
            else:
                error = result.get('error', '未知错误') if result else '未知错误'
                order_id = result.get('order_id', order_ids[i]) if result else order_ids[i]
                print(f"   [{i+1}] {order_id}: ❌ 失败 ({error})")

    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()


async def test_performance_comparison():
    """测试4: 性能对比（优化前 vs 优化后）"""
    print("\n" + "=" * 60)
    print("测试4: 性能对比（优化前 vs 优化后）")
    print("=" * 60)

    from utils.order_detail_fetcher import fetch_order_detail_simple
    from utils.order_fetcher_optimized import fetch_order_complete

    # 测试订单ID
    order_id = "2856024697612814489"  # 替换为真实订单ID
    cookie_id = "test_user_1"
    cookie_string = "your_cookie_string_here"  # 替换为真实Cookie

    try:
        # 优化前（旧方法）
        print("\n🔵 测试优化前的方法...")
        start = time.time()
        result_old = await fetch_order_detail_simple(
            order_id=order_id,
            cookie_string=cookie_string,
            headless=True
        )
        time_old = time.time() - start
        print(f"   耗时: {time_old:.2f}秒")

        # 等待一下，避免频繁请求
        await asyncio.sleep(2)

        # 优化后（新方法）
        print("\n🟢 测试优化后的方法...")
        start = time.time()
        result_new = await fetch_order_complete(
            order_id=order_id,
            cookie_id=cookie_id,
            cookie_string=cookie_string,
            timeout=30,
            headless=True,
            use_pool=True
        )
        time_new = time.time() - start
        print(f"   耗时: {time_new:.2f}秒")

        # 对比
        print(f"\n📊 性能对比:")
        print(f"   优化前: {time_old:.2f}秒")
        print(f"   优化后: {time_new:.2f}秒")
        if time_old > time_new:
            improvement = (time_old - time_new) / time_old * 100
            print(f"   ⚡ 性能提升: {improvement:.1f}%")
        else:
            print(f"   ⚠️ 第二次可能使用了缓存")

        # 数据对比
        print(f"\n📋 数据完整性对比:")
        if result_old and result_new:
            print(f"   订单ID: {'✅' if result_old.get('order_id') == result_new.get('order_id') else '❌'}")
            print(f"   金额: {'✅' if result_old.get('amount') == result_new.get('amount') else '❌'}")
            print(f"   收货人: {'✅' if result_old.get('receiver_name') == result_new.get('receiver_name') else '❌'}")
            print(f"   额外数据（订单状态、买家ID等）: {'✅ 有' if result_new.get('order_status') else '❌ 无'}")

    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()


async def main():
    """主测试函数"""
    print("\n" + "=" * 60)
    print("闲鱼订单处理优化测试")
    print("=" * 60)
    print("\n⚠️ 请先在代码中替换真实的Cookie和订单ID")
    print("\n开始测试...\n")

    # 选择要运行的测试
    tests = [
        ("浏览器实例池", test_browser_pool),
        ("合并函数", test_fetch_order_complete),
        ("并发批量处理", test_batch_processing),
        ("性能对比", test_performance_comparison),
    ]

    print("请选择要运行的测试:")
    for i, (name, _) in enumerate(tests):
        print(f"{i + 1}. {name}")
    print("0. 运行所有测试")

    try:
        choice = input("\n请输入选择 (0-4): ").strip()

        if choice == "0":
            # 运行所有测试
            for name, test_func in tests:
                await test_func()
                await asyncio.sleep(1)  # 测试之间短暂延迟
        elif choice in ["1", "2", "3", "4"]:
            # 运行单个测试
            index = int(choice) - 1
            name, test_func = tests[index]
            await test_func()
        else:
            print("❌ 无效的选择")

    except KeyboardInterrupt:
        print("\n\n⚠️ 测试被用户中断")
    except Exception as e:
        print(f"\n❌ 测试过程中发生错误: {e}")
        import traceback
        traceback.print_exc()

    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)


if __name__ == "__main__":
    # 配置日志
    logger.add("test_optimization.log", rotation="10 MB", level="INFO")

    # 运行测试
    asyncio.run(main())
