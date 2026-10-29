/* Simplified Chinese strings for text that main.js / deck.js / the 3D bundle write at runtime.
   Keyed by the exact English source text; {name} placeholders are filled in by the scripts.
   Loaded by deck-zh.html only, before main.js and deck.js. */
window.EG_T = {
  // WhatsApp messages the visitor sends
  'Hi Eternalgy, I’m comparing solar quotes for a {kwp} kWp home system. The upfront price difference is {gap}. Can you help me review the equipment, installation scope, warranties and savings assumptions?':
    '您好 Eternalgy，我正在比较 {kwp} kWp 住家太阳能报价，前期价格差额为 {gap}。可以协助我查看设备、安装范围、质保和节省估算假设吗？',
  'Hi Eternalgy, I already have a solar quote and would like a free second opinion. I’ll send it here.':
    '您好 Eternalgy，我已经有一份太阳能报价，想请你们免费给个意见。我会在这里发给你们。',
  'Hi Eternalgy, I’d like a free solar assessment for my home.': '您好 Eternalgy，我想为我的住家申请免费太阳能评估。',
  'Hi Eternalgy, I’m {name}. I’d like a free solar assessment.': '您好 Eternalgy，我是 {name}，想申请免费太阳能评估。',
  '• Monthly TNB bill: ': '• 每月 TNB 电费：',
  '• Property: ': '• 房产：',
  '• Location: ': '• 地点：',
  '• I already have a quote to compare.': '• 我已有报价，想做比较。',

  // rebate countdown, form
  'day left to commission': '距调试截止',
  'days left to commission': '距调试截止',
  'Step 1 of 2': '第 1 步，共 2 步',
  'Step 2 of 2': '第 2 步，共 2 步',
  'Sending…': '发送中…',

  // calculator
  'Yr 0': '0 年',
  'Yr {n}': '第 {n} 年',
  'Year {n}': '第 {n} 年',
  'Year {n}: alternative example inverter replaced': '第 {n} 年：替代方案示例更换逆变器',
  'Year {n}: Jinko Tiger Neo 3.0 example inverter replaced': '第 {n} 年：Jinko Tiger Neo 3.0 示例更换逆变器',
  'Net difference between the two example packages over 25 years': '两个配套示例 25 年的净差额',
  'Alternative example inverter replacement': '替代方案示例更换逆变器',
  'Jinko Tiger Neo 3.0 example inverter replacement': 'Jinko Tiger Neo 3.0 示例更换逆变器',
  'Vertical dashed marker = modeled crossover year, when present.': '如有垂直虚线标记，即表示示例差额的转折年份。',
  'The examples are even after 25 years under these assumptions.': '按这些假设，两个示例在 25 年后结果相同。',
  'Under these assumptions, the higher-spec example leads by the amount shown after 25 years.': '按这些假设，配置较高的示例在 25 年后领先图示金额。',
  'Under these assumptions, the lower-upfront example leads by the amount shown after 25 years.': '按这些假设，前期费用较低的示例在 25 年后领先图示金额。',
  'Not in 25 yrs': '25 年内无法回本',
  'Day one': '第一天',
  'No payback': '25 年内未回本',
  'Repaid yr {n}': '第 {n} 年回本',
  'Difference in upfront price': '前期价格差额',
  'Difference in example panel warranty terms': '太阳能板示例质保条款差异',
  'Difference in modeled inverter replacements': '示例中的逆变器更换差异',
  'Rebate difference in this example*': '此示例中的回扣差额*',
  'Net after 25 years': '25 年后净额',

  // 25-year timeline
  'Year {n}: inverter replaced': '第 {n} 年：更换逆变器',
  'No replacements yet': '尚未更换',
  'Inverter replaced −{x}': '更换逆变器 −{x}',
  'Play the 25-year timeline': '播放 25 年时间轴',
  'Pause the timeline': '暂停时间轴',

  // chapter "Heat" (hot-day clock)
  'Morning sun · the glass starts to warm': '早晨阳光 · 玻璃开始变热',
  'Heat builds up · glass on top, hot roof below': '热量积聚 · 上有玻璃，下有热屋顶',
  'Peak heat · 70–80°C on the panels': '最热时段 · 板面 70–80°C',
  'Late afternoon · still hot, slowly cooling': '傍晚 · 依然炎热，慢慢降温',
  'Play a hot day': '播放炎热的一天',

  // chapter "Low light" (one-day clock)
  'min': '分钟',
  'Generating': '发电中',
  'Waiting': '等待中',
  'Stopped': '已停止',
  'Before dawn · both panels idle': '天亮前 · 两种板都未发电',
  'First light · only Jinko is generating': '第一缕光 · 只有 Jinko 在发电',
  'Daylight · both generating': '白天 · 两种板都在发电',
  'Dusk · Jinko is still generating': '黄昏 · Jinko 仍在发电',
  'Night · both panels idle': '入夜 · 两种板都已停止',
  'Play one day': '播放一天',
  'Pause the day': '暂停',

  // deck chrome
  'Next': '下一章',
  'Back to system overview': '返回系统概览',
  'Back to installation steps': '返回安装流程',
  'Chapter {n}: {label}': '第 {n} 章：{label}',
  'Chapter {n} of {total}: {label}': '第 {n} 章（共 {total} 章）：{label}',

  // 3D model (3D-house-v2 bundle)
  'Drag to rotate · scroll to zoom · tap a number': '拖动旋转 · 滚轮缩放 · 点数字',
  'Drag to rotate · pinch to zoom · tap a number': '拖动旋转 · 双指缩放 · 点数字',
  'Solar panels': '太阳能板',
  'Hybrid inverter': '混合逆变器',
  'Battery · optional': '电池 · 可选',
  'Live monitoring': '实时监控',
  'Surge & earthing': '防雷与接地',
  'Interactive 3D model of a home with a rooftop solar system, inverter, battery, monitoring and earthing':
    '互动 3D 模型：装有屋顶太阳能系统、逆变器、电池、监控与接地的住家',
  // chapter "Battery": the day-and-night clock, flow diagram and battery tag
  'Night · the battery powers your home': '夜晚 · 电池为您的住家供电',
  'Battery at reserve · TNB powers the house': '电池已到保留电量 · 由 TNB 供电',
  'Extra solar is charging the battery': '多余的太阳能正在为电池充电',
  'Battery full · extra solar goes to TNB': '电池已充满 · 多余的太阳能输出到 TNB',
  'Sun fading · the battery helps out': '阳光减弱 · 电池帮忙供电',
  'Low sun · solar first, TNB tops up': '阳光较弱 · 先用太阳能，TNB 补足',
  'Solar powers your home': '太阳能为您的住家供电',
  'Charging': '充电中',
  'Discharging': '放电中',
  'Full': '已充满',
  'Idle': '待机',
  'Exporting': '输出中',
  'Buying': '购电中',
  'DC → AC': '直流 → 交流',
  'Standby': '待机',
  'Pause': '暂停',
  'Play a day and night': '播放一天一夜'
};
