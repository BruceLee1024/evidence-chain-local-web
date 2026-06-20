const createProjectState = {
  mode: 'create-project',
  headerTitle: '创建第一个项目',
  headerDescription: '先建立项目，再录入证据和组卷'
};

const projectRequiredPages = {
  evidence: {
    headerTitle: '证据管理',
    headerDescription: '先创建或选择项目后录入证据',
    gateTitle: '证据管理需要先创建项目',
    gateDescription: '项目是签证变更单、隐蔽工程记录、材料进场记录和附件的归档边界。先创建项目后，再进入证据管理。'
  },
  package: {
    headerTitle: '结算组卷',
    headerDescription: '先创建或选择项目后进行组卷',
    gateTitle: '结算组卷需要先创建项目',
    gateDescription: '结算项、匹配结果和导出目录都归属于具体项目。先创建项目后，再导入结算清单。'
  },
  search: {
    headerTitle: '全局搜索',
    headerDescription: '先创建或选择项目后搜索证据',
    gateTitle: '全局搜索需要先创建项目',
    gateDescription: '搜索范围来自项目证据库。先创建项目并归档资料后，再按编号、部位、材料或关键词检索。'
  }
};

export function resolveNavigationState({ page, hasProject }) {
  if (hasProject) {
    return { mode: 'project-ready' };
  }

  const projectRequired = projectRequiredPages[page];
  if (projectRequired) {
    return {
      mode: 'project-required',
      actionLabel: '去创建项目',
      ...projectRequired
    };
  }

  return createProjectState;
}
