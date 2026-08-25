import { supabase } from './supabase';

export type Category = '식비' | '카페·배달' | '쇼핑' | '교통' | '기타';
export type Expense = { id: string; title: string; amount: number; category: Category; date: string };
export type CashFlow = { id: string; title: string; amount: number; date: string; type: 'income' | 'fixed' };
export type Goal = { id: string; title: string; targetAmount: number; savedAmount: number; targetDate: string };
export type Notifications = { risk: boolean; goal: boolean };
export type Profile = {
  balance: number;
  warning: number;
  danger: number;
  expenses: Expense[];
  cashFlows: CashFlow[];
  goals: Goal[];
  notifications: Notifications;
};

function configuredClient() {
  if (!supabase) throw new Error('Supabase 환경변수가 설정되지 않았습니다.');
  return supabase;
}

export async function loadRemoteProfile(userId: string): Promise<Profile | null> {
  const client = configuredClient();
  const [profileResult, expenseResult, flowResult, goalResult, notificationResult] = await Promise.all([
    client.from('financial_profiles').select('balance, warning_balance, danger_balance').eq('user_id', userId).maybeSingle(),
    client.from('expenses').select('id, title, amount, category, spent_on').eq('user_id', userId).order('spent_on', { ascending: false }),
    client.from('cash_flows').select('id, title, amount, scheduled_on, flow_type').eq('user_id', userId).order('scheduled_on', { ascending: true }),
    client.from('goals').select('id, title, target_amount, saved_amount, target_date').eq('user_id', userId).order('created_at', { ascending: true }),
    client.from('notification_settings').select('risk_enabled, goal_enabled').eq('user_id', userId).maybeSingle(),
  ]);

  const error = profileResult.error || expenseResult.error || flowResult.error || goalResult.error || notificationResult.error;
  if (error) throw error;
  if (!profileResult.data) return null;

  return {
    balance: Number(profileResult.data.balance),
    warning: Number(profileResult.data.warning_balance),
    danger: Number(profileResult.data.danger_balance),
    expenses: (expenseResult.data ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      amount: Number(item.amount),
      category: item.category as Category,
      date: item.spent_on,
    })),
    cashFlows: (flowResult.data ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      amount: Number(item.amount),
      date: item.scheduled_on,
      type: item.flow_type as CashFlow['type'],
    })),
    goals: (goalResult.data ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      targetAmount: Number(item.target_amount),
      savedAmount: Number(item.saved_amount),
      targetDate: item.target_date,
    })),
    notifications: {
      risk: notificationResult.data?.risk_enabled ?? true,
      goal: notificationResult.data?.goal_enabled ?? true,
    },
  };
}

export async function saveRemoteProfile(userId: string, profile: Profile) {
  const client = configuredClient();
  const profileResult = await client.from('financial_profiles').upsert({
    user_id: userId,
    balance: Math.round(profile.balance),
    warning_balance: Math.round(profile.warning),
    danger_balance: Math.round(profile.danger),
  }, { onConflict: 'user_id' });
  if (profileResult.error) throw profileResult.error;

  const clearResults = await Promise.all([
    client.from('expenses').delete().eq('user_id', userId),
    client.from('cash_flows').delete().eq('user_id', userId),
    client.from('goals').delete().eq('user_id', userId),
  ]);
  const clearError = clearResults.find((result) => result.error)?.error;
  if (clearError) throw clearError;

  if (profile.expenses.length) {
    const { error } = await client.from('expenses').insert(profile.expenses.map((item) => ({
      id: item.id,
      user_id: userId,
      title: item.title,
      amount: Math.round(item.amount),
      category: item.category,
      spent_on: item.date,
    })));
    if (error) throw error;
  }

  if (profile.cashFlows.length) {
    const { error } = await client.from('cash_flows').insert(profile.cashFlows.map((item) => ({
      id: item.id,
      user_id: userId,
      title: item.title,
      amount: Math.round(item.amount),
      scheduled_on: item.date,
      flow_type: item.type,
    })));
    if (error) throw error;
  }

  if (profile.goals.length) {
    const { error } = await client.from('goals').insert(profile.goals.map((item, index) => ({
      id: item.id,
      user_id: userId,
      title: item.title,
      target_amount: Math.round(item.targetAmount),
      saved_amount: Math.round(item.savedAmount),
      target_date: item.targetDate,
      monthly_saving_amount: 0,
      is_primary: index === 0,
    })));
    if (error) throw error;
  }

  const { error: notificationError } = await client.from('notification_settings').upsert({
    user_id: userId,
    risk_enabled: profile.notifications.risk,
    goal_enabled: profile.notifications.goal,
  }, { onConflict: 'user_id' });
  if (notificationError) throw notificationError;
}

export async function saveScenarioAndAnalysis(
  userId: string,
  profile: Profile,
  monthlyReductionAmount: number,
) {
  const client = configuredClient();
  const goal = profile.goals[0];
  const repeat = profile.expenses.reduce<Map<string, { count: number; amount: number; category: Category }>>((map, item) => {
    const previous = map.get(item.title) ?? { count: 0, amount: 0, category: item.category };
    map.set(item.title, { ...previous, count: previous.count + 1, amount: previous.amount + item.amount });
    return map;
  }, new Map());
  const mostRepeated = [...repeat.entries()].sort((a, b) => b[1].amount - a[1].amount)[0];

  const jobs: PromiseLike<unknown>[] = [];
  if (goal) {
    jobs.push(client.from('simulation_inputs').upsert({
      user_id: userId,
      goal_id: goal.id,
      category: '카페·배달',
      monthly_reduction_amount: Math.max(0, Math.round(monthlyReductionAmount)),
    }, { onConflict: 'user_id' }));
  } else {
    jobs.push(client.from('simulation_inputs').delete().eq('user_id', userId));
  }

  if (mostRepeated) {
    const [title, detail] = mostRepeated;
    jobs.push(client.from('ai_analysis_results').upsert({
      user_id: userId,
      mode: 'overspend',
      target_category: detail.category,
      evidence: `${title} ${detail.count}회, ${Math.round(detail.amount).toLocaleString('ko-KR')}원`,
      comment: `${title} 지출을 조금 줄이면 미래 잔액에 여유가 생겨요.`,
      suggested_amount: Math.min(Math.round(detail.amount), Math.max(0, Math.round(monthlyReductionAmount))),
    }, { onConflict: 'user_id' }));
  } else {
    jobs.push(client.from('ai_analysis_results').delete().eq('user_id', userId));
  }

  const results = await Promise.all(jobs) as Array<{ error?: unknown }>;
  const error = results.find((result) => result.error)?.error;
  if (error) throw error;
}
