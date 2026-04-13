export const REVIEW_COPY = {
  displayName: "Note Flashcards",
  filters: {
    source: "来源",
    all: "全部",
    current: "当前笔记",
    folder: "当前文件夹",
    mistakes: "错题本"
  },
  buttons: {
    refreshQueue: "刷新队列",
    clearMasteredMistakes: "清空已掌握错题",
    clearMasteredMistakesWithCount: (count: number) => `清空已掌握错题（${count}）`,
    generateCurrentNote: "生成当前笔记",
    generateCurrentFolder: "生成当前文件夹",
    showAllNewCards: "查看全部新卡",
    switchToMistakes: "切到错题本",
    flipToAnswer: "查看答案",
    flipToQuestion: "回到问题",
    openSource: "打开原文",
    addToMistakes: "加入错题本",
    removeFromMistakes: "移出错题本",
    markMastered: "标记已掌握",
    unmarkMastered: "取消已掌握",
    previous: "上一张",
    next: "下一张"
  },
  notices: {
    noCurrentNote: "当前没有可用的笔记",
    cannotReadCurrentNote: "无法读取当前笔记",
    noCurrentFolder: "当前没有可用的父文件夹",
    sourceNotFound: "找不到原文笔记",
    removedFromMistakes: "已移出错题本",
    addedToMistakes: "已加入错题本",
    noMasteredMistakesToClear: "当前没有已掌握的错题可清理",
    clearedMasteredMistakes: (count: number) => `已清理 ${count} 张已掌握错题`,
    refreshed: "闪卡列表已刷新"
  },
  cardFace: {
    question: "问题",
    answer: "答案"
  },
  stats: {
    queue: "当前队列",
    sourceTotal: "当前来源总卡",
    mistakeTotal: "错题本总数",
    priorityMistakes: "优先错题",
    masteredPendingClear: "已掌握待清理",
    cardCount: (count: number) => `${count} 张`
  },
  meta: {
    shortcutHint: "空格翻面 · ← → 切换 · 1-4 评分",
    dueCount: "待复习",
    queueCount: "当前队列",
    sourceCount: "当前来源",
    mistakeCount: "错题本",
    inMistakeBook: "错题本中",
    position: "第",
    summary: (dueCount: number, totalCount: number, totalCards: number, mistakeBookCount: number) => `${REVIEW_COPY.meta.dueCount} ${dueCount} 张 · ${REVIEW_COPY.meta.queueCount} ${totalCount} 张 · ${REVIEW_COPY.meta.sourceCount} ${totalCards} 张 · ${REVIEW_COPY.meta.mistakeCount} ${mistakeBookCount} 张`,
    limitedNewCards: (totalNewCards: number, newCardLimit: number) => `当前来源共有 ${totalNewCards} 张新卡，按每日新卡上限仅展示前 ${newCardLimit} 张。`,
    positionLabel: (index: number, total: number) => `${REVIEW_COPY.meta.position} ${index} 张 / 共 ${total} 张`
  },
  ratings: {
    again: "重来",
    hard: "困难",
    good: "正常",
    easy: "简单",
    hint: "翻到答案后可直接评分。"
  },
  emptyState: {
    mistakesTitle: "错题本目前是空的。",
    mistakesDescription: "复习时点击“重来”会自动加入错题本。",
    limitedTitle: "当前优先队列已完成，还可以继续查看剩余新卡。",
    noCardsTitle: "当前没有可复习的卡片。",
    noCardsDescription: "你可以先生成当前笔记或当前文件夹的闪卡。"
  },
  study: {
    scopeLabel: "范围",
    countModeLabel: "数量",
    orderModeLabel: "顺序",
    onlyMistakesLabel: "只做错题本",
    excludeMasteredLabel: "排除已掌握",
    scope: {
      current: "当前笔记",
      folder: "当前文件夹",
      all: "全部"
    },
    countMode: {
      random10: "随机 10 题",
      all: "全部"
    },
    orderMode: {
      random: "随机",
      sequential: "顺序"
    },
    badges: {
      mastered: "已掌握",
      mistake: "错题本",
      learning: "学习中"
    },
    stats: {
      mistakes: "错题本",
      mastered: "已掌握",
      learning: "学习中"
    },
    emptyState: {
      title: "当前条件下没有可学习的卡片。",
      description: "你可以调整筛选条件，或先生成当前笔记/文件夹的卡片。"
    },
    selectionSummary: (scope: string, countMode: string, orderMode: string, mistakesOnly: boolean, excludeMastered: boolean) => {
      const filters = [mistakesOnly ? "只做错题本" : "", excludeMastered ? "排除已掌握" : ""].filter(Boolean).join(" · ");
      return [scope, countMode, orderMode, filters].filter(Boolean).join(" · ");
    }
  }
} as const;
