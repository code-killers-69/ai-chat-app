import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'

/**
 * ============================================================================
 *                         虚拟列表 (Virtual List)
 * ============================================================================
 *
 * 【解决什么问题】
 *   假设有 100 条消息，正常 v-for 会创建 100 个 DOM 节点。
 *   虚拟列表只渲染用户"看得见"的那 ~15 条 DOM，其余 85 条根本不存在。
 *   这样滚动时 DOM 数量始终很少，性能不会随消息增多而下降。
 *
 * 【核心难点】
 *   删掉 85 条 DOM 后，浏览器不知道它们存在过。
 *   剩下的 15 条 DOM 会挤到容器顶部，滚动条也会变短。
 *   所以需要：
 *     1. 一个空的大容器撑出"好像有 100 条消息"的总高度 → totalHeight
 *     2. 每条消息用 position:absolute + top:offset 放到正确位置 → offset
 *     3. 知道"用户滚到哪了，该渲染第几条到第几条" → 二分查找
 *     4. 消息高度不固定，需要渲染后测量真实高度 → ResizeObserver
 *     5. 测量后高度变了，offset 全变，页面会跳 → 滚动锚定
 *
 * 【数据流全景】
 *
 *   用户滚动
 *     │
 *     ▼
 *   onScroll (rAF节流，每帧最多1次)
 *     │
 *     ▼
 *   scrollTop / viewportHeight 更新
 *     │
 *     ▼
 *   visibleItems 重算 (computed)
 *     ├── 依赖 itemPositions (每条消息的 offset + height)
 *     ├── 用二分查找找到 scrollTop 对应的起始 item
 *     ├── 用二分查找找到 scrollTop+viewportHeight 对应的结束 item
 *     └── 上下各扩展 bufferCount 条作为缓冲
 *     │
 *     ▼
 *   Vue 只渲染 visibleItems 对应的 DOM
 *     │
 *     ▼
 *   ResizeObserver 测量这些 DOM 的真实高度
 *     │
 *     ▼
 *   高度和之前不一样？
 *     ├── ① 记住当前视觉锚点 (getAnchorInfo)
 *     ├── ② 更新 heightCache → heightVersion++ → prefixSums 重算
 *     └── ③ 修正 scrollTop 让视觉位置不变 (restoreAnchor)
 *
 * ============================================================================
 */
export function useVirtualList({
  items,
  scrollContainer,
  estimatedHeight = 80,
  bufferCount = 5,
}) {

  // ============================================================================
  //  第一层：高度管理
  //  问题：每条消息多高？文字长短不同、有没有图片都不一样。
  //  方案：先用 estimatedHeight(80px) 猜，渲染后用 ResizeObserver 测真实值存入 heightCache。
  // ============================================================================

  /** heightCache: Map<itemId, 真实高度px> —— 测量过的消息高度存在这里 */
  const heightCache = new Map()

  /**
   * heightVersion: 一个计数器，每次高度变化 +1。
   * 为什么需要它？因为 heightCache 是个 Map，Vue 追踪不到它内部变化。
   * 手动 heightVersion++ 就能通知 Vue："高度变了，请重算 computed"。
   */
  const heightVersion = ref(0)

  // ============================================================================
  //  第二层：前缀和数组 —— 快速算出每条消息的 offset(离顶部多远)
  //
  //  为什么需要 offset？
  //    正常 v-for，浏览器自动从上往下排列 DOM，位置由浏览器管。
  //    虚拟列表删了大部分 DOM，剩下的用 position:absolute，位置要自己算。
  //    offset 就是"这条消息应该放在距离容器顶部多少 px 的位置"。
  //
  //  为什么用前缀和？
  //    第 i 条的 offset = 第 0 条高度 + 第 1 条高度 + ... + 第 i-1 条高度
  //    如果每次都从头加，100 条消息就要加 100 次 = O(n)
  //    前缀和提前算好存起来：prefixSums[i] = 前 i 条的高度之和
  //    那 offset = prefixSums[i]，直接查表 = O(1)
  //
  //  前缀和的代价：
  //    查询 O(1) 很快，但更新很慢 —— 任何一条消息高度变了，
  //    它后面所有位置的前缀和都要重算，即 O(n)。
  //    当前实现是每次高度变化后全量 rebuildPrefixSums()。
  //    对于百级消息量，O(n) 遍历做加法耗时在微秒级，完全没问题。
  //
  //  进阶优化方向（万级数据时考虑）：
  //    可以用树状数组 (Binary Indexed Tree / Fenwick Tree) 替代前缀和数组，
  //    单点更新 O(log n)，前缀和查询 O(log n)。
  //    查询从 O(1) 变成 O(log n)，但更新从 O(n) 降到 O(log n)，
  //    在高度频繁变化的大规模列表中更优。
  //
  //  举例（3条消息，高度分别为 80, 120, 80）：
  //    prefixSums = [0, 80, 200, 280]
  //    第0条 offset = prefixSums[0] = 0     (在最顶部)
  //    第1条 offset = prefixSums[1] = 80    (紧接第0条下方)
  //    第2条 offset = prefixSums[2] = 200   (紧接第1条下方)
  //    totalHeight  = prefixSums[3] = 280   (容器需要这么高)
  // ============================================================================

  let prefixSums = [0]
  let cachedHeights = []

  /** 重建前缀和：遍历所有 items，用 heightCache 中的真实高度（没有就用估计值） */
  function rebuildPrefixSums() {
    const list = items.value
    const n = list.length
    prefixSums = new Array(n + 1)
    cachedHeights = new Array(n)
    prefixSums[0] = 0
    for (let i = 0; i < n; i++) {
      const h = heightCache.get(list[i].id) || estimatedHeight
      cachedHeights[i] = h
      prefixSums[i + 1] = prefixSums[i] + h
    }
  }

  // ============================================================================
  //  第三层：滚动状态
  //  scrollTop = 用户滚了多远（距离顶部的 px）
  //  viewportHeight = 可视区域的高度
  //  两者决定了"用户能看到 scrollTop ~ scrollTop+viewportHeight 这个范围"
  // ============================================================================

  const scrollTop = ref(0)
  const viewportHeight = ref(0)

  /**
   * isAdjustingScroll: 锚定修正 scrollTop 时的保护标志。
   * 修正 scrollTop 会触发 scroll 事件，如果不拦截，
   * onScroll 又会更新 scrollTop ref → 触发 visibleItems 重算 → 可能抖动。
   * 所以修正期间让 onScroll 跳过。
   */
  let isAdjustingScroll = false

  /** rAF 节流用的 ID */
  let scrollRAF = null

  // ============================================================================
  //  ResizeObserver 实例 + 已监听元素集合
  // ============================================================================

  let resizeObserver = null
  /** 当前正在被 observe 的 DOM 元素集合，用于增量 observe/unobserve */
  const observedElements = new Set()

  // ============================================================================
  //  第四层：computed —— 核心响应式链条
  //
  //  itemPositions: 依赖 heightVersion 和 items
  //    → 任何一个变了就重算 prefixSums，返回每条消息的 { offset, height }
  //
  //  totalHeight: 依赖 itemPositions
  //    → 所有消息高度之和，用于撑起容器
  //
  //  visibleItems: 依赖 itemPositions + scrollTop + viewportHeight
  //    → 算出当前该渲染哪些消息（Vue 模板 v-for 绑定这个）
  // ============================================================================

  const itemPositions = computed(() => {
    // 读一下这两个值，让 Vue 知道"我依赖它们"，它们变了我要重算
    void heightVersion.value
    void items.value
    rebuildPrefixSums()

    const list = items.value
    const n = list.length
    const positions = new Array(n)
    for (let i = 0; i < n; i++) {
      positions[i] = {
        offset: prefixSums[i],    // 这条消息距离顶部多少 px
        height: cachedHeights[i],  // 这条消息多高
      }
    }
    return positions
  })

  /** 所有消息的总高度，CSS 用它撑起容器 */
  const totalHeight = computed(() => {
    const pos = itemPositions.value
    if (pos.length === 0) return 0
    return prefixSums[pos.length]
  })

  // ============================================================================
  //  第五层：二分查找 —— 根据 scrollTop(像素) 快速找到对应的消息下标
  //
  //  为什么不直接遍历？
  //    100条消息遍历也很快，但二分查找 O(log n) 是标准做法，
  //    消息量大时差距明显，而且逻辑更清晰。
  //
  //  原理：prefixSums 是递增数组，找到"scrollTop 落在哪个区间"
  //    比如 prefixSums = [0, 80, 200, 280]，scrollTop = 150
  //    150 落在 [80, 200) 区间 → 第 1 条消息
  // ============================================================================

  function binarySearch(targetOffset) {
    void itemPositions.value // 确保前缀和已计算
    const n = prefixSums.length - 1
    if (n === 0) return 0

    let lo = 0, hi = n - 1
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1
      if (prefixSums[mid + 1] <= targetOffset) {
        lo = mid + 1
      } else if (prefixSums[mid] > targetOffset) {
        hi = mid - 1
      } else {
        return mid // prefixSums[mid] <= targetOffset < prefixSums[mid+1]
      }
    }
    return Math.max(0, Math.min(lo, n - 1))
  }

  // ============================================================================
  //  第六层：visibleItems —— 最终输出，模板 v-for 绑定的数据
  //
  //  逻辑：
  //    1. 用户视口范围 = [scrollTop, scrollTop + viewportHeight]
  //    2. 二分查找找到起始 item 和结束 item
  //    3. 上下各多渲染 bufferCount 条（滚动时不会看到空白）
  //    4. 返回这些 item 的 { index, data, offset, height }
  //       模板用 offset 做 position:absolute 定位
  // ============================================================================

  const visibleItems = computed(() => {
    const pos = itemPositions.value
    const n = pos.length
    if (n === 0) return []

    const top = scrollTop.value
    const bottom = top + viewportHeight.value
    const version = heightVersion.value
    
    let startIdx = binarySearch(top)
    let endIdx = binarySearch(bottom)

    // 加 buffer：上下各多渲染几条，滚动时有缓冲不会闪白
    startIdx = Math.max(0, startIdx - bufferCount)
    endIdx = Math.min(n - 1, endIdx + bufferCount)

    const result = new Array(endIdx - startIdx + 1)
    for (let i = startIdx; i <= endIdx; i++) {
      result[i - startIdx] = {
        index: i,
        data: items.value[i],
        offset: pos[i].offset,
        height: pos[i].height,
        version,
      }
    }
    return result
  })

  // ============================================================================
  //  第七层：滚动锚定 —— 解决"高度变化后页面跳动"
  //
  //  场景：用户正在看第 50 条消息，此时第 30 条消息的图片加载完了，
  //        高度从 80px(估计) 变成 280px(真实)，多了 200px。
  //        第 30 条之后所有消息的 offset 都要 +200px。
  //        但浏览器的 scrollTop 没变 → 用户看到的内容突然往下跳了 200px。
  //
  //  解决：
  //    ① 高度变化前，记住"用户正在看第 50 条，视口顶部在第 50 条内部偏移 30px"
  //    ② 高度变化后，重算 offset，第 50 条的新 offset 变了
  //    ③ 修正 scrollTop = 第 50 条新 offset + 30px → 视觉上没动
  //
  //  关键：① ② ③ 必须在同一同步执行流中完成，中间不能有异步。
  //        否则用户可能在 ① 和 ③ 之间又滚动了，锚点就过时了。
  // ============================================================================

  function getAnchorInfo() {
    if (!scrollContainer.value) return null
    const pos = itemPositions.value
    if (pos.length === 0) return null
    const st = scrollContainer.value.scrollTop
    const anchorIdx = binarySearch(st)
    // anchorOffset = scrollTop 在锚点 item 内部的偏移量
    const anchorOffset = st - pos[anchorIdx].offset
    return { anchorIdx, anchorOffset }
  }

  function restoreAnchor(anchorInfo) {
    if (!anchorInfo || !scrollContainer.value) return
    const { anchorIdx, anchorOffset } = anchorInfo
    const pos = itemPositions.value
    if (anchorIdx >= pos.length) return
    // 用锚点 item 的新 offset + 之前的内部偏移量 = 新的 scrollTop
    const newScrollTop = pos[anchorIdx].offset + anchorOffset
    const diff = Math.abs(scrollContainer.value.scrollTop - newScrollTop)
    if (diff > 0.5) {
      isAdjustingScroll = true  // 保护：这次 scrollTop 改变不要触发 onScroll
      scrollContainer.value.scrollTop = newScrollTop
      scrollTop.value = newScrollTop
      requestAnimationFrame(() => {
        isAdjustingScroll = false
      })
    }
  }

  // ============================================================================
  //  第八层：ResizeObserver —— 自动测量渲染后的真实高度
  //
  //  流程：
  //    DOM 渲染出来 → ResizeObserver 回调触发 → 读取真实高度
  //    → 和 heightCache 对比，变了就更新
  //    → 同步执行锚定三步曲（记锚点→重算→恢复锚点）
  // ============================================================================

  function setupResizeObserver() {
    if (resizeObserver) resizeObserver.disconnect()
    observedElements.clear()

    resizeObserver = new ResizeObserver((entries) => {
      let changed = false

      for (const entry of entries) {
        const el = entry.target
        const itemId = el.dataset.virtualId  // DOM 上标记的消息 ID
        if (!itemId) continue
        const newHeight = el.getBoundingClientRect().height
        if (newHeight === 0) continue
        const oldHeight = heightCache.get(itemId)
        if (oldHeight === undefined || Math.abs(newHeight - oldHeight) > 0.5) {
          heightCache.set(itemId, newHeight)
          changed = true
        }
      }

      if (changed) {
        // 锚定三步曲（必须同步，不能用 setTimeout/rAF）
        const anchor = getAnchorInfo()   // ① 记住当前视觉位置
        heightVersion.value++             // ② 触发 prefixSums 重算
        restoreAnchor(anchor)             // ③ 修正 scrollTop
      }
    })
  }

  // ============================================================================
  //  observe 管理：增量 observe/unobserve
  //
  //  visibleItems 变了（用户滚动了）→ DOM 中的 .virtual-item 变了
  //  → 新出现的 DOM 要 observe，消失的要 unobserve
  //  → 避免全量重新 observe 的开销
  // ============================================================================

  function observeVisibleItems() {
    if (!resizeObserver || !scrollContainer.value) return
    const container = scrollContainer.value.querySelector('.virtual-list-container')
    if (!container) return

    const domItems = container.querySelectorAll('.virtual-item')
    const currentElements = new Set()

    // 新增的 DOM → observe
    domItems.forEach(el => {
      currentElements.add(el)
      if (!observedElements.has(el)) {
        resizeObserver.observe(el)
        observedElements.add(el)
      }
    })

    // 已消失的 DOM → unobserve
    for (const el of observedElements) {
      if (!currentElements.has(el)) {
        resizeObserver.unobserve(el)
        observedElements.delete(el)
      }
    }
  }

  // ============================================================================
  //  滚动事件处理（rAF 节流）
  //
  //  为什么节流？
  //    scroll 事件每秒可能触发 60+ 次，每次都更新 scrollTop ref
  //    → 触发 visibleItems computed → Vue diff → 重渲染
  //    太频繁了。用 rAF 保证每帧最多处理 1 次。
  // ============================================================================

  function processScroll() {
    scrollRAF = null
    if (!scrollContainer.value || isAdjustingScroll) return
    scrollTop.value = scrollContainer.value.scrollTop
    viewportHeight.value = scrollContainer.value.clientHeight
  }

  function onScroll() {
    if (!scrollContainer.value || isAdjustingScroll) return
    if (!scrollRAF) {
      scrollRAF = requestAnimationFrame(processScroll)
    }
  }

  // ============================================================================
  //  工具方法
  // ============================================================================

  function isNearBottom(threshold = 150) {
    if (!scrollContainer.value) return true
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer.value
    return scrollHeight - scrollTop - clientHeight < threshold
  }

  function scrollToBottom(behavior = 'smooth') {
    // 先同步更新 scrollTop，让 visibleItems 立即包含底部的新消息
    const total = totalHeight.value
    if (total > 0) {
      scrollTop.value = Math.max(0, total - viewportHeight.value)
    }
    nextTick(() => {
      if (!scrollContainer.value) return
      scrollContainer.value.scrollTo({
        top: total,
        left: 0,
        behavior,
      })
    })
  }

  /**
   * 在列表头部插入数据后，自动修正 scrollTop 保持视觉位置。
   *
   * 场景：用户向上滚动触发加载历史消息，20 条新消息插入到数组头部。
   *       所有原有消息的 offset 都增加了（前面多了 20 条的高度）。
   *       如果不修正 scrollTop，用户会突然看到最顶部的新消息。
   *
   * 做法：算出新插入消息的总高度，scrollTop += 这个高度。
   */
  function anchorAfterPrepend(prependCount) {
    if (!scrollContainer.value || prependCount <= 0) return
    heightVersion.value++
    const pos = itemPositions.value
    let addedHeight = 0
    for (let i = 0; i < prependCount && i < pos.length; i++) {
      addedHeight += pos[i].height
    }
    isAdjustingScroll = true
    scrollContainer.value.scrollTop += addedHeight
    scrollTop.value = scrollContainer.value.scrollTop
    requestAnimationFrame(() => {
      isAdjustingScroll = false
    })
  }

  /** 切换会话时清空所有高度缓存，重新开始测量 */
  function clearHeightCache() {
    heightCache.clear()
    observedElements.clear()
    if (resizeObserver) resizeObserver.disconnect()
    setupResizeObserver()
    heightVersion.value++
  }

  /** 手动触发一次重算（用于流式消息内容更新等场景） */
  function forceUpdate() {
    heightVersion.value++
  }

  // ============================================================================
  //  窗口 resize 监听
  //  用户缩放浏览器窗口 → viewportHeight 变了 → visibleItems 范围要变
  // ============================================================================

  function onWindowResize() {
    if (!scrollContainer.value) return
    viewportHeight.value = scrollContainer.value.clientHeight
  }

  // ============================================================================
  //  生命周期
  // ============================================================================

  onMounted(() => {
    setupResizeObserver()
    if (scrollContainer.value) {
      viewportHeight.value = scrollContainer.value.clientHeight
    }
    window.addEventListener('resize', onWindowResize)
  })

  onUnmounted(() => {
    if (resizeObserver) resizeObserver.disconnect()
    if (scrollRAF) cancelAnimationFrame(scrollRAF)
    observedElements.clear()
    window.removeEventListener('resize', onWindowResize)
  })

  // visibleItems 变了 → DOM 变了 → 增量 observe 新 DOM
  watch(visibleItems, () => {
    nextTick(() => observeVisibleItems())
  }, { flush: 'post' })

  // ============================================================================
  //  对外暴露
  // ============================================================================

  return {
    visibleItems,     // 模板 v-for 绑定这个
    totalHeight,      // 模板用它撑容器高度
    itemPositions,    // 调试用
    scrollTop,        // 调试用
    viewportHeight,   // 调试用
    onScroll,         // 绑定到 scrollArea 的 @scroll
    isNearBottom,     // 判断是否接近底部（自动滚动用）
    scrollToBottom,   // 滚到最底部
    anchorAfterPrepend, // 头部插入消息后调用
    observeVisibleItems, // 手动触发 observe（初始化时用）
    clearHeightCache,    // 切换会话时清空
    forceUpdate,         // 手动触发重算
  }
}
