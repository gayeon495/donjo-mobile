import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

type Tab = 'past' | 'future' | 'whatif' | 'my';
type Category = '식비' | '카페·배달' | '쇼핑' | '교통' | '기타';
type Expense = { id: string; title: string; amount: number; category: Category; date: string };
type CashFlow = { id: string; title: string; amount: number; date: string; type: 'income' | 'fixed' };
type Goal = { id: string; title: string; targetAmount: number; savedAmount: number; targetDate: string };
type Notifications = { risk: boolean; goal: boolean };
type Profile = { balance: number; warning: number; danger: number; expenses: Expense[]; cashFlows: CashFlow[]; goals: Goal[]; notifications: Notifications };
type MyView = 'home' | 'risk' | 'goals' | 'notifications' | 'data';

const STORE_KEY = '@donjo-profile-v1';
const categories: Category[] = ['식비', '카페·배달', '쇼핑', '교통', '기타'];
const won = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`;
const dateOffset = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const sampleProfile = (): Profile => ({
  balance: 480000,
  warning: 200000,
  danger: 100000,
  cashFlows: [
    { id: 'income-1', title: '알바비', amount: 350000, date: dateOffset(12), type: 'income' },
    { id: 'fixed-1', title: '월세', amount: 250000, date: dateOffset(7), type: 'fixed' },
  ],
  goals: [{ id: 'goal-1', title: '교환학생', targetAmount: 10000000, savedAmount: 6200000, targetDate: '2026-08-31' }],
  notifications: { risk: true, goal: true },
  expenses: [
    { id: '1', title: '아메리카노', amount: 5000, category: '카페·배달', date: dateOffset(-2) },
    { id: '2', title: '아메리카노', amount: 5000, category: '카페·배달', date: dateOffset(-4) },
    { id: '3', title: '배달 저녁', amount: 16000, category: '카페·배달', date: dateOffset(-6) },
    { id: '4', title: '아메리카노', amount: 5000, category: '카페·배달', date: dateOffset(-9) },
    { id: '5', title: '점심 식사', amount: 9000, category: '식비', date: dateOffset(-11) },
    { id: '6', title: '아메리카노', amount: 5000, category: '카페·배달', date: dateOffset(-13) },
    { id: '7', title: '버스', amount: 1500, category: '교통', date: dateOffset(-15) },
    { id: '8', title: '배달 저녁', amount: 14000, category: '카페·배달', date: dateOffset(-18) },
    { id: '9', title: '아메리카노', amount: 5000, category: '카페·배달', date: dateOffset(-20) },
    { id: '10', title: '점심 식사', amount: 10000, category: '식비', date: dateOffset(-23) },
    { id: '11', title: '아메리카노', amount: 5000, category: '카페·배달', date: dateOffset(-25) },
    { id: '12', title: '배달 저녁', amount: 16000, category: '카페·배달', date: dateOffset(-28) },
  ],
});

function normalizeProfile(value: any): Profile {
  const sample = sampleProfile();
  return {
    ...sample,
    ...value,
    expenses: Array.isArray(value?.expenses) ? value.expenses : sample.expenses,
    cashFlows: Array.isArray(value?.cashFlows) ? value.cashFlows : sample.cashFlows,
    goals: Array.isArray(value?.goals) ? value.goals : sample.goals,
    notifications: { ...sample.notifications, ...(value?.notifications ?? {}) },
  };
}

function numberFrom(text: string) {
  return Number(text.replace(/[^0-9]/g, '')) || 0;
}

function calculate(profile: Profile, days: number, monthlyCut = 0) {
  const variableDaily = profile.expenses.reduce((sum, item) => sum + item.amount, 0) / 30;
  const dailyCut = monthlyCut / 30;
  let balance = profile.balance;
  const daily: number[] = [];
  for (let d = 1; d <= days; d += 1) {
    const target = dateOffset(d);
    const flow = profile.cashFlows.filter((item) => item.date === target);
    balance += flow.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
    balance -= flow.filter((item) => item.type === 'fixed').reduce((sum, item) => sum + item.amount, 0);
    balance -= Math.max(0, variableDaily - dailyCut);
    daily.push(balance);
  }
  return daily;
}

function statusFor(profile: Profile, forecast: number[]) {
  const min30 = Math.min(...forecast.slice(0, 30));
  const riskDay = forecast.findIndex((amount) => amount <= profile.danger) + 1;
  if (riskDay > 0) return { label: '위험', color: '#E5484D', riskDay };
  if (min30 <= profile.warning) return { label: '경고', color: '#E79700', riskDay: 0 };
  return { label: '평온', color: '#12A36D', riskDay: 0 };
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [tab, setTab] = useState<Tab>('past');
  const [myView, setMyView] = useState<MyView>('home');
  const [profile, setProfile] = useState<Profile>(sampleProfile());
  const [email, setEmail] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState<Category>('카페·배달');
  const [cutAmount, setCutAmount] = useState('40000');

  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY).then((saved) => {
      if (saved) setProfile(normalizeProfile(JSON.parse(saved)));
      setTimeout(() => setReady(true), 2600);
    });
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(STORE_KEY, JSON.stringify(profile));
  }, [profile, ready]);

  const forecast = useMemo(() => calculate(profile, 90), [profile]);
  const status = useMemo(() => statusFor(profile, forecast), [profile, forecast]);
  const categoryTotals = useMemo(() => categories.map((category) => ({
    category,
    total: profile.expenses.filter((item) => item.category === category).reduce((sum, item) => sum + item.amount, 0),
  })), [profile.expenses]);
  const maxCategory = Math.max(...categoryTotals.map((item) => item.total), 1);
  const repeat = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    profile.expenses.forEach((item) => {
      const prior = map.get(item.title) ?? { count: 0, amount: 0 };
      map.set(item.title, { count: prior.count + 1, amount: prior.amount + item.amount });
    });
    return [...map.entries()].sort((a, b) => b[1].amount - a[1].amount)[0];
  }, [profile.expenses]);
  const cut = numberFrom(cutAmount);
  const afterForecast = useMemo(() => calculate(profile, 90, cut), [profile, cut]);
  const afterStatus = useMemo(() => statusFor(profile, afterForecast), [profile, afterForecast]);

  const updateNumber = (key: 'balance' | 'warning' | 'danger', value: string) => {
    setProfile((current) => ({ ...current, [key]: numberFrom(value) }));
  };
  const addExpense = () => {
    const amount = numberFrom(newAmount);
    if (!newTitle.trim() || amount <= 0) return Alert.alert('항목과 금액을 입력해 주세요.');
    setProfile((current) => ({
      ...current,
      expenses: [{ id: String(Date.now()), title: newTitle.trim(), amount, category: newCategory, date: dateOffset(0) }, ...current.expenses],
    }));
    setNewTitle('');
    setNewAmount('');
  };

  if (!ready) return <Splash />;
  if (!loggedIn) return <Login email={email} setEmail={setEmail} onLogin={() => setLoggedIn(true)} />;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.app}>
        {tab === 'past' && <Past profile={profile} setProfile={setProfile} newTitle={newTitle} setNewTitle={setNewTitle} newAmount={newAmount} setNewAmount={setNewAmount} category={newCategory} setCategory={setNewCategory} addExpense={addExpense} repeat={repeat} totals={categoryTotals} maxTotal={maxCategory} />}
        {tab === 'future' && <Future profile={profile} forecast={forecast} status={status} onWhatIf={() => setTab('whatif')} />}
        {tab === 'whatif' && <WhatIf cutAmount={cutAmount} setCutAmount={setCutAmount} forecast={forecast} afterForecast={afterForecast} status={status} afterStatus={afterStatus} />}
        {tab === 'my' && myView === 'home' && <My profile={profile} onOpen={setMyView} />}
        {tab === 'my' && myView === 'risk' && <RiskSettings profile={profile} setProfile={setProfile} onBack={() => setMyView('home')} />}
        {tab === 'my' && myView === 'goals' && <GoalSettings profile={profile} setProfile={setProfile} onBack={() => setMyView('home')} />}
        {tab === 'my' && myView === 'notifications' && <NotificationSettings profile={profile} setProfile={setProfile} onBack={() => setMyView('home')} />}
        {tab === 'my' && myView === 'data' && <DataSettings profile={profile} setProfile={setProfile} onBack={() => setMyView('home')} />}
      </View>
      <Nav tab={tab} setTab={(nextTab) => { setTab(nextTab); if (nextTab === 'my') setMyView('home'); }} />
    </SafeAreaView>
  );
}

function Splash() {
  const offset = useRef(new Animated.Value(0)).current;
  const [step, setStep] = useState(0);
  const words = ['맡겨', '지켜', '불려', '늘려', '알려'];
  const wordHeight = 52;
  useEffect(() => {
    const animation = Animated.loop(Animated.timing(offset, { toValue: -wordHeight * words.length, duration: 2250, useNativeDriver: true }));
    animation.start();
    return () => animation.stop();
  }, [offset]);
  useEffect(() => {
    const timer = setInterval(() => setStep((current) => (current + 1) % 3), 750);
    return () => clearInterval(timer);
  }, []);
  return <SafeAreaView style={styles.safe}><View style={styles.splash}><View style={styles.reelStage}><Text style={styles.reelFixed}>돈</Text><View style={styles.reelPill}><Animated.View style={[styles.reelTrack, { transform: [{ translateY: offset }] }]}>{[...words, ...words].map((word, index) => <Text key={`${word}-${index}`} style={styles.reelWord}>{word}</Text>)}</Animated.View><View pointerEvents="none" style={styles.reelFadeTop} /><View pointerEvents="none" style={styles.reelFadeBottom} /></View><Text style={styles.reelFixed}>조</Text></View><Text style={styles.splashCopy}>나의 돈을 지켜조</Text><View style={styles.dots}>{[0, 1, 2].map((index) => <View key={index} style={[styles.dot, step === index && styles.dotActive]} />)}</View></View></SafeAreaView>;
}

function Login({ email, setEmail, onLogin }: { email: string; setEmail: (value: string) => void; onLogin: () => void }) {
  return <SafeAreaView style={styles.safe}><View style={styles.login}><Text style={styles.back}>‹</Text><Text style={styles.loginTitle}>돈의 미래,{`\n`}함께 볼까요?</Text><Label text="이메일"><TextInput value={email} onChangeText={setEmail} placeholder="이메일" keyboardType="email-address" style={styles.input} /></Label><Label text="비밀번호"><TextInput placeholder="비밀번호" secureTextEntry style={styles.input} /></Label><Primary text="로그인" onPress={onLogin} /><Text style={styles.or}>또는</Text><Secondary text="Google로 계속하기" /><Secondary text="Apple로 계속하기" /><Text style={styles.signUp}>계정이 없나요? <Text style={styles.link}>회원가입</Text></Text></View></SafeAreaView>;
}

function Past({ profile, setProfile, newTitle, setNewTitle, newAmount, setNewAmount, category, setCategory, addExpense, repeat, totals, maxTotal }: any) {
  return <ScrollView contentContainerStyle={styles.scroll}><Header title="돈 정보 입력" action="샘플 데이터" onAction={() => setProfile(sampleProfile())} />
    <Card><Label text="현재 사용 가능 잔액"><MoneyInput value={profile.balance} onChange={(value: string) => setProfile({ ...profile, balance: numberFrom(value) })} /></Label><Label text="경고 잔액"><MoneyInput value={profile.warning} onChange={(value: string) => setProfile({ ...profile, warning: numberFrom(value) })} /></Label><Label text="위험 잔액"><MoneyInput value={profile.danger} onChange={(value: string) => setProfile({ ...profile, danger: numberFrom(value) })} /></Label></Card>
    <Card><Text style={styles.cardTitle}>✦ 소비 패턴 분석</Text>{repeat && <Text style={styles.repeat}>{repeat[0]} {repeat[1].count}회 · {won(repeat[1].amount)}</Text>}{totals.map((item: any) => <View key={item.category} style={styles.barRow}><Text style={styles.barLabel}>{item.category}</Text><View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.max(4, item.total / maxTotal * 100)}%` }]} /></View><Text style={styles.barAmount}>{won(item.total)}</Text></View>)}<Text style={styles.analysis}>최근 지출을 기준으로 반복 소비를 분석했어요.</Text></Card>
    <Card><Text style={styles.cardTitle}>최근 지출 추가</Text><TextInput value={newTitle} onChangeText={setNewTitle} placeholder="사용처·항목" style={styles.input} /><TextInput value={newAmount} onChangeText={setNewAmount} placeholder="금액" keyboardType="number-pad" style={styles.input} /><View style={styles.categoryRow}>{categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.category, category === item && styles.categorySelected]}><Text style={[styles.categoryText, category === item && styles.categoryTextSelected]}>{item}</Text></Pressable>)}</View><Primary text="지출 추가" onPress={addExpense} /></Card>
    <Card><ListRow icon="↓" text="예정 수입" /><ListRow icon="↑" text="고정지출" /><ListRow icon="◎" text="목표" /></Card>
  </ScrollView>;
}

function Future({ profile, forecast, status, onWhatIf }: any) {
  const day = (number: number) => forecast[number - 1] ?? 0;
  return <ScrollView contentContainerStyle={styles.scroll}><Header title="돈의 미래" /><Card style={[styles.statusCard, { borderColor: status.color }]}><Text style={styles.statusLine}>이대로면 위험 기준까지</Text><Text style={[styles.dDay, { color: status.color }]}>{status.riskDay ? `D-${status.riskDay}` : status.label === '경고' ? '경고' : '안전'}</Text><Tag text={status.label} color={status.color} /></Card><View style={styles.metricWrap}>{[7, 14, 30].map((dayNumber) => <View key={dayNumber} style={styles.metric}><Text>{dayNumber}일 후</Text><Text style={[styles.metricValue, day(dayNumber) < 0 && styles.red]}>{won(day(dayNumber))}</Text></View>)}</View><Card><Text style={styles.cardTitle}>✦ AI 인사이트</Text><Text style={styles.repeat}>아메리카노 8번 · 40,000원</Text><Text style={styles.description}>이 지출을 줄이면 위험 시점을 늦출 수 있어요.</Text><Primary text="이만큼 줄이면?" onPress={onWhatIf} /></Card><Card><Text style={styles.cardTitle}>🎓 교환학생 <Text style={styles.mint}>62%</Text></Text><View style={styles.goalTrack}><View style={styles.goalFill} /></View><Text style={styles.description}>6,200,000원 / 10,000,000원</Text><Text style={styles.description}>목표 기간 2025.09 ~ 2026.08</Text></Card></ScrollView>;
}

function WhatIf({ cutAmount, setCutAmount, forecast, afterForecast, status, afterStatus }: any) {
  const before = status.riskDay ? `D-${status.riskDay}` : '안전';
  const after = afterStatus.riskDay ? `D-${afterStatus.riskDay}` : '안전';
  return <ScrollView contentContainerStyle={styles.scroll}><Header title="만약에" /><Card><Text style={styles.cardTitle}>☕ 카페·배달</Text><Label text="월 소비 감소액"><TextInput value={cutAmount} onChangeText={setCutAmount} keyboardType="number-pad" style={styles.input} /></Label><Text style={styles.description}>감소분을 교환학생 목표에 반영합니다.</Text></Card><Card><View style={styles.compare}><View><Text style={styles.description}>기존</Text><Text style={styles.compareValue}>{before}</Text></View><Text style={styles.arrow}>→</Text><View><Text style={styles.description}>변경 후</Text><Text style={[styles.compareValue, styles.mint]}>{after}</Text></View></View><View style={styles.divider} /><Text style={styles.description}>30일 후 잔액: {won(forecast[29] ?? 0)} → {won(afterForecast[29] ?? 0)}</Text></Card><Card style={styles.goodCard}><Text style={styles.goodText}>이렇게 줄이면 위험 시점이 늦춰지고, 목표 달성일도 빨라져요.</Text></Card></ScrollView>;
}

function My({ profile, onOpen }: { profile: Profile; onOpen: (view: MyView) => void }) {
  const score = Math.min(1000, Math.max(0, Math.round((profile.balance - profile.danger) / Math.max(profile.warning, 1) * 350)));
  const nextLevel = Math.max(0, 1000 - score);
  return <ScrollView contentContainerStyle={styles.scroll}><Header title="마이" /><View style={styles.profileRow}><View style={styles.avatar}><Text style={styles.avatarText}>●</Text></View><Text style={styles.name}>명진님</Text></View><Card style={styles.balanceCard}><Text style={styles.description}>이번 달 안전 여유</Text><Text style={styles.balanceValue}>{won(Math.max(0, profile.balance - profile.warning))}</Text><Text style={styles.mint}>✦ 현재 입력한 돈 정보 기준이에요</Text></Card><Card><Text style={styles.cardTitle}>절약 점수 <Text style={styles.mint}>{score}점</Text></Text><View style={styles.goalTrack}><View style={[styles.goalFill, { width: `${Math.min(score / 10, 100)}%` }]} /></View><Text style={styles.description}>다음 레벨까지 {nextLevel}점 · 목표와 지출을 기록할수록 점수가 갱신돼요.</Text></Card><Card><ListRow icon="◈" text="내 위험 기준" action="설정" onPress={() => onOpen('risk')} /><ListRow icon="◎" text="목표 관리" action="추가" onPress={() => onOpen('goals')} /><ListRow icon="♧" text="알림 설정" action="설정" onPress={() => onOpen('notifications')} /><ListRow icon="▣" text="데이터 관리" action="관리" onPress={() => onOpen('data')} /></Card><Pressable onPress={() => Alert.alert('로그아웃', '이 시안에서는 로그인 화면으로 돌아가지 않습니다.')}><Text style={styles.logout}>로그아웃</Text></Pressable></ScrollView>;
}

function RiskSettings({ profile, setProfile, onBack }: { profile: Profile; setProfile: (profile: Profile) => void; onBack: () => void }) {
  return <ScrollView contentContainerStyle={styles.scroll}><Header title="내 위험 기준" action="마이로" onAction={onBack} /><Card><Text style={styles.cardTitle}>잔액 기준 설정</Text><Label text="경고 잔액"><MoneyInput value={profile.warning} onChange={(value) => setProfile({ ...profile, warning: numberFrom(value) })} /></Label><Label text="위험 잔액"><MoneyInput value={profile.danger} onChange={(value) => setProfile({ ...profile, danger: numberFrom(value) })} /></Label><Text style={styles.description}>미래 잔액이 이 기준에 닿으면 경고와 위험 상태를 표시해요.</Text><Primary text="위험 기준 저장" onPress={() => { Alert.alert('저장했어요', '새 위험 기준이 미래 예측에 반영됐습니다.'); onBack(); }} /></Card></ScrollView>;
}

function GoalSettings({ profile, setProfile, onBack }: { profile: Profile; setProfile: (profile: Profile) => void; onBack: () => void }) {
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('');
  const [targetDate, setTargetDate] = useState(dateOffset(180));
  const addGoal = () => {
    const targetAmount = numberFrom(target);
    if (!title.trim() || targetAmount <= 0) return Alert.alert('목표명과 목표 금액을 입력해 주세요.');
    setProfile({ ...profile, goals: [...profile.goals, { id: String(Date.now()), title: title.trim(), targetAmount, savedAmount: numberFrom(saved), targetDate }] });
    setTitle(''); setTarget(''); setSaved(''); setTargetDate(dateOffset(180));
  };
  return <ScrollView contentContainerStyle={styles.scroll}><Header title="목표 관리" action="마이로" onAction={onBack} /><Card><Text style={styles.cardTitle}>새 목표 추가</Text><TextInput value={title} onChangeText={setTitle} placeholder="목표명 (예: 여행 자금)" style={styles.input} /><TextInput value={target} onChangeText={setTarget} placeholder="목표 금액" keyboardType="number-pad" style={[styles.input, styles.formGap]} /><TextInput value={saved} onChangeText={setSaved} placeholder="현재 모은 금액" keyboardType="number-pad" style={[styles.input, styles.formGap]} /><TextInput value={targetDate} onChangeText={setTargetDate} placeholder="목표일 YYYY-MM-DD" style={[styles.input, styles.formGap]} /><Primary text="목표 추가" onPress={addGoal} /></Card>{profile.goals.map((goal) => <Card key={goal.id}><View style={styles.goalHeader}><View><Text style={styles.cardTitle}>{goal.title}</Text><Text style={styles.description}>{won(goal.savedAmount)} / {won(goal.targetAmount)} · {goal.targetDate}</Text></View><Pressable onPress={() => setProfile({ ...profile, goals: profile.goals.filter((item) => item.id !== goal.id) })}><Text style={styles.removeText}>삭제</Text></Pressable></View><View style={styles.goalTrack}><View style={[styles.goalFill, { width: `${Math.min(100, goal.savedAmount / Math.max(goal.targetAmount, 1) * 100)}%` }]} /></View></Card>)}</ScrollView>;
}

function NotificationSettings({ profile, setProfile, onBack }: { profile: Profile; setProfile: (profile: Profile) => void; onBack: () => void }) {
  const setNotification = (key: keyof Notifications, value: boolean) => setProfile({ ...profile, notifications: { ...profile.notifications, [key]: value } });
  return <ScrollView contentContainerStyle={styles.scroll}><Header title="알림 설정" action="마이로" onAction={onBack} /><Card><View style={styles.switchRow}><View><Text style={styles.listText}>위험 기준 알림</Text><Text style={styles.description}>잔액이 경고·위험 기준에 가까워지면 알려드려요.</Text></View><Switch value={profile.notifications.risk} onValueChange={(value) => setNotification('risk', value)} trackColor={{ false: '#DCE8FA', true: '#9DC0FF' }} thumbColor={profile.notifications.risk ? '#2563EB' : '#FFFFFF'} /></View><View style={styles.switchRow}><View><Text style={styles.listText}>목표 진행 알림</Text><Text style={styles.description}>목표 달성에 가까워졌을 때 알려드려요.</Text></View><Switch value={profile.notifications.goal} onValueChange={(value) => setNotification('goal', value)} trackColor={{ false: '#DCE8FA', true: '#9DC0FF' }} thumbColor={profile.notifications.goal ? '#2563EB' : '#FFFFFF'} /></View></Card><Primary text="알림 설정 저장" onPress={() => { Alert.alert('저장했어요', '알림 설정을 기기에 저장했습니다.'); onBack(); }} /></ScrollView>;
}

function DataSettings({ profile, setProfile, onBack }: { profile: Profile; setProfile: (profile: Profile) => void; onBack: () => void }) {
  const clear = () => Alert.alert('입력 데이터 전체 삭제', '지출, 예정 수입·고정지출, 목표가 삭제됩니다.', [{ text: '취소', style: 'cancel' }, { text: '삭제', style: 'destructive', onPress: () => setProfile({ ...profile, expenses: [], cashFlows: [], goals: [] }) }]);
  return <ScrollView contentContainerStyle={styles.scroll}><Header title="데이터 관리" action="마이로" onAction={onBack} /><Card><Text style={styles.cardTitle}>저장된 데이터</Text><Text style={styles.description}>최근 지출 {profile.expenses.length}건 · 예정 수입·고정지출 {profile.cashFlows.length}건 · 목표 {profile.goals.length}개</Text><Text style={styles.description}>입력한 데이터는 현재 이 기기에 저장됩니다.</Text></Card><Secondary text="샘플 데이터로 초기화" onPress={() => setProfile(sampleProfile())} /><Pressable style={styles.dangerButton} onPress={clear}><Text style={styles.dangerButtonText}>입력 데이터 전체 삭제</Text></Pressable></ScrollView>;
}

function Header({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) { return <View style={styles.header}><View><Text style={styles.brand}>돈__조</Text><Text style={styles.title}>{title}</Text></View>{action && <Pressable style={styles.headerAction} onPress={onAction}><Text style={styles.headerActionText}>{action}</Text></Pressable>}</View>; }
function Nav({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) { const items: { key: Tab; icon: string; label: string }[] = [{ key: 'past', icon: '◷', label: '과거' }, { key: 'future', icon: '↗', label: '미래' }, { key: 'whatif', icon: '✦', label: '만약에' }, { key: 'my', icon: '●', label: '마이' }]; return <View style={styles.nav}>{items.map((item) => <Pressable key={item.key} style={styles.navItem} onPress={() => setTab(item.key)}><Text style={[styles.navIcon, tab === item.key && styles.navActive]}>{item.icon}</Text><Text style={[styles.navLabel, tab === item.key && styles.navActive]}>{item.label}</Text></Pressable>)}</View>; }
function Card({ children, style }: { children: any; style?: any }) { return <View style={[styles.card, style]}>{children}</View>; }
function Label({ text, children }: { text: string; children: any }) { return <View style={styles.labelWrap}><Text style={styles.label}>{text}</Text>{children}</View>; }
function MoneyInput({ value, onChange }: { value: number; onChange: (value: string) => void }) { return <TextInput value={String(value)} onChangeText={onChange} keyboardType="number-pad" style={styles.input} />; }
function Primary({ text, onPress }: { text: string; onPress?: () => void }) { return <Pressable style={styles.primary} onPress={onPress}><Text style={styles.primaryText}>{text}</Text></Pressable>; }
function Secondary({ text, onPress }: { text: string; onPress?: () => void }) { return <Pressable style={styles.secondary} onPress={onPress}><Text style={styles.secondaryText}>{text}</Text></Pressable>; }
function ListRow({ icon, text, action = '+ 추가', onPress }: { icon: string; text: string; action?: string; onPress?: () => void }) { const body = <><Text style={styles.listIcon}>{icon}</Text><Text style={styles.listText}>{text}</Text><Text style={styles.listPlus}>{action}</Text></>; return onPress ? <Pressable style={styles.listRow} onPress={onPress}>{body}</Pressable> : <View style={styles.listRow}>{body}</View>; }
function Tag({ text, color }: { text: string; color: string }) { return <View style={[styles.tag, { backgroundColor: `${color}18` }]}><Text style={[styles.tagText, { color }]}>{text}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F9FF' }, app: { flex: 1 }, splash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 }, reelStage: { flexDirection: 'row', alignItems: 'center', gap: 16 }, reelFixed: { fontSize: 58, fontWeight: '800', color: '#1463E9' }, reelPill: { width: 116, height: 260, borderRadius: 31, overflow: 'hidden', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B9D2FF', shadowColor: '#2563EB', shadowOpacity: 0.17, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 }, reelTrack: { position: 'absolute', top: 0, left: 0, right: 0 }, reelWord: { height: 52, color: '#2563EB', fontSize: 29, fontWeight: '800', textAlign: 'center', lineHeight: 52 }, reelFadeTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 78, backgroundColor: 'rgba(246,249,255,0.78)' }, reelFadeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 78, backgroundColor: 'rgba(246,249,255,0.78)' }, splashCopy: { fontSize: 19, color: '#102A43', fontWeight: '700', marginTop: 10 }, dots: { flexDirection: 'row', gap: 12, marginTop: 88 }, dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#B8D1FF' }, dotActive: { backgroundColor: '#1463E9' }, login: { flex: 1, padding: 28, justifyContent: 'center', gap: 12 }, back: { fontSize: 42, color: '#102A43', marginBottom: 14 }, loginTitle: { fontSize: 31, fontWeight: '800', color: '#102A43', lineHeight: 41, marginBottom: 20 }, input: { borderWidth: 1, borderColor: '#C9DCF9', backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: '#102A43' }, formGap: { marginTop: 10 }, labelWrap: { marginBottom: 12 }, label: { color: '#102A43', fontWeight: '700', marginBottom: 7 }, primary: { backgroundColor: '#2563EB', borderRadius: 12, alignItems: 'center', paddingVertical: 15, marginTop: 4 }, primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }, secondary: { borderWidth: 1, borderColor: '#B9D2FF', backgroundColor: '#FFFFFF', borderRadius: 12, alignItems: 'center', paddingVertical: 13, marginTop: 8 }, secondaryText: { color: '#102A43', fontSize: 16, fontWeight: '700' }, or: { textAlign: 'center', color: '#667085', marginTop: 8 }, signUp: { textAlign: 'center', color: '#667085', marginTop: 20 }, link: { color: '#2563EB', fontWeight: '800' }, scroll: { padding: 20, paddingBottom: 24, gap: 12 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }, brand: { color: '#2563EB', fontSize: 19, fontWeight: '800', marginBottom: 7 }, title: { color: '#102A43', fontSize: 29, fontWeight: '800', letterSpacing: -1 }, headerAction: { borderWidth: 1, borderColor: '#2563EB', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 }, headerActionText: { color: '#2563EB', fontWeight: '800' }, card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8FA', borderRadius: 18, padding: 15 }, cardTitle: { fontSize: 16, color: '#102A43', fontWeight: '800', marginBottom: 10 }, repeat: { fontSize: 20, fontWeight: '800', color: '#102A43', marginBottom: 10 }, barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7 }, barLabel: { width: 61, color: '#667085', fontSize: 12 }, barTrack: { flex: 1, height: 6, borderRadius: 4, backgroundColor: '#E6EDF9', overflow: 'hidden' }, barFill: { height: 6, borderRadius: 4, backgroundColor: '#2563EB' }, barAmount: { width: 58, textAlign: 'right', color: '#667085', fontSize: 11 }, analysis: { marginTop: 12, color: '#E5484D', fontWeight: '700', fontSize: 13 }, categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 }, category: { borderWidth: 1, borderColor: '#D8E5FA', borderRadius: 18, paddingHorizontal: 9, paddingVertical: 7 }, categorySelected: { backgroundColor: '#EAF2FF', borderColor: '#2563EB' }, categoryText: { color: '#667085', fontSize: 12 }, categoryTextSelected: { color: '#2563EB', fontWeight: '800' }, listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#ECF1FA' }, listIcon: { color: '#2563EB', width: 28, fontSize: 17 }, listText: { flex: 1, color: '#102A43', fontWeight: '700' }, listPlus: { color: '#2563EB', fontWeight: '700' }, statusCard: { minHeight: 120 }, statusLine: { color: '#102A43', fontWeight: '700' }, dDay: { fontSize: 45, fontWeight: '800', marginTop: 5 }, tag: { position: 'absolute', right: 15, top: 15, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 }, tagText: { fontWeight: '800' }, metricWrap: { flexDirection: 'row', gap: 8 }, metric: { flex: 1, padding: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8FA', borderRadius: 14, alignItems: 'center' }, metricValue: { fontWeight: '800', color: '#102A43', fontSize: 13, marginTop: 7 }, red: { color: '#E5484D' }, description: { color: '#667085', lineHeight: 20, marginBottom: 10 }, mint: { color: '#12A36D', fontWeight: '800' }, goalTrack: { backgroundColor: '#E4EBF5', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 10 }, goalFill: { width: '62%', height: 8, borderRadius: 4, backgroundColor: '#12A36D' }, goalHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, removeText: { color: '#E5484D', fontWeight: '800', paddingVertical: 2 }, switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 8 }, compare: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', textAlign: 'center' }, compareValue: { color: '#2563EB', fontSize: 33, fontWeight: '800', textAlign: 'center', marginTop: 5 }, arrow: { color: '#667085', fontSize: 26 }, divider: { height: 1, backgroundColor: '#E6EDF9', marginVertical: 14 }, goodCard: { backgroundColor: '#F0FBF6', borderColor: '#BCECD6' }, goodText: { color: '#0E7C55', lineHeight: 21, fontWeight: '700' }, profileRow: { flexDirection: 'row', alignItems: 'center', gap: 13, marginVertical: 5 }, avatar: { width: 55, height: 55, borderRadius: 28, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' }, avatarText: { color: '#FFFFFF', fontSize: 25 }, name: { fontSize: 21, color: '#102A43', fontWeight: '800' }, balanceCard: { backgroundColor: '#F5F9FF', borderColor: '#C7DBFC' }, balanceValue: { color: '#2563EB', fontSize: 31, fontWeight: '800', marginVertical: 5 }, dangerButton: { borderWidth: 1, borderColor: '#F1B5B8', backgroundColor: '#FFFFFF', borderRadius: 12, alignItems: 'center', paddingVertical: 14, marginTop: 8 }, dangerButtonText: { color: '#E5484D', fontSize: 16, fontWeight: '800' }, logout: { textAlign: 'center', color: '#E5484D', fontWeight: '800', padding: 18 }, nav: { flexDirection: 'row', height: 72, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#DCE8FA', paddingBottom: 6 }, navItem: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 3 }, navIcon: { color: '#7A879C', fontSize: 21 }, navLabel: { color: '#7A879C', fontSize: 11 }, navActive: { color: '#2563EB', fontWeight: '800' },
});
