/** Native dockable calendar: lunar month grid and agenda. */
import { useQuery } from '@hermes/plugin-sdk'
import { useMemo, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
const ID = 'calendar-pane',
  accent = 'var(--ui-accent)',
  muted = 'var(--ui-text-quaternary)',
  text = 'var(--ui-text-secondary)',
  stroke = 'var(--ui-stroke-secondary)'
const tint = 'color-mix(in srgb, var(--ui-accent) 12%, transparent)'
const btn =
  'rounded px-2 py-1 text-xs hover:bg-(--chrome-action-hover) focus-visible:outline focus-visible:outline-1'
const weekdays = ['一', '二', '三', '四', '五', '六', '日']
function key(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function date(k) {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}
function plus(k, n) {
  const d = date(k)
  d.setDate(d.getDate() + n)
  return key(d)
}
function monthOf(k) {
  return k.slice(0, 7) + '-01'
}
function move(k, n) {
  const d = date(k)
  return key(new Date(d.getFullYear(), d.getMonth() + n, 1, 12))
}
function grid(k) {
  const f = monthOf(k),
    s = plus(f, -((date(f).getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, i) => plus(s, i))
}
let lunar
try {
  lunar = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month: 'long', day: 'numeric' })
} catch {
  /* optional ICU */
}
const lunarDays =
  '初一 初二 初三 初四 初五 初六 初七 初八 初九 初十 十一 十二 十三 十四 十五 十六 十七 十八 十九 二十 廿一 廿二 廿三 廿四 廿五 廿六 廿七 廿八 廿九 三十'.split(
    ' ',
  )
function lunarLabel(k) {
  if (!lunar) return ''
  const p = lunar.formatToParts(date(k)),
    m = p.find((v) => v.type === 'month')?.value,
    d = Number(p.find((v) => v.type === 'day')?.value)
  const festivals = {
    '正月-1': '春节',
    '正月-15': '元宵节',
    '五月-5': '端午节',
    '七月-7': '七夕',
    '八月-15': '中秋节',
    '九月-9': '重阳节',
    '腊月-8': '腊八节',
  }
  return festivals[`${m}-${d}`] || (d === 1 ? m : lunarDays[d - 1]) || ''
}
function onDay(items, k) {
  return items
    .filter((e) => {
      const s = (e.start || '').slice(0, 10),
        end = (e.end || e.start || '').slice(0, 10)
      if (e.all_day) return s <= k && k < (end || plus(s, 1))
      const last = /T00:00(?::00)?(?:[+-]|Z)/.test(e.end || '') ? plus(end, -1) : end
      return s <= k && k <= (last || s)
    })
    .sort((a, b) => Number(b.all_day) - Number(a.all_day) || a.start.localeCompare(b.start))
}
function time(e) {
  return e.all_day ? '全天' : `${(e.start || '').slice(11, 16)}–${(e.end || '').slice(11, 16)}`
}
function label(k, today) {
  const d = date(k)
  return `${k === today ? '今天' : k === plus(today, 1) ? '明天' : `${d.getMonth() + 1}月${d.getDate()}日`} · 周${weekdays[(d.getDay() + 6) % 7]}`
}
function Note({ children }) {
  return jsx('div', { style: { fontSize: 11, color: muted, padding: '10px 2px', lineHeight: 1.6 }, children })
}
function DayRow({ day, today, items }) {
  return jsxs('section', {
    style: { display: 'flex', flexDirection: 'column', gap: 6 },
    children: [
      jsx('div', { style: { fontSize: 11, color: muted }, children: label(day, today) }),
      ...items.map((e) =>
        jsxs(
          'div',
          {
            className: 'rounded py-1 hover:bg-(--chrome-action-hover)',
            style: { display: 'flex', gap: 8, alignItems: 'baseline' },
            title: [e.summary, time(e), e.location].filter(Boolean).join(' · '),
            children: [
              jsx('span', {
                style: {
                  fontSize: 10,
                  color: e.all_day ? accent : muted,
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                },
                children: time(e),
              }),
              jsx('span', {
                style: { fontSize: 12, color: text, minWidth: 0, overflowWrap: 'anywhere' },
                children: e.summary,
              }),
            ],
          },
          e.id || `${e.start}-${e.summary}`,
        ),
      ),
    ],
  })
}
function DayCell({ day, month, today, selected, items, select }) {
  const current = day === today,
    chosen = day === selected
  return jsxs('button', {
    type: 'button',
    className: 'hover:bg-(--chrome-action-hover) focus-visible:outline focus-visible:outline-1',
    'data-calendar-date': day,
    'aria-current': current ? 'date' : undefined,
    'aria-pressed': chosen,
    'aria-label': `${day}${current ? ' 今天' : ''} ${lunarLabel(day)}${items.length ? `，${items.length} 项安排` : ''}`,
    title: [day, lunarLabel(day), ...items.map((e) => `${time(e)} ${e.summary}`)].join('\n'),
    onClick: () => select(day),
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      width: '100%',
      minWidth: 0,
      aspectRatio: '1 / 1',
      minHeight: 40,
      padding: '3px 0',
      borderRadius: '8px',
      border: `1px solid ${current ? accent : chosen ? stroke : 'transparent'}`,
      background: current || chosen ? tint : undefined,
      color: current ? accent : text,
      opacity: day.slice(0, 7) === month.slice(0, 7) ? 1 : 0.4,
      cursor: 'pointer',
    },
    children: [
      jsx('span', {
        style: { fontSize: 13, fontWeight: current ? 650 : 450, lineHeight: 1.2 },
        children: Number(day.slice(8)),
      }),
      jsx('span', {
        'data-lunar': true,
        style: { fontSize: 9, lineHeight: 1.3, whiteSpace: 'nowrap' },
        children: lunarLabel(day),
      }),
      jsx('span', {
        'aria-hidden': true,
        style: { width: 4, height: 3, borderRadius: 1, background: items.length ? accent : 'transparent' },
      }),
    ],
  })
}
function MonthView({ month, setMonth, selected, setSelected, today, data, loading, error }) {
  const days = useMemo(() => grid(month), [month]),
    items = data?.items || [],
    selectedItems = onDay(items, selected),
    d = date(month)
  const covered =
    data?.start && data?.end && selected > data.start.slice(0, 10) && selected < data.end.slice(0, 10)
  const nav = (n) => {
      const k = move(month, n)
      setMonth(k)
      setSelected(k)
    },
    select = (k) => {
      setSelected(k)
      if (monthOf(k) !== month) setMonth(monthOf(k))
    }
  return jsxs('div', {
    children: [
      jsxs('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 0 12px',
        },
        children: [
          jsx('strong', {
            'data-month-label': true,
            style: { fontSize: 14, fontWeight: 550 },
            children: `${d.getFullYear()}年${d.getMonth() + 1}月`,
          }),
          jsxs('div', {
            style: { display: 'flex' },
            children: [
              jsx('button', {
                type: 'button',
                className: btn,
                'aria-label': '上个月',
                onClick: () => nav(-1),
                children: '‹',
              }),
              jsx('button', {
                type: 'button',
                className: btn,
                'aria-label': '回到今天',
                onClick: () => {
                  setMonth(monthOf(today))
                  setSelected(today)
                },
                children: '今天',
              }),
              jsx('button', {
                type: 'button',
                className: btn,
                'aria-label': '下个月',
                onClick: () => nav(1),
                children: '›',
              }),
            ],
          }),
        ],
      }),
      jsx('div', {
        style: { display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 2, paddingBottom: 6 },
        children: weekdays.map((w) =>
          jsx('div', { style: { textAlign: 'center', fontSize: 10, color: muted }, children: w }, w),
        ),
      }),
      jsx('div', {
        role: 'group',
        'aria-label': '月历日期',
        style: { display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 2 },
        children: days.map((day) =>
          jsx(DayCell, { day, month, today, selected, items: onDay(items, day), select }, day),
        ),
      }),
      jsx('div', {
        style: { marginTop: 12, paddingTop: 12, borderTop: `1px solid ${stroke}` },
        children: loading
          ? jsx(Note, { children: '正在同步日程…' })
          : error
            ? jsx(Note, { children: '日程同步失败，月历仍可浏览；请刷新重试。' })
            : selectedItems.length
              ? jsx(DayRow, { day: selected, today, items: selectedItems })
              : jsx(Note, {
                  children: `${label(selected, today)} · ${covered ? '没有安排' : '该日期尚未完整同步'}`,
                }),
      }),
      jsx('div', {
        style: { fontSize: 9, lineHeight: 1.6, color: muted, padding: '8px 2px' },
        children: '日期下方短标记表示有日程 · 同步今天起约 120 天；更早日期不显示历史日程。',
      }),
    ],
  })
}
function CalendarPane({ rest, storage }) {
  const today = key(new Date()),
    [mode, setMode] = useState(() => (storage?.get('viewMode', 'month') === 'agenda' ? 'agenda' : 'month')),
    [month, setMonth] = useState(() => monthOf(today)),
    [selected, setSelected] = useState(today)
  const q = useQuery({
    queryKey: [ID, 'agenda', 120, today],
    queryFn: async () => {
      const r = await rest('/agenda?days=120', { timeoutMs: 100000 })
      if (!r || r.error) throw new Error(r?.error || '日历返回了空响应')
      return r
    },
    staleTime: 120000,
    refetchInterval: 300000,
    retry: false,
  })
  const items = q.data?.items || [],
    groups = useMemo(
      () =>
        Array.from({ length: 14 }, (_, i) => {
          const d = plus(today, i)
          return [d, onDay(items, d)]
        }).filter(([, v]) => v.length),
      [items, today],
    ),
    choose = (m) => {
      setMode(m)
      storage?.set('viewMode', m)
    },
    error = q.error ? String(q.error.message || q.error) : ''
  return jsxs('div', {
    style: { height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', color: text },
    children: [
      jsxs('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 4,
          padding: '8px 10px',
          flexShrink: 0,
          borderBottom: `1px solid ${stroke}`,
        },
        children: [
          jsx('div', {
            role: 'group',
            'aria-label': '日历视图',
            style: { display: 'flex', gap: 2 },
            children: ['month', 'agenda'].map((m) =>
              jsx(
                'button',
                {
                  type: 'button',
                  className: btn,
                  'aria-pressed': mode === m,
                  onClick: () => choose(m),
                  style: { color: mode === m ? accent : muted, background: mode === m ? tint : undefined },
                  children: m === 'month' ? '月历' : '日程',
                },
                m,
              ),
            ),
          }),
          jsx('button', {
            type: 'button',
            className: btn,
            disabled: q.isFetching,
            onClick: () => q.refetch(),
            style: { fontSize: 10, color: muted },
            title: q.data?.fetched_at
              ? `上次同步 ${new Date(q.data.fetched_at * 1000).toLocaleTimeString()}`
              : '刷新 Google 日历',
            children: q.isFetching ? '同步中…' : '刷新',
          }),
        ],
      }),
      jsxs('div', {
        style: { minHeight: 0, overflowY: 'auto', flex: 1, padding: '8px 10px' },
        children: [
          error
            ? jsx('div', {
                role: 'alert',
                style: { fontSize: 10, color: muted, overflowWrap: 'anywhere', padding: 4 },
                children: `读不到日历：${error}`,
              })
            : null,
          mode === 'month'
            ? jsx(MonthView, {
                month,
                setMonth,
                selected,
                setSelected,
                today,
                data: q.data,
                loading: q.isPending,
                error,
              })
            : q.isPending
              ? jsx(Note, { children: '读取中…' })
              : error && !q.data
                ? jsx(Note, { children: '请点击刷新重试。' })
                : groups.length
                  ? jsxs('div', {
                      style: { display: 'flex', flexDirection: 'column', gap: 14 },
                      children: [
                        jsx('div', { style: { fontSize: 10, color: muted }, children: '未来 14 天' }),
                        ...groups.map(([day, entries]) => jsx(DayRow, { day, today, items: entries }, day)),
                      ],
                    })
                  : jsx(Note, { children: '这 14 天没有安排' }),
        ],
      }),
    ],
  })
}
export default {
  id: ID,
  name: 'Calendar Pane',
  register(ctx) {
    ctx.register({
      id: 'pane',
      area: 'panes',
      title: '日历',
      data: {
        placement: 'main',
        dock: { pane: 'workspace', pos: 'right' },
        width: '300px',
        minWidth: '220px',
        collapsible: true,
      },
      render: () => jsx(CalendarPane, { rest: ctx.rest, storage: ctx.storage }),
    })
  },
}
