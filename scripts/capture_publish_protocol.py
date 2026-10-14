"""采集闲鱼发布页的真实 mtop 协议链路。

用数据库里的账号 cookie 打开发布页，监听 h5api 的全部请求/响应，
连同发布表单的 DOM 结构快照一起落盘，供实现发布客户端时参考。
"""

import asyncio
import json
import sqlite3

from playwright.async_api import async_playwright

DB = 'data/xianyu_data.db'
ACCOUNT_ID = '2222745565611'  # 天马星赶路的松节
PUBLISH_URL = 'https://www.goofish.com/publish?spm=a21ybx.search.sidebar.1.37db1d0a1l2d57'
OUT = 'scripts/publish_capture.json'
SHOT = 'scripts/publish_page.png'

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')


def load_cookie_string() -> str:
    conn = sqlite3.connect(DB)
    try:
        row = conn.execute('SELECT value FROM cookies WHERE id=?', (ACCOUNT_ID,)).fetchone()
        return row[0] if row else ''
    finally:
        conn.close()


async def main() -> None:
    cookie_str = load_cookie_string()
    if not cookie_str:
        raise SystemExit('no cookie found for account ' + ACCOUNT_ID)

    cookies = []
    for pair in cookie_str.split(';'):
        pair = pair.strip()
        if '=' not in pair:
            continue
        name, value = pair.split('=', 1)
        for domain in ('.goofish.com', '.taobao.com'):
            cookies.append({
                'name': name.strip(),
                'value': value.strip(),
                'domain': domain,
                'path': '/',
            })

    captures: list = []

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
            if 'h5api.m.goofish.com' not in url and 'mtop.' not in url:
                return
            entry = {'url': url[:400]}
            try:
                req = response.request
                entry['method'] = req.method
                post_data = req.post_data
                if post_data:
                    entry['post_data'] = post_data[:6000]
                entry['status'] = response.status
                body = await response.text()
                entry['body'] = body[:8000]
            except Exception as exc:  # 响应体可能取不到（流/跨域）
                entry['error'] = str(exc)
            captures.append(entry)
            print(f"[capture] {entry.get('status')} {url[:120]}")

        page.on('response', lambda r: asyncio.ensure_future(on_response(r)))

        await page.goto(PUBLISH_URL, wait_until='domcontentloaded', timeout=60000)
        await page.wait_for_timeout(9000)

        info = await page.evaluate(
            """() => ({
                title: document.title,
                url: location.href,
                text: (document.body?.innerText || '').slice(0, 4000),
                inputs: Array.from(document.querySelectorAll('input,textarea')).slice(0, 50).map(el => ({
                    tag: el.tagName,
                    type: el.type || '',
                    placeholder: el.placeholder || '',
                    id: el.id || '',
                    name: el.name || '',
                    cls: String(el.className).slice(0, 90),
                    visible: !!(el.offsetParent || el.getClientRects().length),
                })),
                buttons: Array.from(document.querySelectorAll('button,[role=button]'))
                    .slice(0, 40)
                    .map(el => (el.innerText || '').trim().slice(0, 24))
                    .filter(Boolean),
            })"""
        )
        await page.screenshot(path=SHOT)

        with open(OUT, 'w', encoding='utf-8') as f:
            json.dump({'page': info, 'captures': captures}, f, ensure_ascii=False, indent=1)

        print(f'captured {len(captures)} mtop calls -> {OUT}')
        print('page title:', info['title'])
        print('page url:', info['url'])
        await browser.close()


asyncio.run(main())
