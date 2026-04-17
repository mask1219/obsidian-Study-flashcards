export const PLUGIN_COPY = {
  notices: {
    noCurrentFolder: "当前没有可用的父文件夹",
    noCurrentNote: "当前没有可用的笔记",
    cannotOpenReviewView: "无法打开闪卡视图",
    generateFailed: "生成失败，请检查模型配置、网络或笔记内容。",
    resetCardsDone: "已重置所有卡片数据",
    resetSettingsDone: "已恢复默认设置"
  },
  menu: {
    generateCurrentNote: "生成当前笔记闪卡",
    generateCurrentFolder: "生成当前文件夹闪卡"
  },
  commands: {
    generateCurrentNote: "从当前笔记生成闪卡",
    generateCurrentFolder: "从当前文件夹生成闪卡",
    openReview: "打开闪卡复习视图"
  },
  ribbon: {
    openReview: "打开闪卡复习视图"
  }
} as const;
