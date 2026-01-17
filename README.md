# 🐟 闲鱼超级管家

<div align="center">

**现代化的闲鱼自动回复与管理平台 - 全新 Vben Admin 风格 UI**

[![GitHub](https://img.shields.io/badge/GitHub-23Star%2Fxianyu--super--butler-blue?logo=github)](https://github.com/23Star/xianyu-super-butler)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

基于 [zhinianboke/xianyu-auto-reply](https://github.com/zhinianboke/xianyu-auto-reply) 二次开发 · 全新 UI · 持续更新

</div>

---

## 📖 简介

闲鱼超级管家是在 [xianyu-auto-reply](https://github.com/zhinianboke/xianyu-auto-reply) 基础上的二次开发版本，保留了原项目的所有核心功能，并对前端 UI 进行了全面重构，带来更加现代化、专业化的使用体验。

### ✨ UI 重构亮点

- **Vben Admin 风格** - 蓝白色系 + 暗黑模式
- **多标签导航** - 同时操作多个页面
- **响应式布局** - 完美适配桌面端和移动端

### ⭐ 核心功能

- 🤖 智能回复（关键词 + AI）
- 🚚 自动发货（多规格 + 延时）
- 📱 多账号管理
- 🛍️ 商品管理与搜索
- 📊 Excel 批量导入导出
- 基本解决了滑块验证失败的问题，成功率测试99%
- 对订单系统小改了一下，支持对订单状态的正确更新（部分还待优化）
- 在菜单栏最下面支持资金统计，大概能算出来今天的收益（还带优化）

## 🔄 最近更新

### 订单数据刷新功能优化 (2026-01-16)

- **移除全量核对功能** - 取消前端的全量核对订单数据按钮，简化操作流程
- **智能订单刷新** - 更新订单状态功能现在会自动获取完整的收货人信息
  - 自动获取收货人姓名（receiver_name）
  - 自动获取收货人手机号（receiver_phone）
  - 自动获取收货人地址（receiver_address）
  - 数据来源：Playwright 访问 `https://www.goofish.com/order-detail` 实时抓取
- **订单状态识别优化** - 修正订单状态映射逻辑
  - "退款成功" 正确识别为 cancelled（已关闭）
  - "系统关闭" 正确识别为 cancelled（已关闭）
  - 优先识别最终状态，避免错误识别为中间状态
- **数据完整性检查** - 只有当收货人信息完整时才使用缓存数据，确保数据准确性

### 修复的技术问题

1. **缓存检查逻辑优化** - 修复了两处缓存检查不一致的问题，确保收货人信息能够正确获取
2. **批量刷新查询逻辑** - 修复了只刷新少数订单的问题，现在会刷新所有收货人信息缺失的订单
3. **Pydantic 字段冲突** - 修复了 BaseModel 字段名冲突的警告
---

## 🚀 快速开始

```bash
# 1. 克隆项目
git clone https://github.com/23Star/xianyu-super-butler.git
cd xianyu-super-butler

# 2. 安装后端依赖
pip install -r requirements.txt

# 3. 启动后端服务
python Start.py

# 4. 启动前端（开发模式）
cd frontend && npm install && npm run dev
```

后端访问 http://localhost:8080，前端开发服务器访问 http://localhost:5173

---

## 🏗️ 技术栈

| 后端 | 前端 |
|------|------|
| FastAPI + Python 3.11+ | React 18 + TypeScript |
| SQLite | Vite + TailwindCSS |
| WebSocket | Zustand + React Router |

---

## 🙏 致谢

- 原项目：[zhinianboke/xianyu-auto-reply](https://github.com/zhinianboke/xianyu-auto-reply)
- UI 灵感：[Vben Admin](https://github.com/vbenjs/vue-vben-admin)

---

## 📄 开源协议

[MIT License](https://opensource.org/licenses/MIT)

> ⚠️ 本项目仅供学习研究使用，严禁商业用途！

## 📊 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=23Star/xianyu-super-butler&type=Date)](https://star-history.com/#23Star/xianyu-super-butler&Date)

---

<div align="center">

**如果对您有帮助，请给个 Star ⭐**

Made with ❤️ by [23Star](https://github.com/23Star)

</div>
