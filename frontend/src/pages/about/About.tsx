import { useCallback, useEffect, useState, useRef } from 'react'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Bug,
  ChevronDown,
  ChevronUp,
  Clock,
  Code,
  Database,
  Download,
  FileText,
  Filter,
  Info,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Search,
  Server,
  Trash2,
  Zap,
  X
} from 'lucide-react'
import { getRealtimeLogs, getLogStats, clearRealtimeLogs, type RealtimeLogEntry } from '@/api/admin'
import { useUIStore } from '@/store/uiStore'
import { cn } from '@/utils/cn'

const limitOptions = [
  { value: 50, label: '50 条' },
  { value: 100, label: '100 条' },
  { value: 200, label: '200 条' },
  { value: 500, label: '500 条' },
  { value: 1000, label: '1000 条' },
]

const levelOptions = [
  { value: '', label: '全部级别', color: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' },
  { value: 'DEBUG', label: '调试', color: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' },
  { value: 'INFO', label: '信息', color: 'bg-blue-100 dark:bg-blue-700 text-blue-600 dark:text-blue-300' },
  { value: 'WARNING', label: '警告', color: 'bg-amber-100 dark:bg-amber-700 text-amber-600 dark:text-amber-300' },
  { value: 'ERROR', label: '错误', color: 'bg-red-100 dark:bg-red-700 text-red-600 dark:text-red-300' },
  { value: 'CRITICAL', label: '严重', color: 'bg-purple-100 dark:bg-purple-700 text-purple-600 dark:text-purple-300' },
]

const autoRefreshIntervals = [
  { value: 0, label: '关闭' },
  { value: 1000, label: '1 秒' },
  { value: 3000, label: '3 秒' },
  { value: 5000, label: '5 秒' },
  { value: 10000, label: '10 秒' },
]

export function About() {
  const { addToast } = useUIStore()
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<RealtimeLogEntry[]>([])
  const [stats, setStats] = useState<{ total_logs: number; level_counts: Record<string, number>; source_counts: Record<string, number>; max_capacity: number; log_file: string } | null>(null)
  const [levelFilter, setLevelFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [limit, setLimit] = useState(200)
  const [autoRefresh, setAutoRefresh] = useState(3000)
  const [isPaused, setIsPaused] = useState(false)
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())

  // 滚动到底部
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // 加载日志数据
  const loadLogs = useCallback(async () => {
    if (isPaused) return
    try {
      setLoading(true)
      const [logsResult, statsResult] = await Promise.all([
        getRealtimeLogs({ lines: limit, level: levelFilter || undefined, source: sourceFilter || undefined }),
        getLogStats()
      ])

      if (logsResult.success) {
        setLogs(logsResult.data || [])
      }
      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data)
      }
    } catch (error) {
      console.error('加载日志失败:', error)
    } finally {
      setLoading(false)
    }
  }, [limit, levelFilter, sourceFilter, isPaused])

  // 自动刷新
  useEffect(() => {
    if (autoRefresh === 0) return

    const interval = setInterval(() => {
      if (!isPaused) {
        loadLogs()
      }
    }, autoRefresh)

    return () => clearInterval(interval)
  }, [autoRefresh, isPaused, loadLogs])

  // 初始加载
  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  // 过滤日志
  const filteredLogs = logs.filter(log => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        log.message.toLowerCase().includes(query) ||
        log.source.toLowerCase().includes(query) ||
        log.function.toLowerCase().includes(query)
      )
    }
    return true
  })

  // 清空日志
  const handleClear = async () => {
    if (!confirm('确定要清空所有日志吗？此操作不可恢复！')) return
    try {
      await clearRealtimeLogs()
      addToast({ type: 'success', message: '日志已清空' })
      loadLogs()
    } catch {
      addToast({ type: 'error', message: '清空失败' })
    }
  }

  // 导出日志
  const handleExport = () => {
    const logContent = logs.map(log => {
      const timestamp = new Date(log.timestamp).toLocaleString()
      return `[${timestamp}] [${log.level}] [${log.source}:${log.function}:${log.line}] ${log.message}`
    }).join('\n')

    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `goofish_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.log`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    addToast({ type: 'success', message: '日志已导出' })
  }

  // 获取日志级别图标
  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'ERROR':
      case 'CRITICAL':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'WARNING':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />
      case 'DEBUG':
        return <Bug className="w-4 h-4 text-gray-500" />
      default:
        return <Info className="w-4 h-4 text-blue-500" />
    }
  }

  // 获取日志级别徽章
  const getLevelBadge = (level: string) => {
    const option = levelOptions.find(opt => opt.value === level)
    if (!option) return null
    return <span className={cn('px-2 py-0.5 rounded text-xs font-medium', option.color)}>{option.label}</span>
  }

  // 切换日志展开
  const toggleExpand = (timestamp: string) => {
    const newExpanded = new Set(expandedLogs)
    if (newExpanded.has(timestamp)) {
      newExpanded.delete(timestamp)
    } else {
      newExpanded.add(timestamp)
    }
    setExpandedLogs(newExpanded)
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      {/* Header */}
      <div className="page-header flex-between flex-wrap gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-500" />
            Goofish 网络数据日志
          </h1>
          <p className="page-description">实时查看来自 Goofish (闲鱼) 网络的统一信息交互数据</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="btn-ios-primary"
            title="导出日志到本地文件"
          >
            <Download className="w-4 h-4" />
            导出
          </button>
          <button onClick={handleClear} className="btn-ios-danger" title="清空所有日志">
            <Trash2 className="w-4 h-4" />
            清空
          </button>
          <button
            onClick={() => {
              setIsPaused(!isPaused)
              addToast({ type: 'info', message: isPaused ? '已恢复自动刷新' : '已暂停自动刷新' })
            }}
            className={cn('btn-ios-secondary', isPaused && 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300')}
            title={isPaused ? '恢复自动刷新' : '暂停自动刷新'}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            {isPaused ? '恢复' : '暂停'}
          </button>
          <button onClick={loadLogs} className="btn-ios-secondary" title="立即刷新">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            刷新
          </button>
        </div>
      </div>

      {/* 统计信息卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="vben-card">
            <div className="vben-card-body">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Database className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">总日志数</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{stats.total_logs.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {Object.entries(stats.level_counts).slice(0, 4).map(([level, count]) => {
            const option = levelOptions.find(opt => opt.value === level)
            return (
              <div key={level} className="vben-card">
                <div className="vben-card-body">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', option?.color)}>
                      {getLevelIcon(level)}
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{option?.label || level}</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{count.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          <div className="vben-card">
            <div className="vben-card-body">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Server className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">日志源</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{Object.keys(stats.source_counts || {}).length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 过滤器和控制 */}
      <div className="vben-card">
        <div className="vben-card-body">
          <div className="flex flex-wrap items-center gap-4">
            {/* 搜索框 */}
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="搜索日志内容、来源、函数..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* 日志级别过滤 */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-0 focus:ring-2 focus:ring-blue-500"
              >
                {levelOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* 来源过滤 */}
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-slate-400" />
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-0 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部来源</option>
                {stats && Object.keys(stats.source_counts || {}).map(source => (
                  <option key={source} value={source}>{source} ({stats.source_counts[source]})</option>
                ))}
              </select>
            </div>

            {/* 显示条数 */}
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-0 focus:ring-2 focus:ring-blue-500"
              >
                {limitOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* 自动刷新间隔 */}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <select
                value={autoRefresh}
                onChange={(e) => setAutoRefresh(Number(e.target.value))}
                className="px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-0 focus:ring-2 focus:ring-blue-500"
              >
                {autoRefreshIntervals.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* 自动滚动 */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={cn(
                'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                autoScroll
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              )}
              title={autoScroll ? '自动滚动已启用' : '自动滚动已禁用'}
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* 过滤结果统计 */}
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span>显示 {filteredLogs.length} 条 / 共 {logs.length} 条</span>
            {searchQuery && (
              <span className="text-blue-500">搜索: "{searchQuery}"</span>
            )}
            {levelFilter && (
              <span className="text-blue-500">级别: {levelOptions.find(opt => opt.value === levelFilter)?.label}</span>
            )}
            {sourceFilter && (
              <span className="text-blue-500">来源: {sourceFilter}</span>
            )}
            {isPaused && (
              <span className="flex items-center gap-1 text-amber-500">
                <Pause className="w-3 h-3" />
                已暂停
              </span>
            )}
            {autoRefresh > 0 && !isPaused && (
              <span className="flex items-center gap-1 text-green-500">
                <Zap className="w-3 h-3" />
                {autoRefresh / 1000}秒刷新
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 日志列表 */}
      <div className="vben-card">
        <div className="vben-card-header">
          <h2 className="vben-card-title flex items-center gap-2">
            <Activity className="w-4 h-4" />
            日志流
          </h2>
          <span className="badge-primary">{filteredLogs.length} 条记录</span>
        </div>
        <div
          ref={scrollRef}
          className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[600px] overflow-y-auto font-mono text-xs"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p>暂无日志记录</p>
              {loading && <Loader2 className="w-6 h-6 animate-spin mx-auto mt-4" />}
            </div>
          ) : (
            filteredLogs.map((log, index) => {
              const timestamp = log.timestamp
              const isExpanded = expandedLogs.has(timestamp)
              const needsTruncation = log.message.length > 200

              return (
                <div
                  key={`${timestamp}-${index}`}
                  className={cn(
                    'px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer',
                    log.level === 'ERROR' && 'bg-red-50/50 dark:bg-red-900/10',
                    log.level === 'WARNING' && 'bg-amber-50/50 dark:bg-amber-900/10'
                  )}
                  onClick={() => needsTruncation && toggleExpand(timestamp)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">{getLevelIcon(log.level)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {getLevelBadge(log.level)}
                        <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                          {log.source}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {log.function}:{log.line}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {new Date(timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p
                        className={cn(
                          'text-sm text-slate-700 dark:text-slate-300 break-all whitespace-pre-wrap',
                          !isExpanded && needsTruncation && 'line-clamp-2'
                        )}
                      >
                        {log.message}
                      </p>
                      {needsTruncation && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleExpand(timestamp)
                          }}
                          className="mt-1 flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3 h-3" />
                              收起
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" />
                              展开 ({log.message.length} 字符)
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 日志来源统计 */}
      {stats && stats.source_counts && Object.keys(stats.source_counts).length > 0 && (
        <div className="vben-card">
          <div className="vben-card-header">
            <h2 className="vben-card-title flex items-center gap-2">
              <Server className="w-4 h-4" />
              日志来源统计
            </h2>
          </div>
          <div className="vben-card-body">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(stats.source_counts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 12)
                .map(([source, count]) => (
                  <div
                    key={source}
                    className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    onClick={() => setSourceFilter(source === sourceFilter ? '' : source)}
                  >
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate" title={source}>
                      {source}
                    </span>
                    <span className={cn(
                      'px-2 py-1 rounded text-xs font-medium',
                      sourceFilter === source
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    )}>
                      {count}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
