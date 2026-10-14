"""采集闲鱼发布链路第二阶段 v2：正常类目 + 全量网络监听。

用「闲置自行车」类描述规避受限类目（软件服务类网页版禁发），
监听所有请求（图片上传不走 mtop 域名），点击发布抓最终提交报文。
"""

import asyncio
import json
import sqlite3

from playwright.async_api import async_playwright

DB = 'data/xianyu_data.db'
ACCOUNT_ID = '2222745565611'
PUBLISH_URL = 'https://www.goofish.com/publish?spm=a21ybx.search.sidebar.1.37db1d0a1l2d57'
TEST_IMAGE = 'static/login-cover.png'
OUT = 'scripts/publish_capture_fill.json'

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')

DESC_TEXT = '九成新闲置山地自行车，骑行一年车况良好，刹车灵敏，自提优先，可小刀'


def load_cookie_string() -> str:
    conn = sqlite3.connect(DB)
    try:
        row = conn.execute('SELECT value FROM cookies WHERE id=?', (ACCOUNT_ID,)).fetchone()
        return row[0] if row else ''
    finally:
        conn.close()


async def main() -> None:
    cookie_str = load_cookie_string()
    cookies = []
    for pair in cookie_str.split(';'):
        pair = pair.strip()
        if '=' not in pair:
            continue
        name, value = pair.split('=', 1)
        for domain in ('.goofish.com', '.taobao.com'):
            cookies.append({'name': name.strip(), 'value': value.strip(), 'domain': domain, 'path': '/'})

    captures: list = []
    phase_marks: list = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
        )
        context = await browser.new_context(viewport={'width': 1440, 'height': 900}, user_agent=UA)
        await context.add_cookies(cookies)
        page = await context.new_page()

        async def on_response(response):
            url = response.url
            # 静态资源跳过
            if any(url.startswith(prefix) for prefix in (
                'data:', 'blob:',
            )) or any(ext in url for ext in ('.js', '.css', '.png', '.jpg', '.svg', '.woff', '.woff2', '.gif')):
                return
            entry = {'url': url[:500]}
            try:
                req = response.request
                entry['method'] = req.method
                entry['resource_type'] = req.resource_type
                headers = await req.all_headers()
                entry['req_headers'] = {k: v for k, v in headers.items()
                                        if k.lower() in ('content-type', 'referer', 'origin', 'x-uid', 'accept')}
                post_data = req.post_data
                if post_data:
                    entry['post_data'] = post_data[:15000]
                entry['status'] = response.status
                ctype = response.headers.get('content-type', '')
                entry['resp_content_type'] = ctype[:60]
                if 'json' in ctype or 'text' in ctype or 'mtop' in url:
                    body = await response.text()
                    entry['body'] = body[:15000]
            except Exception as exc:
                entry['error'] = str(exc)
            captures.append(entry)

        page.on('response', lambda r: asyncio.ensure_future(on_response(r)))

        def mark(label: str):
            phase_marks.append({'label': label, 'at_index': len(captures)})
            print(f'--- {label} (已捕获 {len(captures)}) ---')

        await page.goto(PUBLISH_URL, wait_until='domcontentloaded', timeout=60000)
        await page.wait_for_timeout(6000)
        mark('页面加载完成')

        # 1. 填宝贝描述
        editor = page.locator('[contenteditable="true"]').first
        await editor.click()
        await page.keyboard.type(DESC_TEXT)
        await page.wait_for_timeout(5000)
        mark('填写描述')

        # 2. 上传图片
        file_input = page.locator('input[type="file"]').first
        await file_input.set_input_files(TEST_IMAGE)
        await page.wait_for_timeout(9000)
        mark('上传图片')

        # 3. 填价格
        price_input = page.locator('input[placeholder="0.00"]').first
        await price_input.click()
        await price_input.fill('420')
        await page.wait_for_timeout(3000)
        mark('填写价格')

        page_text_mid = await page.evaluate("() => (document.body?.innerText || '').slice(0, 2200)")
        await page.screenshot(path='scripts/publish_filled.png')

        # 4. 点发布（主按钮在表单底部，取可点击的 button 里文本恰为 发布 的最后一个）
        publish_btn = page.locator('button', has_text='发布').last
        await publish_btn.click()
        await page.wait_for_timeout(15000)
        mark('点击发布')

        await page.screenshot(path='scripts/publish_submitted.png')
        final_text = await page.evaluate("() => (document.body?.innerText || '').slice(0, 2500)")
        final_url = page.url

        with open(OUT, 'w', encoding='utf-8') as f:
            json.dump(
                {
                    'phases': phase_marks,
                    'captures': captures,
                    'final_url': final_url,
                    'final_text': final_text,
                    'mid_text': page_text_mid,
                },
                f,
                ensure_ascii=False,
                indent=1,
            )
        print(f'共捕获 {len(captures)} 条 -> {OUT}')
        print('final url:', final_url)
        print('final text 前 300:', final_text[:300].replace('\n', ' | '))
        await browser.close()


asyncio.run(main())
