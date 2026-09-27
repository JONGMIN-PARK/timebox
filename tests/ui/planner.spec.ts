import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'node:path';

const day = '2026-09-27';
const makeBlock = (
  id: number,
  title: string,
  startTime: string,
  endTime: string,
  category: string,
  completed = false,
  meta: string | null = null,
) => ({
  id,
  userId: 1,
  title,
  date: day,
  startTime,
  endTime,
  category,
  completed,
  meta,
  notes: null,
  color: null,
  createdAt: `${day}T00:00:00Z`,
  updatedAt: `${day}T00:00:00Z`,
});
async function setup(page: Page, theme = 'light') {
  await page.clock.install({ time: new Date(`${day}T00:30:00Z`) });
  await page.addInitScript(
    ({ day, theme }) => {
      localStorage.setItem('timebox_token', 'ui-test-token');
      localStorage.setItem('timebox_onboarding_done', 'true');
      localStorage.setItem('timebox_briefing_date', day);
      localStorage.setItem('timebox-locale', 'ko');
      localStorage.setItem('timebox_timezone', 'Asia/Seoul');
      localStorage.setItem('timebox_theme', theme);
    },
    { day, theme },
  );
  let failSave = false;
  let blocks = [
    makeBlock(1, '하루 준비와 메일 정리', '08:00', '08:30', 'admin', true),
    makeBlock(
      2,
      '타임박스 UX 설계',
      '09:00',
      '10:30',
      'deep_work',
      false,
      JSON.stringify({ prioritySlot: 1, protected: true }),
    ),
    makeBlock(3, '팀 싱크 미팅', '11:00', '11:30', 'meeting'),
    makeBlock(
      4,
      '프로토타입 구현',
      '13:00',
      '14:00',
      'deep_work',
      false,
      JSON.stringify({ prioritySlot: 2 }),
    ),
    makeBlock(5, '산책과 리셋', '15:00', '15:30', 'exercise'),
  ];
  const brain = [
    {
      id: 'a',
      text: '리뷰 피드백 정리',
      notes: '중요한 결정 3개만 정리하기',
      category: 'deep_work',
      duration: 30,
    },
    {
      id: 'b',
      text: '내일 일정 준비',
      notes: '여유 시간을 먼저 남겨 두기',
      category: 'admin',
      duration: 15,
    },
  ];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    const method = route.request().method();
    let data: unknown = [];
    if (pathname === '/api/auth/me')
      data = {
        id: 1,
        username: 'planner',
        displayName: '정민',
        role: 'user',
        teamGroups: [],
        hasProjectAccess: false,
      };
    else if (pathname.startsWith('/api/dayplan/'))
      data = pathname.endsWith(day)
        ? {
            exists: true,
            brain,
            top3: ['타임박스 UX 설계', '프로토타입 구현', '리뷰 피드백 정리'],
            memo: '집중은 한 번에 하나씩. 미팅 사이에는 여유를 남기자.',
          }
        : { exists: false, brain: [], top3: ['', '', ''], memo: '' };
    else if (pathname === '/api/timeblocks' && method === 'GET')
      data = url.searchParams.get('date') === day ? blocks : [];
    else if (pathname === '/api/timeblocks' && method === 'POST') {
      if (failSave) {
        await route.fulfill({ status: 500, json: { success: false, error: 'Test save failed' } });
        return;
      }
      const input = route.request().postDataJSON();
      const saved = {
        ...makeBlock(
          100 + blocks.length,
          input.title,
          input.startTime,
          input.endTime,
          input.category,
        ),
        ...input,
      };
      blocks.push(saved);
      data = saved;
    } else if (/\/api\/timeblocks\/\d+$/.test(pathname) && method === 'PUT') {
      const id = Number(pathname.split('/').at(-1));
      const input = route.request().postDataJSON();
      blocks = blocks.map((block) => (block.id === id ? { ...block, ...input } : block));
      data = blocks.find((block) => block.id === id);
    } else if (/\/api\/timeblocks\/\d+$/.test(pathname) && method === 'DELETE') {
      blocks = blocks.filter((block) => block.id !== Number(pathname.split('/').at(-1)));
    } else if (pathname === '/api/summary/week')
      data = { personalTodosDue: [], assignedProjectTasks: [] };
    else if (pathname === '/api/inbox/unread-count') data = { count: 0 };
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: '오늘의 타임박스' })).toBeVisible();
  await expect(page.locator('[data-block-chip]')).toHaveCount(5);
  return {
    errors,
    fail: () => {
      failSave = true;
    },
    blocks: () => blocks,
  };
}

test('daily planner is readable and fits the viewport', async ({ page }, info) => {
  const state = await setup(page, info.project.name === 'dark' ? 'dark' : 'light');
  await expect(page.getByRole('region', { name: '하루 시간 예산' })).toBeVisible();
  await expect(page.locator('.planner-metric').first()).toContainText('4시간');
  expect(
    await page
      .locator('.planner-page')
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
  ).toBe(true);
  await page.screenshot({
    path: resolve('../timebox-preview', `planner-${info.project.name}.png`),
    fullPage: true,
  });
  expect(state.errors).toEqual([]);
});
test('places a task directly in a free slot and updates the time budget', async ({ page }) => {
  const state = await setup(page);
  if (await page.getByRole('tab', { name: '할 일 · 우선순위' }).isVisible())
    await page.getByRole('tab', { name: '할 일 · 우선순위' }).click();
  const task = page.locator('.planner-task').filter({ hasText: '리뷰 피드백 정리' });
  await task.getByRole('button', { name: '30분', exact: true }).click();
  await expect(task).toHaveCount(0);
  await expect(page.locator('.planner-metric').first()).toContainText('4시간 30분');
  expect(state.blocks().find((block) => block.title === '리뷰 피드백 정리')).toMatchObject({
    startTime: '08:30',
    endTime: '09:00',
  });
  expect(state.errors).toEqual([]);
});
test('preserves the editor and input after a failed save', async ({ page }) => {
  const state = await setup(page);
  state.fail();
  await page.getByRole('button', { name: '블록 추가', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '블록 추가' });
  await dialog.getByLabel('제목', { exact: true }).fill('실패해도 유지할 입력');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('저장에 실패');
  await expect(dialog.getByLabel('제목', { exact: true })).toHaveValue('실패해도 유지할 입력');
  expect(state.errors).toEqual([]);
});
test("date navigation does not leave yesterday's blocks visible", async ({ page }) => {
  const state = await setup(page);
  await page.getByRole('button', { name: '다음 날짜', exact: true }).click();
  await expect(page.locator('[data-block-chip]')).toHaveCount(0);
  await expect(page.locator('.planner-metric').first()).toContainText('0분');
  await page.getByRole('button', { name: '오늘', exact: true }).click();
  await expect(page.locator('[data-block-chip]')).toHaveCount(5);
  expect(state.errors).toEqual([]);
});
test('completion updates the time-based progress', async ({ page }) => {
  const state = await setup(page);
  await page.getByRole('button', { name: '타임박스 UX 설계 완료 표시', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: '시간 기준 완료율' })).toHaveAttribute(
    'aria-valuenow',
    '50',
  );
  expect(state.errors).toEqual([]);
});

test('focus timer pauses, resumes and survives a reload', async ({ page }) => {
  const state = await setup(page);
  await page.clock.pauseAt(`${day}T00:31:00Z`);
  await page.getByRole('button', { name: '집중 시작', exact: true }).click();
  await expect(page.getByLabel('남은 집중 시간')).toHaveText('90:00');
  await page.clock.fastForward(60_000);
  await expect(page.getByLabel('남은 집중 시간')).toHaveText('89:00');
  await page.getByRole('button', { name: '집중 일시정지' }).click();
  await page.clock.fastForward(60_000);
  await expect(page.getByLabel('남은 집중 시간')).toHaveText('89:00');
  await page.getByRole('button', { name: '집중 재개' }).click();
  await page.clock.fastForward(30_000);
  await expect(page.getByLabel('남은 집중 시간')).toHaveText('88:30');
  await page.reload();
  await expect(page.getByLabel('남은 집중 시간')).toHaveText('88:30');
  expect(state.errors).toEqual([]);
});
