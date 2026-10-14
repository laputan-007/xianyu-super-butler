"""把两条测试发布商品在闲鱼上下架删除，不留测试痕迹。"""

import asyncio
import json
import sqlite3

from playwright.async_api import async_playwright

DB = 'data/xianyu_data.db'
ACCOUNT_ID = '2222745565611'
ITEM_IDS = ['1093035584949', '1093039284456']

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')


async def take_down(page, item_id: str, calls: list) -> bool:
    await page.goto(f'https://www.goofish.com/item?id={item_id}', wait_until='domcontentloaded', timeout=60000)
    await page.wait_for_timeout(8000)
    # 卖家自己的商品页是 DIV.sellerButton（非 button 标签）
    btn = page.locator('div').filter(has_text='下架').locator('.sellerButton--BSIPdVcG').first
    try:
        await btn.click(timeout=8000)
    except Exception:
        btn = page.get_by_text('下架', exact=True).first
        try:
            await btn.click(timeout=8000)
        except Exception:
            print(f'[{item_id}] 未找到下架按钮')
            return False
    await page.wait_for_timeout(5000)
    # 可能出现确认弹窗
    for text in ('确定', '确认'):
        confirm = page.get_by_text(text, exact=True).last
        try:
            await confirm.click(timeout=2500)
            await page.wait_for_timeout(3000)
            break
        except Exception:
            continue
    body = await page.evaluate("() => document.body.innerText.slice(0, 300)")
    print(f'[{item_id}] 下架后页面片段: {body[:150]!r}')
    return True


async def main() -> None:
    conn = sqlite3.connect(DB)
    cookies_str = conn.execute('SELECT value FROM cookies WHERE id=?', (ACCOUNT_ID,)).fetchone()[0]
    conn.close()
    cookies = []
    for pair in cookies_str.split(';'):
        pair = pair.strip()
        if '=' not in pair:
            continue
        name, value = pair.split('=', 1)
        for domain in ('.goofish.com', '.taobao.com'):
            cookies.append({'name': name.strip(), 'value': value.strip(), 'domain': domain, 'path': '/'})

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-gpu'])
        context = await browser.new_context(viewport={'width': 1440, 'height': 900}, user_agent=UA)
        await context.add_cookies(cookies)
        page = await context.new_page()

        calls: list = []

        async def on_response(response):
            if 'h5api.m.goofish.com' not in response.url:
                return
            entry = {'url': response.url[:200]}
            try:
                post = response.request.post_data
                if post:
                    entry['post'] = post[:600]
                entry['body'] = (await response.text())[:400]
            except Exception:
                pass
            calls.append(entry)

        page.on('response', lambda r: asyncio.ensure_future(on_response(r)))

        for item_id in ITEM_IDS:
            before = len(calls)
            await take_down(page, item_id, calls)
            new_calls = calls[before:]
            for call in new_calls:
                if 'idle' in call.get('url', '') and 'gaia' not in call.get('url', ''):
                    print(f'[{item_id}] delist api: {call}')

        await browser.close()


asyncio.run(main())
