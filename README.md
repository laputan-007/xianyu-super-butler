# 闲鱼超级管家（多账户稳定增强版）

面向闲鱼卖家的账号、商品、订单、消息、自动回复与自动发货一体化管理系统。
*一款能让你的想法'变现'的强大作品*

[![Version](https://img.shields.io/badge/Version-3.2.0-52c41a)](https://gitee.com/is-it-day-and-night/xianyu-super-butler)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![License](https://img.shields.io/badge/License-AGPL--3.0-222222)](LICENSE)
[![GitHub](https://img.shields.io/github/stars/laputan-007/xianyu-super-butler?style=flat&logo=github&color=f5b301)](https://github.com/laputan-007/xianyu-super-butler)

- 主仓库（Gitee）：https://gitee.com/is-it-day-and-night/xianyu-super-butler
- 镜像（GitHub）：https://github.com/laputan-007/xianyu-super-butler

**一个人把多个闲鱼账号做成一门自动运转的生意，让你的创意自动'变现'**

多账号统一托管，买家下单自动发卡密、自动确认收货、自动评价、自动求小红花、收货后自动致谢。
关键词和 AI 双层自动回复接住每一句咨询，商品与订单自动同步，滑块与人机验证自动处理。
从「盯着手机一个个回」变成「打开网页看数据」。

- 🏪 **多账号管理** — 扫码即接入，一个后台管完所有小号，逐账号独立配置策略
- 📦 **自动发货** — 卡密自动发出，支持多规格、多数量，发货前风险拦截
- 💬 **自动回复** — 关键词精确命中 + AI 议价，可设最低价与议价轮数，绝不越线让价
- ⭐ **买家互动** — 确认收货后自动评价、自动求小红花、自动发送致谢文本
- 🤖 **商品自动化** — 商品同步、素材库、定时擦亮、自动上下架
- 📊 **经营看板** — 成交额、到账、退款、订单和库存一屏掌握，**历史订单可一次性拉回**
- 🔒 **并发安全架构（v3.2.0）** — 单事件循环 + 去重落库 + 备份恢复安全化：多账号数据不串号、重启不重复回复、手动发货不再随机失败，**2核2G 小机器稳定承载 25~30 个账号**

![闲鱼超级管家运营概览](docs/screenshots/revenue-overview.png)

## 核心功能

| 模块 | 能力 |
| --- | --- |
| 总览 | 汇总营收、账号、订单、卡密库存和运行状态 |
| 账号 | 扫码、密码或 Cookie 登录，资料同步，监听任务状态，暂停和自动回复配置 |
| 商品 | 从闲鱼同步商品，维护本地详情、图片、规格、数量和商品回复 |
| 商品自动化 | 商品筛选、素材库、发布记录、定时删除、短链修复和补偿任务 |
| 订单 | 一键拉取闲鱼历史卖出订单，状态判定、详情补全、批量刷新、手动发货和异常保护 |
| 卡密 | 卡券分组、库存导入、状态管理、多规格和多数量发货 |
| 自动回复 | 账号关键词回复、默认回复和回复一次控制 |
| 人工智能回复 | 兼容 OpenAI 协议的大模型配置、上下文对话和测试 |
| 自动发货 | 全局、指定账号、指定商品三级发货规则及发货前风险拦截 |
| 消息管理 | 闲鱼会话列表、消息收发、搜索筛选、回复决策日志和过滤规则 |
| 通知与日志 | 通知渠道、账号绑定、风险日志和系统日志 |
| 设置 | 管理员账号与改密、注册与邮箱验证开关、服务、备份及系统配置 |
| 公告与更新 | 从自建地址拉取公告与版本信息，首页横幅提示，「关于」页手动检查更新 |
| 运行架构 | 单事件循环、SQLite WAL、消息去重落库、账号生命周期任务管理，多账户并发安全 |

## v3.2.0 多账户并发与稳定性改造（本版重点）

本版对运行架构做了一轮系统性加固，按功能拆分为独立提交（见提交历史），**业务逻辑零改动**：

| 改造项 | 解决的问题 |
| --- | --- |
| 数据隔离 | 商品指定回复、订单归属、Cookie 配置列全部按账号隔离，杜绝 A 账号的数据串到 B 账号 |
| 单事件循环 | uvicorn 并入账号主循环，跨事件循环调用故障从构造上消除；手动发货/发消息/人脸通知统一经账号主循环执行 |
| 消息去重落库 | 去重状态写入数据库（TTL 6 小时），账号重启或断线重连后不再对买家重复回复 |
| 备份恢复安全化 | 恢复全程持库锁并在原对象上重开连接；备份下载改走 SQLite 在线备份快照，堵死数据损坏窗口 |
| SQLite WAL | 读写不互斥、commit 不强刷盘，定时备份与分析查询不再互相撞锁 |
| 账号生命周期 | 后台任务全部登记、随实例一并取消，重启窗口不再有持旧 Cookie 执行自动评价等不可撤销动作的孤儿任务 |
| 内存纪律 | `gc.freeze`、anyio 线程池收敛、SQL 日志默认关闭，长跑进程内存漂移趋平 |
| 2C2G 部署包 | systemd 单元（OOM 分级保护主进程）+ 运维手册：[deploy/OPS-2C2G.md](deploy/OPS-2C2G.md) |

容量红线：2核2G 建议 ≤30 账号 / ≤8 用户；更大规模按运维手册的硬件阶梯扩容（4C8G 起可拆进程部署）。

## 界面预览

### 账号管理：一个后台管完所有小号

扫码添加账号，实时显示监听状态。每个账号可独立设置自动确认、人工接入暂停时长、
是否启用 AI 回复，互不干扰。

![账号管理](docs/screenshots/accounts.png)

### 商品与发货：卡密自动发到买家手上

同步在售商品，逐个商品绑定发货内容，支持多规格和多数量。已下架的商品会被标记出来
并默认隐藏，不和在售的混在一起。

![商品与发货](docs/screenshots/items-delivery.png)

### 订单管理：接入前的历史订单也能一次拉回来

「拉取卖出订单」会把闲鱼上的历史订单整批同步进来，不只是接入之后的新单，
所以刚部署就能看到完整的经营数据。状态、买家、实付金额和发货情况一目了然，
支持按账号和状态筛选，也能手动发货或补发。

![订单管理](docs/screenshots/orders.png)

### 买家互动：确认收货后的动作全部自动完成

评价买家、索要小红花、发送收货致谢，三项都能逐账号开关。买家一确认收货，
致谢立即发出，评价和求花在订单状态就绪后自动执行。

![买家互动](docs/screenshots/buyer-interaction.png)

### 消息中心：所有账号的会话在一个页面里

跨账号会话列表，支持搜索和筛选，可以直接接管对话。自动回复的每一次决策都有日志，
能查到为什么回了、为什么没回。

![消息中心](docs/screenshots/message-center.png)

## 如何部署

> **⚠️ 请勿部署到 Hugging Face Spaces 等共享托管平台**
>
> 本项目内置反检测浏览器（Patchright）、验证码处理（CAPTCHA/Geetest）与 Telegram 通知等组件，
> 这类组合极易被共享平台判定为滥用（platform abuse），已有多起导致账号被封、其他 Space 受牵连的先例。
> 此外，海外出口 IP 也会显著增加闲鱼自有风控的触发概率。
> **推荐部署到本地设备、自有 VPS 或国内服务器。**

### Docker Compose 本地构建（含本版全部改造）

```bash
git clone https://gitee.com/is-it-day-and-night/xianyu-super-butler.git
cd xianyu-super-butler

cp .env.example .env          # 不改也能启动，此时使用默认密码
docker compose up -d --build
```

国内网络用 CN 配置（apt、pip、npm、Chromium 全部走国内镜像）：

```bash
docker compose -f docker-compose-cn.yml up -d --build
```

可选 Nginx：`docker compose --profile with-nginx up -d --build`

> 上游提供的预构建镜像（ghcr.io/23star）**不含本版的稳定性改造**，仅适合体验上游版本；
> 需要本版能力请本地构建，或用下面的 systemd 裸机部署。
> NAS / 低配设备注意：本地构建的 `npm ci`、前端打包与依赖编译会同时抢占 CPU 和内存，
> 内存紧张时优先选择 systemd 裸机方式。

### 低配服务器（2核2G）：systemd 裸机部署

不跑 Docker 守护进程可省下 150~250MB 常驻内存，全部内存留给账号任务与浏览器毛刺：

```bash
git clone https://gitee.com/is-it-day-and-night/xianyu-super-butler.git
cd xianyu-super-butler

py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1          # Linux: source .venv/bin/activate
python -m pip install -r requirements.txt
playwright install chromium

sudo cp deploy/xianyu-butler.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now xianyu-butler
```

服务单元自带 OOM 分级保护（内存不足时先杀浏览器、绝不杀账号监听主进程）和崩溃自动重启。
容量红线、Litestream 跨机备份、每日计划性重启、排障开关等运维要点见
[deploy/OPS-2C2G.md](deploy/OPS-2C2G.md)。

### 源码运行（开发调试）

需要 Python 3.11+、Node.js 20+、npm。

```bash
git clone https://gitee.com/is-it-day-and-night/xianyu-super-butler.git
cd xianyu-super-butler

py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
playwright install chromium

cd frontend && npm ci && npm run build && cd ..
python Start.py
```

启动时默认进入**单事件循环形态**（Web 与账号任务共用一个循环）；如需临时回退旧的双循环
形态排查问题，设置环境变量 `API_SEPARATE_THREAD=1`。

### 访问

- 管理页面：`http://localhost:8080/`
- API 文档：`http://localhost:8080/docs`
- 健康检查：`http://localhost:8080/health`

默认管理员 **admin / admin123**，登录后请在「设置 → 账号与同步 → 修改登录密码」立即改掉。

数据持久化到 `./data`（数据库，WAL 模式）、`./logs`（日志）、`./backups`（备份）。
首次启动会自动为数据库开启 WAL 并创建消息去重表，无需手工迁移。

### 更新

```bash
# Docker 本地构建
git pull && docker compose up -d --build

# systemd 裸机
git pull && sudo systemctl restart xianyu-butler
```

> **滑块与人机验证、部署失败排查、使用流程** 见 [docs/deployment.md](docs/deployment.md)。
> 自动过滑块受平台风控限制不保证成功，自动失败时可在账号页转人工验证。

## 交流与反馈

<table>
  <tr>
    <th align="center">微信群</th>
    <th align="center">QQ群</th>
  </tr>
  <tr>
    <td align="center"><img src="docs/community/wechat-group.jpg" alt="闲鱼超级管家微信群二维码" width="180"></td>
    <td align="center"><img src="docs/community/qq-group.jpg" alt="闲鱼超级管家QQ群二维码" width="180"></td>
  </tr>
  <tr>
    <td align="center">二维码失效后会在仓库更新</td>
    <td align="center">群号：704866149</td>
  </tr>
</table>

缺陷和功能建议请提交到 [Gitee Issues](https://gitee.com/is-it-day-and-night/xianyu-super-butler/issues)。

## 许可与声明

本项目基于 [23Star/xianyu-super-butler](https://github.com/23Star/xianyu-super-butler)（其自身基于
[zhinianboke/xianyu-auto-reply](https://github.com/zhinianboke/xianyu-auto-reply)）二次开发并持续维护：
保留原项目核心能力，v3.2.0 起进行了多账户并发与稳定性架构改造（单事件循环、数据落库去重、
备份恢复安全化、账号生命周期管理、低配部署优化）。感谢两位上游作者的开源工作。

项目使用 [GNU Affero General Public License v3.0](LICENSE)。修改、部署或通过网络提供服务时，请遵守 AGPL-3.0 的源代码公开义务。

本项目仅供学习、研究和合法自动化使用。使用者应遵守法律法规及平台规则，并自行承担使用风险。
