# 2C2G 部署与运维要点

本项目的目标部署形态（按 2C2G 机器设计）。改造后的关键参数与排障开关全部汇总在此。

## 容量红线（2C2G）

| 项 | 上限 | 依据 |
|---|---|---|
| 闲鱼账号数 | 25–30 | 每账号约 15–25MB（实例+缓存+后台任务） |
| Web 用户数 | 5–8（每用户 3–5 账号） | 受账号总数约束 |
| 浏览器并发 | 1（全局） | 单个 Chromium ≈ 200MB，是最大的内存毛刺 |
| uvicorn | 1 进程 | 单循环合并形态（见下） |

## 架构形态（本次改造后）

- **单进程单事件循环**：账号任务与 FastAPI 共用主循环（`Start.py` 默认行为）。
  跨事件循环调用这一整类故障已从构造上消除。
- **SQLite WAL**：读写不互斥；`synchronous=NORMAL` 让 commit 不强刷盘。
- **消息去重落库**：`processed_messages` 表，TTL 6 小时，重启/重连窗口内
  不会对买家重复回复（这是原来内存去重清零导致的高频客诉源）。
- **发货与消息的 Web 操作**统一经 `_run_on_account_loop` 提交主循环执行，
  不再直接 await 账号实例。

## 部署

```bash
# systemd 方式（推荐，省去 docker 守护进程的内存开销）
sudo cp deploy/xianyu-butler.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now xianyu-butler
```

docker 方式沿用现有 compose，容器需加 `--memory=1600m --shm-size=256m`
（Chromium 在小 /dev/shm 下会随机崩溃）。

## 数据保护（L1，强烈建议）

1. 应用内每小时在线备份（`_db_backup_loop`，保留 24 小时级 + 7 日级）。
2. 跨机流式复制：[Litestream](https://litestream.io/) 常驻约 20MB 内存，
   持续把 WAL 复制到 S3 兼容存储，RPO ≈ 1 分钟：
   ```bash
   litestream replicate data/xianyu_data.db s3://<bucket>/xianyu
   # 灾难恢复：litestream restore -o data/xianyu_data.db s3://<bucket>/xianyu
   ```
3. 管理后台手动备份恢复已改为持锁 + 在线备份 API 实现，恢复期间账号
   任务只会短暂排队等待，不再出现连接被关闭导致的报错风暴。

## 内存稳定性

- `gc.freeze()` + 放宽 gen0 阈值：启动时自动应用（`Start.py`）。
- anyio 线程池收敛到 8 线程：启动时自动应用。
- SQL 日志默认关闭（持锁写日志曾显著放大锁持有时间）。
- 后台任务全部登记（`_create_tracked_task`）：账号停止时一并取消，
  不再有持旧 cookie 继续评价的孤儿任务。
- 长跑兜底：建议 crontab 每天 04:00 `systemctl restart xianyu-butler`
  （低峰 30 秒内的计划性重启，清零任何残余内存增长）。

## 排障开关（环境变量）

| 变量 | 作用 |
|---|---|
| `API_SEPARATE_THREAD=1` | 回退到旧的双事件循环形态（单循环出现问题时临时逃生） |
| `SQL_LOG_ENABLED=true` | 打开 SQL 日志（默认关，只在排查时短时打开） |
| `DB_PATH` | 自定义数据库路径 |
| `PLAYWRIGHT_BROWSERS_PATH` | 自定义浏览器安装位置 |

## 监控要点

- 健康检查：`GET /health`。
- 日志：`journalctl -u xianyu-butler -f`；关键告警字串：
  `database is locked`（锁冲突）、`attached to a different loop`（应为零）、
  `消息ID ... 已在数据库去重记录中`（去重生效的证据，属正常 INFO/WARNING）。
- 内存：`systemctl status xianyu-butler` 看 RSS；昼夜漂移 > 5% 视为泄漏
  告警（当前已知的泄漏源均已修复，漂移应趋平）。

## 升级硬件时的路径

账号增长到 60+ 时换 4C4G（浏览器并发 2–3），120+ 时按 4C8G 形态
拆 Web 与账号进程（参见架构方案 B）。本次改造的代码（去重落库、
生命周期、单循环语义）在更高级形态下全部复用。
