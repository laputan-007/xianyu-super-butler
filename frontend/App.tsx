import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import Sidebar from './components/Sidebar';
import GlobalFeedback from './components/GlobalFeedback';
import AnnouncementBanner from './components/AnnouncementBanner';
import ThemeToggle from './components/ThemeToggle';
import CaptchaInput from './components/CaptchaInput';
import { useCaptcha } from './lib/useCaptcha';
import { validateEmail, validatePassword, validateUsername } from './lib/authValidation';
import { login, verifyToken, getPublicSettings, register, sendVerificationCode } from './services/api';
import { ShieldCheck, ArrowRight, Loader2, User, Lock, Menu, Mail, KeyRound, CheckCircle2, Zap, MessageCircle, Users, Eye, EyeOff, Package, Bell } from 'lucide-react';

const Dashboard = lazy(() => import('./components/Dashboard'));
const AccountList = lazy(() => import('./components/AccountList'));
const OrderList = lazy(() => import('./components/OrderList'));
const CardList = lazy(() => import('./components/CardList'));
const ItemList = lazy(() => import('./components/ItemList'));
const ProductAutomation = lazy(() => import('./components/ProductAutomation'));
const AIReply = lazy(() => import('./components/AIReply'));
const Settings = lazy(() => import('./components/Settings'));
const Keywords = lazy(() => import('./components/Keywords'));
const MessageManagement = lazy(() => import('./components/MessageManagement'));
const NotificationsAndLogs = lazy(() => import('./components/NotificationsAndLogs'));
const UserManagement = lazy(() => import('./components/UserManagement'));
const About = lazy(() => import('./components/About'));
const BuyerInteraction = lazy(() => import('./components/BuyerInteraction'));

const PageLoader = () => (
  <div className="page-loading">
    <Loader2 className="h-5 w-5 animate-spin" />
    <span>正在加载页面</span>
  </div>
);

const pageLabels: Record<string, string> = {
  dashboard: '总览',
  accounts: '账号管理',
  items: '商品与发货',
  orders: '订单管理',
  'buyer-interaction': '买家互动',
  cards: '卡密库存',
  messages: '消息中心',
  'auto-reply': '自动回复',
  'ai-reply': 'AI 回复',
  'product-automation': '商品自动化',
  notifications: '通知与日志',
  settings: '系统设置',
  users: '用户管理',
  about: '关于',
};

// 系统级页面仅管理员可用；普通用户 localStorage 里残留这些 tab 时切回总览
const ADMIN_ONLY_TABS = ['settings', 'users'];

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('active_page') || 'dashboard');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  // 注册成功后回到登录页时的提示
  const [loginNotice, setLoginNotice] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // 注册相关。是否显示入口由后台「允许用户注册」控制，
  // 是否需要填验证码由后台「注册邮箱验证」控制（没配 SMTP 时可以关掉）。
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [allowRegister, setAllowRegister] = useState(false);
  const [needEmailCode, setNeedEmailCode] = useState(true);
  const [regForm, setRegForm] = useState({ username: '', email: '', password: '', code: '' });
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [regNotice, setRegNotice] = useState('');
  const [codeSending, setCodeSending] = useState(false);
  const [codeCountdown, setCodeCountdown] = useState(0);

  // 图形验证码：注册发码前必填；登录仅在连续失败被后端要求时出现
  const regCaptcha = useCaptcha();
  const loginCaptcha = useCaptcha();
  // 切到注册页时拉一张新图（离开登录态图形码随 required 重置）
  useEffect(() => {
    if (authMode === 'register') void regCaptcha.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authMode]);

  useEffect(() => {
    getPublicSettings()
      .then(s => {
        setAllowRegister(String(s.registration_enabled) === 'true');
        setNeedEmailCode(String(s.email_verification_enabled ?? 'true') !== 'false');
      })
      .catch(() => setAllowRegister(false));
  }, []);

  // 验证码重发倒计时
  useEffect(() => {
    if (codeCountdown <= 0) return;
    const timer = setTimeout(() => setCodeCountdown(codeCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [codeCountdown]);

  const handleSendCode = async () => {
    if (!regForm.email.trim()) {
      setRegError('请先填写邮箱');
      return;
    }
    // 后端强制图形验证码通过后才会发邮箱码（防刷发件资源）
    if (!regCaptcha.code.trim()) {
      setRegError('请先输入图形验证码');
      return;
    }
    setCodeSending(true);
    setRegError('');
    setRegNotice('');
    try {
      const res = await sendVerificationCode(regForm.email.trim(), 'register', {
        session_id: regCaptcha.sessionId,
        code: regCaptcha.code.trim(),
      });
      if (res?.success === false) {
        // 多半是没配 SMTP，直接把后端原因透出来，省得对着"发送失败"猜
        setRegError(res.message || '验证码发送失败，请确认邮件服务已配置');
        // 图形码一次性，无论成败都换新图
        void regCaptcha.refresh();
        return;
      }
      setRegNotice('验证码已发送，请查收邮箱');
      setCodeCountdown(60);
      void regCaptcha.refresh();
    } catch (err) {
      setRegError(err instanceof Error ? err.message : '验证码发送失败');
      void regCaptcha.refresh();
    } finally {
      setCodeSending(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegNotice('');

    // 与后端同一套规则/文案（lib/authValidation.ts）
    for (const [ok, reason] of [
      validateUsername(regForm.username.trim()),
      validateEmail(regForm.email.trim()),
      validatePassword(regForm.password),
    ]) {
      if (!ok) {
        setRegError(reason);
        return;
      }
    }
    if (needEmailCode && !regForm.code.trim()) {
      setRegError('请填写邮箱验证码');
      return;
    }

    setRegLoading(true);
    try {
      const res = await register({
        username: regForm.username.trim(),
        email: regForm.email.trim(),
        password: regForm.password,
        ...(needEmailCode ? { verification_code: regForm.code.trim() } : {}),
      });
      if (res?.success) {
        // 注册成功后回到登录页，并把用户名带过去，少填一次
        setUsername(regForm.username.trim());
        setPassword('');
        setRegForm({ username: '', email: '', password: '', code: '' });
        setAuthMode('login');
        setLoginError('');
        setRegNotice('');
        setLoginNotice('注册成功，请使用新账号登录');
      } else {
        setRegError(res?.message || '注册失败');
      }
    } catch (err) {
      setRegError(err instanceof Error ? err.message : '注册失败，请稍后重试');
    } finally {
      setRegLoading(false);
    }
  };

  // Check auth on mount
  useEffect(() => {
      const token = localStorage.getItem('auth_token');
      if (token) {
          verifyToken()
            .then(result => {
              if (!result.authenticated) {
                localStorage.removeItem('auth_token');
                return;
              }
              setIsAdmin(Boolean(result.is_admin));
              setIsLoggedIn(true);
            })
            .catch(() => localStorage.removeItem('auth_token'))
            .finally(() => setCheckingAuth(false));
      } else {
          setCheckingAuth(false);
      }
      
      const handleLogout = () => setIsLoggedIn(false);
      window.addEventListener('auth:logout', handleLogout);
      return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  useEffect(() => {
    localStorage.setItem('active_page', activeTab);
  }, [activeTab]);

  // 普通用户不能停留在系统级页面（入口已隐藏，这里兜底清掉本地记忆的 tab）
  useEffect(() => {
    if (!isAdmin && ADMIN_ONLY_TABS.includes(activeTab)) setActiveTab('dashboard');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const loginRootRef = useRef<HTMLDivElement>(null);

  // 登录页动效总编排：入场、循环动效。
  // - 入场只用位移/缩放 + 无回弹的缓动，落位干净不"抖"
  // - prefers-reduced-motion 时跳过全部装饰性动效（错误抖动等功能反馈保留）
  useEffect(() => {
    if (isLoggedIn || checkingAuth || !loginRootRef.current) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const ctx = gsap.context(() => {
      if (reduced) return;
      // 不做入场编排：页面直接以最终状态呈现，只保留环境循环动效
      // logo 漂浮、光环呼吸、光晕呼吸、吉祥物游动。
      // 各自 delay 留出入场窗口，避免与入场 tween 抢同一属性
      gsap.to('.login-cover-logo', { y: 9, duration: 3, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      gsap.to('.login-logo-glow', { scale: 1.25, opacity: 0.45, duration: 3.2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      gsap.utils.toArray<HTMLElement>('.login-glow').forEach((el, i) => {
        gsap.to(el, { scale: 1.15, duration: 4 + i * 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      });
      gsap.utils.toArray<HTMLElement>('.login-floaty').forEach((el, i) => {
        gsap.to(el, {
          y: 14 + i * 7,
          x: i % 2 ? 10 : -8,
          rotation: i % 2 ? 6 : -5,
          duration: 3.2 + i * 0.9,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
        });
      });
      gsap.to('.login-mascot-watermark', { rotation: 4, duration: 9, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      // 主视觉吉祥物：缓慢游动，带 x 轴轻摆更像在游
      gsap.to('.login-hero', { y: 7, x: 6, rotation: 2.5, duration: 3.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      // 接缝流光：一缕亮光沿金色接缝周期性下行
      gsap.fromTo('.login-seam-light', { top: '-18%' }, { top: '104%', duration: 2, ease: 'power1.inOut', repeat: -1, repeatDelay: 2.8 });
      // 标题流光：一道暖金色高光周期性从左向右扫过标题文字
      // 双层背景：第一层是移动的高光带（260% 宽），第二层是静态的白色-金色渐变底
      gsap.fromTo('.login-title',
        { backgroundPosition: '100% 0%, 0% 0%' },
        { backgroundPosition: '0% 0%, 0% 0%', duration: 2.4, ease: 'power1.inOut', repeat: -1, repeatDelay: 2.6 });
      // 标题金色光晕缓慢呼吸
      gsap.to('.login-title', { filter: 'drop-shadow(0px 4px 28px rgba(255,213,0,0.32))', duration: 2.2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    }, loginRootRef);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, checkingAuth]);

  // 登录/注册失败时抖一下表单卡片：错误出现即触发（清空再报错会重新抖）
  useEffect(() => {
    if (!loginError || isLoggedIn || !loginRootRef.current) return;
    gsap.fromTo(loginRootRef.current.querySelector('.login-form-card'), { x: 0 }, {
      keyframes: { x: [0, -12, 12, -8, 8, -4, 4, 0] },
      duration: 0.55,
      ease: 'power2.out',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginError]);

  useEffect(() => {
    if (!regError || isLoggedIn || !loginRootRef.current) return;
    gsap.fromTo(loginRootRef.current.querySelector('.login-form-card'), { x: 0 }, {
      keyframes: { x: [0, -12, 12, -8, 8, -4, 4, 0] },
      duration: 0.55,
      ease: 'power2.out',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regError]);

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoginLoading(true);
      setLoginError('');
      
      try {
          // 连续失败被后端要求后，随请求带上图形验证码
          const res = await login({
              username,
              password,
              ...(loginCaptcha.required ? {
                  captcha_session_id: loginCaptcha.sessionId,
                  captcha_code: loginCaptcha.code.trim(),
              } : {}),
          });
          if (res.success && res.token) {
              localStorage.setItem('auth_token', res.token);
              setIsAdmin(Boolean(res.is_admin));
              setIsLoggedIn(true);
          } else {
              setLoginError(res.message || '账号或密码错误');
              if (res.captcha_required) {
                  // 触发防爆破：下一次登录必须先过图形验证
                  loginCaptcha.setRequired(true);
                  void loginCaptcha.refresh();
              }
          }
      } catch (err) {
          setLoginError(err instanceof Error ? err.message : '登录失败，请稍后重试');
      } finally {
          setLoginLoading(false);
      }
  };

  if (checkingAuth) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-[var(--app-bg)]">
              <div className="flex items-center gap-3 text-sm font-semibold text-[var(--text-muted)]">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-text)]" />
                正在验证登录状态
              </div>
          </div>
      );
  }

  // Login Screen Component
  if (!isLoggedIn) {
    return (
      <div ref={loginRootRef} className="flex min-h-screen bg-[var(--app-bg)] font-sans text-[var(--text)]">
        {/* 左侧封面：暗色底衬托闲鱼黄 logo，与右侧表单形成分屏布局 */}
        <aside
          className="relative hidden w-3/5 shrink-0 select-none flex-col overflow-hidden lg:flex"
          style={{ background: 'linear-gradient(165deg, #241f13 0%, #17130a 55%, #0d0b06 100%)' }}
        >
          {/* 左上柔光：呼应 logo 位置，让画面有主光方向 */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(ellipse 60% 50% at 12% 0%, rgba(255,229,0,0.08) 0%, transparent 70%)' }}
          />
          {/* 点阵纹理：上密下疏的径向蒙版，比均匀铺满更有设计感 */}
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage: 'radial-gradient(rgba(255,229,0,0.16) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
              maskImage: 'radial-gradient(ellipse 75% 65% at 28% 18%, black 25%, transparent 95%)',
              WebkitMaskImage: 'radial-gradient(ellipse 75% 65% at 28% 18%, black 25%, transparent 95%)',
            }}
          />
          {/* 胶片颗粒：极低透明度的噪点，弱化渐变底的"数码平"感 */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'%3E%3C/svg%3E\")",
            }}
          />
          {/* 暗角：收拢视觉焦点，压暗四边增加层次（压在背景层上，不遮挡内容和鱼） */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(ellipse 92% 88% at 50% 42%, transparent 55%, rgba(0,0,0,0.42) 100%)' }}
          />
          {/* 呼吸光晕：左下角一团，插画身后一团（兼作插画光环） */}
          <div
            className="login-glow pointer-events-none absolute -bottom-44 -left-28 h-[24rem] w-[24rem] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(255,213,0,0.12) 0%, transparent 70%)' }}
          />
          <div
            className="login-glow pointer-events-none absolute right-1 top-5 h-48 w-48 rounded-full opacity-80"
            style={{ background: 'radial-gradient(circle, rgba(255,229,0,0.22) 0%, transparent 65%)' }}
          />
          {/* 吉祥物水印：右下角半透明剪影，收小避让能力面板 */}
          <img
            src="/static/login-mascot.png"
            alt=""
            draggable={false}
            className="login-mascot-watermark pointer-events-none absolute -bottom-12 -right-12 h-64 w-64 opacity-[0.07]"
          />
          {/* 星点：错峰闪烁，打破暗背景的静 */}
          {[
            { top: '14%', left: '30%', size: 'h-1.5 w-1.5', delay: '0s', opacity: 0.7 },
            { top: '9%', left: '58%', size: 'h-1 w-1', delay: '1.3s', opacity: 0.5 },
            { top: '46%', left: '84%', size: 'h-1.5 w-1.5', delay: '0.7s', opacity: 0.6 },
            { top: '72%', left: '88%', size: 'h-1 w-1', delay: '1.9s', opacity: 0.45 },
          ].map(s => (
            <span
              key={`${s.top}-${s.left}`}
              className={`login-sparkle pointer-events-none absolute ${s.size} animate-pulse rounded-full bg-[#ffe566]`}
              style={{ top: s.top, left: s.left, opacity: s.opacity, animationDelay: s.delay }}
            />
          ))}
          {/* 金色接缝：与右侧表单的分界线，一缕流光周期性下行 */}
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-[2px] overflow-hidden bg-gradient-to-b from-transparent via-[#ffe566]/40 to-transparent"
            style={{ boxShadow: '0 0 14px 1px rgba(255,229,102,0.28)' }}
          >
            <div className="login-seam-light absolute inset-x-0 h-[16%] bg-gradient-to-b from-transparent via-[#ffe566] to-transparent blur-[1px]" />
          </div>
          {/* 封面主视觉：小黄鱼吉祥物，缓慢游动，悬停弹跳 */}
          <div className="login-hero-layer absolute right-8 top-12">
            <img
              src="/static/login-mascot.png"
              alt="闲鱼吉祥物"
              draggable={false}
              className="login-hero h-40 w-40 drop-shadow-[0_16px_36px_rgba(255,213,0,0.4)]"
              onMouseEnter={e => gsap.to(e.currentTarget, { scale: 1.1, duration: 0.35, ease: 'back.out(2)' })}
              onMouseLeave={e => gsap.to(e.currentTarget, { scale: 1, duration: 0.3, ease: 'power2.out' })}
            />
          </div>
          {/* 小吉祥物：主视觉与中部文字之间的空档游动，与主视觉形成"大小鱼同游"的层次 */}
          <div className="login-floaty-layer absolute right-32 top-56">
            <img
              src="/static/login-mascot.png"
              alt=""
              draggable={false}
              className="login-floaty h-9 w-9 opacity-50"
              onMouseEnter={e => gsap.to(e.currentTarget, { scale: 1.4, duration: 0.35, ease: 'back.out(2)' })}
              onMouseLeave={e => gsap.to(e.currentTarget, { scale: 1, duration: 0.3, ease: 'power2.out' })}
            />
          </div>

          <div className="login-cover-content relative flex h-full flex-col p-12">
            {/* 顶栏：品牌 logo + 双行字标。替代原悬浮大 logo，避免与主视觉鱼形成双焦点 */}
            <div
              className="login-cover-logo-wrap relative flex items-center gap-3.5"
              onMouseEnter={e => {
                const logo = e.currentTarget.querySelector('.login-cover-logo');
                if (logo) gsap.to(logo, { keyframes: { rotation: [0, -8, 6, -3, 0] }, duration: 0.7, ease: 'power2.out' });
              }}
            >
              <span className="relative">
                <span
                  className="login-logo-glow absolute -inset-3 rounded-2xl"
                  style={{ background: 'radial-gradient(circle, rgba(255,229,0,0.35) 0%, transparent 65%)' }}
                />
                <img
                  src="/static/login-cover.png"
                  alt="闲鱼超级管家"
                  className="login-cover-logo relative h-12 w-12"
                  draggable={false}
                />
              </span>
              <span className="leading-none">
                <span className="block text-[15px] font-extrabold tracking-wide text-white">闲鱼超级管家</span>
                <span className="mt-1.5 block text-[9.5px] font-bold tracking-[0.3em] text-[#ffe566]/70">XIANYU SUPER BUTLER</span>
              </span>
            </div>

            {/* 主体：单一内容流垂直居中，眉标-标题-口号-能力面板一气呵成，消灭 justify-between 的死区 */}
            <div className="my-auto max-w-xl pb-8">
              <span className="login-eyebrow inline-flex items-center gap-2 rounded-full border border-[#ffe566]/25 bg-[#ffe566]/10 px-3.5 py-1.5 text-[11px] font-bold tracking-[0.18em] text-[#ffe566]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ffe566]" />
                闲鱼卖家的一体化运营工作台
              </span>
              <h1
                className="login-title mt-5 text-6xl font-extrabold leading-tight text-transparent drop-shadow-[0_4px_24px_rgba(255,213,0,0.2)]"
                aria-label="闲鱼超级管家"
                style={{
                  backgroundImage: 'linear-gradient(110deg, transparent 38%, rgba(255,244,190,0.95) 50%, transparent 62%), linear-gradient(to bottom, #ffffff 20%, #ffedb0 100%)',
                  backgroundSize: '260% 100%, 100% 100%',
                  backgroundPosition: '100% 0%, 0% 0%',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                }}
              >
                {'闲鱼超级管家'.split('').map((ch, i) => (
                  <span key={i} className="login-title-char inline-block">{ch}</span>
                ))}
              </h1>
              <p className="login-slogan mt-5 max-w-lg text-[15px] leading-8 text-white/65">
                统一处理账号、商品、订单、消息、回复和自动发货，让每一笔闲鱼生意自动运转。
              </p>

              {/* 功能条：等宽四列网格，列间发丝竖线，整条与标题同宽 */}
              <div className="mt-10 border-t border-white/[0.06] pt-7">
                <div className="mb-4 flex items-center gap-2 text-[10px] font-bold tracking-[0.25em] text-white/30">
                  <span className="h-px w-4 bg-white/25" />
                  核心能力
                </div>
                <div className="grid grid-cols-4 divide-x divide-white/[0.07]">
                  {[
                    { icon: Users, label: '账号同步', sub: '多号托管' },
                    { icon: Package, label: '订单发货', sub: '卡密自动' },
                    { icon: MessageCircle, label: '消息回复', sub: '智能应答' },
                    { icon: Bell, label: '通知日志', sub: '风险提醒' },
                  ].map(({ icon: Icon, label, sub }) => (
                    <div key={label} className="login-chip group flex items-start gap-2.5 px-4">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ffe566]/10 text-[#ffe566] ring-1 ring-inset ring-[#ffe566]/20">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="leading-tight">
                        <span className="block text-[13px] font-bold text-white/80 transition-colors duration-300 group-hover:text-white">{label}</span>
                        <span className="mt-1 block text-[11px] font-medium text-white/40">{sub}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* 右侧登录/注册表单 */}
        <main className="relative flex min-h-screen flex-1 flex-col">
          <ThemeToggle compact className="absolute right-5 top-5 z-10" />
          {/* 顶部品牌色微光：呼应左侧封面，弱化纯色底的平板感 */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-64"
            style={{ background: 'radial-gradient(ellipse 70% 60% at 50% -10%, rgba(255,213,0,0.05), transparent 70%)' }}
          />
          <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
            <div className="login-form-card w-full max-w-sm animate-fade-in">
              <div className="login-brand mb-6 flex items-center gap-2.5">
                <img src="/static/login-cover.png" alt="闲鱼超级管家" className="h-8 w-8" draggable={false} />
                <span className="text-sm font-extrabold text-[var(--text)]">闲鱼超级管家</span>
              </div>
              <div className="login-form-header mb-8">
                <h2 className="text-2xl font-extrabold text-[var(--text)]">
                  {authMode === 'login' ? '登录管理后台' : '注册新账号'}
                </h2>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  {authMode === 'login' ? '使用管理员账号进入工作台' : '创建账号后即可登录工作台'}
                </p>
              </div>

                {authMode === 'login' && (
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-4">
                      <label className="login-field block">
                          <span className="mb-1.5 block text-xs font-bold text-[var(--text-muted)]">管理员账号</span>
                          <div className="relative group">
                            <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-soft)] group-focus-within:text-[var(--text)]" />
                            <input
                                type="text"
                                placeholder="请输入账号"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                autoComplete="username"
                                required
                                className="ios-input h-11 w-full rounded-md py-2.5 pl-10 pr-4 text-sm"
                            />
                          </div>
                      </label>
                      <label className="login-field block">
                          <span className="mb-1.5 block text-xs font-bold text-[var(--text-muted)]">密码</span>
                          <div className="relative group">
                            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-soft)] group-focus-within:text-[var(--text)]" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="请输入密码"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                autoComplete="current-password"
                                required
                                className="ios-input h-11 w-full rounded-md py-2.5 pl-10 pr-11 text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(v => !v)}
                                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)] transition-colors hover:text-[var(--text)]"
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                      </label>
                      {loginCaptcha.required && (
                          <CaptchaInput
                              image={loginCaptcha.image}
                              code={loginCaptcha.code}
                              onCodeChange={loginCaptcha.setCode}
                              onRefresh={() => void loginCaptcha.refresh()}
                          />
                      )}
                  </div>

                  {loginNotice && (
                      <div role="status" className="flex animate-fade-in items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-700">
                          <CheckCircle2 className="h-4 w-4 shrink-0" /> {loginNotice}
                      </div>
                  )}

                  {loginError && (
                      <div role="alert" className="flex animate-fade-in items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                          <ShieldCheck className="h-4 w-4 shrink-0" /> {loginError}
                      </div>
                  )}

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="ios-btn-primary login-submit flex h-11 w-full items-center justify-center gap-2 rounded-md text-sm disabled:opacity-70"
                  >
                    {loginLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>登录 <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </form>
                )}

                {authMode === 'register' && (
                <form onSubmit={handleRegister} className="space-y-5">
                  <div className="space-y-4">
                      <label className="login-field block">
                          <span className="mb-1.5 block text-xs font-bold text-[var(--text-muted)]">账号</span>
                          <div className="relative group">
                            <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-soft)] group-focus-within:text-[var(--text)]" />
                            <input
                                type="text"
                                placeholder="设置登录账号"
                                value={regForm.username}
                                onChange={e => setRegForm({ ...regForm, username: e.target.value })}
                                autoComplete="username"
                                required
                                className="ios-input h-11 w-full rounded-md py-2.5 pl-10 pr-4 text-sm"
                            />
                          </div>
                      </label>
                      <label className="login-field block">
                          <span className="mb-1.5 block text-xs font-bold text-[var(--text-muted)]">邮箱</span>
                          <div className="relative group">
                            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-soft)] group-focus-within:text-[var(--text)]" />
                            <input
                                type="email"
                                placeholder="用于找回账号"
                                value={regForm.email}
                                onChange={e => setRegForm({ ...regForm, email: e.target.value })}
                                autoComplete="email"
                                required
                                className="ios-input h-11 w-full rounded-md py-2.5 pl-10 pr-4 text-sm"
                            />
                          </div>
                      </label>
                      <label className="login-field block">
                          <span className="mb-1.5 block text-xs font-bold text-[var(--text-muted)]">密码</span>
                          <div className="relative group">
                            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-soft)] group-focus-within:text-[var(--text)]" />
                            <input
                                type={showRegPassword ? 'text' : 'password'}
                                placeholder="至少 8 位，含字母和数字"
                                value={regForm.password}
                                onChange={e => setRegForm({ ...regForm, password: e.target.value })}
                                autoComplete="new-password"
                                required
                                className="ios-input h-11 w-full rounded-md py-2.5 pl-10 pr-11 text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowRegPassword(v => !v)}
                                aria-label={showRegPassword ? '隐藏密码' : '显示密码'}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)] transition-colors hover:text-[var(--text)]"
                            >
                                {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                      </label>
                      {needEmailCode && (
                      <>
                      <CaptchaInput
                          image={regCaptcha.image}
                          code={regCaptcha.code}
                          onCodeChange={regCaptcha.setCode}
                          onRefresh={() => void regCaptcha.refresh()}
                      />
                      <label className="login-field block">
                          <span className="mb-1.5 block text-xs font-bold text-[var(--text-muted)]">邮箱验证码</span>
                          <div className="flex gap-2">
                            <div className="relative group flex-1">
                              <KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-soft)] group-focus-within:text-[var(--text)]" />
                              <input
                                  type="text"
                                  placeholder="请输入验证码"
                                  value={regForm.code}
                                  onChange={e => setRegForm({ ...regForm, code: e.target.value })}
                                  className="ios-input h-11 w-full rounded-md py-2.5 pl-10 pr-4 text-sm"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleSendCode()}
                              disabled={codeSending || codeCountdown > 0}
                              className="ios-btn-secondary h-11 shrink-0 rounded-md px-3 text-xs font-bold disabled:opacity-60"
                            >
                              {codeCountdown > 0 ? `${codeCountdown}s` : codeSending ? '发送中' : '获取验证码'}
                            </button>
                          </div>
                      </label>
                      </>
                      )}
                  </div>

                  {regNotice && (
                      <div role="status" className="flex animate-fade-in items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-700">
                          <CheckCircle2 className="h-4 w-4 shrink-0" /> {regNotice}
                      </div>
                  )}

                  {regError && (
                      <div role="alert" className="flex animate-fade-in items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                          <ShieldCheck className="h-4 w-4 shrink-0" /> {regError}
                      </div>
                  )}

                  <button
                    type="submit"
                    disabled={regLoading}
                    className="ios-btn-primary login-submit flex h-11 w-full items-center justify-center gap-2 rounded-md text-sm disabled:opacity-70"
                  >
                    {regLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>注册 <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </form>
                )}

                {allowRegister && (
                  <div className="mt-5 text-center text-xs text-[var(--text-muted)]">
                    {authMode === 'login' ? (
                      <>还没有账号？
                        <button
                          type="button"
                          onClick={() => { setAuthMode('register'); setLoginError(''); setLoginNotice(''); }}
                          className="ml-1 font-bold text-[var(--brand-text)] hover:underline"
                        >
                          注册新账号
                        </button>
                      </>
                    ) : (
                      <>已有账号？
                        <button
                          type="button"
                          onClick={() => { setAuthMode('login'); setRegError(''); setRegNotice(''); }}
                          className="ml-1 font-bold text-[var(--brand-text)] hover:underline"
                        >
                          返回登录
                        </button>
                      </>
                    )}
                  </div>
                )}

                <div className="login-extras mt-8 grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-6">
                  {[
                    { icon: Zap, label: '自动发货' },
                    { icon: MessageCircle, label: '智能回复' },
                    { icon: Users, label: '多号托管' },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex flex-col items-center gap-1.5">
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-50)] text-[var(--brand-text)]"
                        style={{ border: '1px solid var(--border-brand)' }}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="text-[11px] font-bold text-[var(--text-muted)]">{label}</span>
                    </div>
                  ))}
                </div>
                <p className="login-trust mt-4 flex items-center justify-center gap-1.5 text-[11px] font-medium text-[var(--text-soft)]">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  本机部署 · 数据本地存储
                </p>
                <p className="mt-4 text-center text-[11px] text-[var(--text-soft)]">
                  闲鱼超级管家 · xy.corleom.com
                </p>
              </div>
            </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--app-bg)] text-[var(--text)]">
      <GlobalFeedback />
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setMobileMenuOpen(false);
        }}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        isAdmin={isAdmin}
        onLogout={() => {
            localStorage.removeItem('auth_token');
            setIsAdmin(false);
            setIsLoggedIn(false);
        }} 
      />
      
      <main className="min-h-screen min-w-0 flex-1 overflow-y-auto lg:ml-[248px]">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 -ml-2 rounded-md hover:bg-gray-100"
            title="打开导航"
            aria-label="打开导航"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{pageLabels[activeTab] || '闲鱼超级管家'}</p>
            <p className="text-[11px] text-gray-400">闲鱼超级管家</p>
          </div>
          <ThemeToggle compact className="ml-auto" />
        </header>
        {activeTab !== 'messages' && <AnnouncementBanner />}
        <div className={
          activeTab === 'messages'
            ? 'h-[calc(100vh-3.5rem)] lg:h-screen overflow-hidden'
            : 'mx-auto max-w-[1320px] p-4 pb-10 sm:p-6 lg:p-8'
        }>
          <section hidden={activeTab !== 'dashboard'}>
            <Suspense fallback={activeTab === 'dashboard' ? <PageLoader /> : null}><Dashboard /></Suspense>
          </section>
          <section hidden={activeTab !== 'accounts'}>
            <Suspense fallback={activeTab === 'accounts' ? <PageLoader /> : null}><AccountList /></Suspense>
          </section>
          <section hidden={activeTab !== 'items'}>
            <Suspense fallback={activeTab === 'items' ? <PageLoader /> : null}><ItemList /></Suspense>
          </section>
          <section hidden={activeTab !== 'product-automation'}>
            <Suspense fallback={activeTab === 'product-automation' ? <PageLoader /> : null}><ProductAutomation /></Suspense>
          </section>
          <section hidden={activeTab !== 'orders'}>
            <Suspense fallback={activeTab === 'orders' ? <PageLoader /> : null}><OrderList /></Suspense>
          </section>
          <section hidden={activeTab !== 'cards'}>
            <Suspense fallback={activeTab === 'cards' ? <PageLoader /> : null}><CardList /></Suspense>
          </section>
          <section hidden={activeTab !== 'auto-reply'}>
            <Suspense fallback={activeTab === 'auto-reply' ? <PageLoader /> : null}><Keywords mode="reply" /></Suspense>
          </section>
          <section hidden={activeTab !== 'ai-reply'}>
            <Suspense fallback={activeTab === 'ai-reply' ? <PageLoader /> : null}><AIReply /></Suspense>
          </section>
          <section hidden={activeTab !== 'messages'} className="h-full min-h-0">
            <Suspense fallback={activeTab === 'messages' ? <PageLoader /> : null}>
              <MessageManagement isActive={activeTab === 'messages'} />
            </Suspense>
          </section>
          <section hidden={activeTab !== 'notifications'}>
            <Suspense fallback={activeTab === 'notifications' ? <PageLoader /> : null}>
              <NotificationsAndLogs isAdmin={isAdmin} />
            </Suspense>
          </section>
          {isAdmin && (
            <section hidden={activeTab !== 'users'}>
              <Suspense fallback={activeTab === 'users' ? <PageLoader /> : null}><UserManagement /></Suspense>
            </section>
          )}
          {/* 系统设置页面含 SMTP/注册开关等系统级配置，普通用户不挂载（后端接口同样只放行业务白名单） */}
          {isAdmin && (
            <section hidden={activeTab !== 'settings'}>
              <Suspense fallback={activeTab === 'settings' ? <PageLoader /> : null}><Settings /></Suspense>
            </section>
          )}
          <section hidden={activeTab !== 'buyer-interaction'}>
            <Suspense fallback={activeTab === 'buyer-interaction' ? <PageLoader /> : null}><BuyerInteraction /></Suspense>
          </section>
          <section hidden={activeTab !== 'about'}>
            <Suspense fallback={activeTab === 'about' ? <PageLoader /> : null}><About /></Suspense>
          </section>
        </div>
      </main>
    </div>
  );
};

export default App;
