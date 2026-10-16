import os
import tempfile
import time
import unittest

from app.db_manager import DBManager


class AiCallLogTests(unittest.TestCase):
    """AI 调用留痕：token 与回复内容落库、按用户隔离查询、usage_stats 聚合。"""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.manager = DBManager(os.path.join(self.temp_dir.name, "ai_calls.db"))
        cursor = self.manager.conn.cursor()
        cursor.execute(
            "INSERT INTO users (username, email, password_hash) "
            "VALUES ('trace-user', 'trace@example.test', 'hash')"
        )
        self.user_id = cursor.lastrowid
        cursor.execute(
            "INSERT INTO cookies (id, value, user_id) VALUES ('trace-account', 'cookie', ?)",
            (self.user_id,),
        )
        self.manager.conn.commit()

    def tearDown(self):
        self.manager.close()
        self.temp_dir.cleanup()

    def test_add_and_query_ai_call_log(self):
        self.assertTrue(self.manager.add_ai_call_log(
            cookie_id="trace-account", user_id=self.user_id, chat_id="chat-1",
            intent="price", api_type="openai", model="qwen-plus",
            prompt_tokens=120, completion_tokens=35, total_tokens=155,
            reply_text="180 可以出", ok=True,
        ))
        self.assertTrue(self.manager.add_ai_call_log(
            cookie_id="trace-account", user_id=self.user_id, chat_id="chat-2",
            intent="default", api_type="openai", model="qwen-plus",
            reply_text="", ok=False, error_summary="RateLimitError: 429",
        ))

        logs = self.manager.get_ai_call_logs(user_id=self.user_id)
        self.assertEqual(len(logs), 2)
        # 倒序：最新在前
        self.assertEqual(logs[0]["intent"], "default")
        self.assertEqual(logs[0]["ok"], 0)
        self.assertEqual(logs[0]["error_summary"], "RateLimitError: 429")
        self.assertEqual(logs[1]["prompt_tokens"], 120)
        self.assertEqual(logs[1]["completion_tokens"], 35)
        self.assertEqual(logs[1]["total_tokens"], 155)
        self.assertEqual(logs[1]["reply_text"], "180 可以出")

        # admin 视角（user_id=None）能看到全部
        all_logs = self.manager.get_ai_call_logs()
        self.assertEqual(len(all_logs), 2)

    def test_user_isolation(self):
        self.manager.add_ai_call_log(
            cookie_id="trace-account", user_id=self.user_id,
            reply_text="ok", ok=True,
        )
        self.manager.add_ai_call_log(
            cookie_id="other-account", user_id=99999,
            reply_text="other", ok=True,
        )
        logs = self.manager.get_ai_call_logs(user_id=self.user_id)
        self.assertEqual(len(logs), 1)
        self.assertEqual(logs[0]["reply_text"], "ok")

    def test_usage_stat_token_aggregation(self):
        """bump_usage_stat 的 token 维度：按用户按天累计。"""
        self.manager.bump_usage_stat(self.user_id, "ai", "prompt_tokens", 120)
        self.manager.bump_usage_stat(self.user_id, "ai", "prompt_tokens", 80)
        self.manager.bump_usage_stat(self.user_id, "ai", "completion_tokens", 35)

        stats = self.manager.get_usage_stats(user_id=self.user_id, days=1)
        self.assertEqual(stats["totals"].get("ai_prompt_tokens"), 200)
        self.assertEqual(stats["totals"].get("ai_completion_tokens"), 35)

    def test_seven_day_window_excludes_old_rows(self):
        """超过 7 天的留痕不出现在查询窗口里。"""
        self.manager.add_ai_call_log(
            cookie_id="trace-account", user_id=self.user_id, reply_text="old", ok=True,
        )
        with self.manager.lock:
            cursor = self.manager.conn.cursor()
            cursor.execute(
                "UPDATE ai_call_logs SET created_at = datetime('now', '-8 days')"
            )
            self.manager.conn.commit()
        self.assertEqual(self.manager.get_ai_call_logs(), [])

    def test_cleanup_removes_expired_rows(self):
        self.manager.add_ai_call_log(
            cookie_id="trace-account", user_id=self.user_id, reply_text="recent", ok=True,
        )
        with self.manager.lock:
            cursor = self.manager.conn.cursor()
            cursor.execute(
                "INSERT INTO ai_call_logs (cookie_id, user_id, reply_text, created_at) "
                "VALUES ('trace-account', ?, 'expired', datetime('now', '-8 days'))",
                (self.user_id,),
            )
            self.manager.conn.commit()
        # days 参数管其他表；AI 留痕固定按 7 天清理
        self.manager.cleanup_old_data(days=90)
        remaining = self.manager.get_ai_call_logs()
        self.assertEqual(len(remaining), 1)
        self.assertEqual(remaining[0]["reply_text"], "recent")


if __name__ == "__main__":
    unittest.main()
