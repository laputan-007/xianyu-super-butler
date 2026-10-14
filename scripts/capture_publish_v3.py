"""补充抓包：发布表单的扩展字段协议。

- 填 价格 + 原价（第二个 0.00 输入框）
- 点击 宝贝所在地 字段，抓地址列表接口
- 选择「按距离计费」发货方式
- 点发布，抓带原价/运费的完整 payload
- 在商品页点「删除」，抓删除接口
"""

import asyncio
import json
import sqlite3

from playwright.async_api import async_playwright

DB = 'data/xianyu_data.db'
ACCOUNT_ID = '2222745565611'
PUBLISH_URL = 'https://www.goofish.com/publish?spm=a21ybx.search.sidebar.1.37db1d0a1l2d57'
TEST_IMAGE = 'static/login-cover.png'
OUT = 'scripts/publish_capture_v3.json'
DESC_TEXT = '九成新闲置公路自行车，变速顺畅刹车灵敏，自提优先可小刀'

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')


def load_cookie_string() -> str:
    conn = sqlite3.connect(DB)
    try:
        return conn.execute('SELECT value FROM cookies WHERE id=?', (ACCOUNT_ID,)).fetchone()[0]
    finally:
        conn.close()


async def main() -> None:
    cookies = []
    for pair in load_cookie_string().split(';'):
        pair = pair.strip()
        if '=' not in pair:
            continue
        name, value = pair.split('=', 1)
        for domain in ('.goofish.com', '.taobao.com'):
            cookies.append({'name': name.strip(), 'value': value.strip(), 'domain': domain, 'path': '/'})

    captures: list = []
    marks: list = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-gpu'])
        context = await browser.new_context(viewport={'width': 1440, 'height': 900}, user_agent=UA)
        await context.add_cookies(cookies)
        page = await context.new_page()

        async def on_response(response):
            url = response.url
            if 'h5api.m.goofish.com' not in url:
                return
            entry = {'url': url[:400]}
            try:
                req = response.request
                pd = req.post_data
                if pd:
                    entry['post_data'] = pd[:15000]
                entry['status'] = response.status
                body = await response.text()
                entry['body'] = body[:15000]
            except Exception as exc:
                entry['error'] = str(exc)
            captures.append(entry)

        page.on('response', lambda r: asyncio.ensure_future(on_response(r)))

        def mark(label):
            marks.append({'label': label, 'at': len(captures)})
            print(f'--- {label} ({len(captures)}) ---')

        await page.goto(PUBLISH_URL, wait_until='domcontentloaded', timeout=60000)
        await page.wait_for_timeout(6000)
        mark('加载')

        editor = page.locator('[contenteditable="true"]').first
        await editor.click()
        await page.keyboard.type(DESC_TEXT)
        await page.wait_for_timeout(4000)

        await page.locator('input[type="file"]').first.set_input_files(TEST_IMAGE)
        await page.wait_for_timeout(8000)
        mark('描述+图片')

        # 价格 与 原价（两个 0.00 输入框）
        price_inputs = page.locator('input[placeholder="0.00"]')
        await price_inputs.nth(0).fill('199')
        await price_inputs.nth(1).fill('299')
        await page.wait_for_timeout(2000)
        mark('价格+原价')

        # 点击 宝贝所在地 字段，看地址选择面板（不修改，取消即可）
        try:
            await page.get_by_text('巴南区图书馆新馆', exact=False).first.click(timeout=5000)
            await page.wait_for_timeout(3000)
            addr_text = await page.evaluate("() => (document.body.innerText||'').slice(0, 2500)")
            mark('点击所在地')
            with open('scripts/publish_addr_panel.txt', 'w', encoding='utf-8') as f:
                f.write(addr_text)
            await page.keyboard.press('Escape')
        except Exception as exc:
            print('所在地交互失败:', exc)
        await page.wait_for_timeout(1500)

        # 选择 按距离计费
        try:
            await page.get_by_text('按距离计费', exact=True).first.click(timeout=5000)
            await page.wait_for_timeout(1500)
            mark('按距离计费')
        except Exception as exc:
            print('按距离计费点击失败:', exc)

        await page.screenshot(path='scripts/publish_v3_filled.png')

        # 发布
        await page.locator('button', has_text='发布').last.click()
        await page.wait_for_timeout(12000)
        mark('发布')
        print('发布后 URL:', page.url)

        # 商品页点 删除（DIV.sellerButton）
        try:
            del_btn = page.locator('div.sellerButton--BSIPdVcG').filter(has_text='删除').first
            await del_btn.click(timeout=8000)
            await page.wait_for_timeout(3000)
            # 确认弹窗
            for text in ('确定', '确认'):
                try:
                    await page.get_by_text(text, exact=True).last.click(timeout=3000)
                    break
                except Exception:
                    continue
            await page.wait_for_timeout(5000)
            mark('删除')
            print('删除后 URL:', page.url)
            final_text = await page.evaluate("() => (document.body.innerText||'').slice(0, 400)")
            print('删除后页面:', final_text[:200])
        except Exception as exc:
            print('删除点击失败:', exc)

        with open(OUT, 'w', encoding='utf-8') as f:
            json.dump({'marks': marks, 'captures': captures, 'final_url': page.url}, f, ensure_ascii=False, indent=1)
        print(f'共 {len(captures)} 条 -> {OUT}')
        await browser.close()


asyncio.run(main())
