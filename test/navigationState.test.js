import { describe, expect, it } from 'vitest';
import { resolveNavigationState } from '../src/navigationState.js';

describe('resolveNavigationState', () => {
  it('shows a page-specific project gate when project-required pages are opened without a project', () => {
    expect(resolveNavigationState({ page: 'evidence', hasProject: false })).toMatchObject({
      mode: 'project-required',
      headerTitle: '证据管理',
      actionLabel: '去创建项目'
    });

    expect(resolveNavigationState({ page: 'package', hasProject: false })).toMatchObject({
      mode: 'project-required',
      headerTitle: '结算组卷'
    });
  });

  it('keeps the project creation surface available for dashboard and settings without a project', () => {
    expect(resolveNavigationState({ page: 'dashboard', hasProject: false })).toMatchObject({
      mode: 'create-project',
      headerTitle: '创建第一个项目'
    });

    expect(resolveNavigationState({ page: 'settings', hasProject: false })).toMatchObject({
      mode: 'create-project',
      headerTitle: '创建第一个项目'
    });
  });
});
