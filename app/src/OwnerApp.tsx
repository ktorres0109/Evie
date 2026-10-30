/**
 * The owner app: four tabs and the raised Log button, a stack of pushed
 * screens, the full log sheet and the quick one-category sheets.
 */
import { useEffect, type ReactNode } from 'react'
import { ArticleScreen } from './screens/ArticleScreen'
import { Insights as ArticleLibrary } from './screens/Insights'
import { CalendarTab } from './screens/owner/CalendarTab'
import { FertilityScreen, FertilitySetupScreen } from './screens/owner/FertilityScreens'
import { InsightsTab } from './screens/owner/InsightsTab'
import { LogSheet, QuickSheet } from './screens/owner/LogSheet'
import { TodayScreen } from './screens/owner/TodayScreen'
import { DoctorReportScreen } from './screens/owner/DoctorReportScreen'
import { WhyScreen } from './screens/owner/WhyScreen'
import { YouTab } from './screens/owner/YouTab'
import { MethodScreen } from './screens/owner/MethodScreen'
import { LifeScreen } from './screens/owner/LifeScreen'
import { PregnancyScreen } from './screens/owner/PregnancyScreen'
import { PrivacyScreen } from './screens/owner/PrivacyScreen'
import { CompanionScreen } from './screens/owner/CompanionScreen'
import { HistoryScreen } from './screens/owner/HistoryScreen'
import { AboutScreen, AppearanceScreen, LockScreen, NotificationsScreen } from './screens/owner/SettingsScreens'
import { PartnerOwnerScreen, PartnerPairScreen } from './partner/OwnerScreens'
import { useT } from './i18n'
import { setBackFallback } from './lib/back'
import { useApp } from './state/appStore'
import { useNav, type Route } from './state/nav'
import type { Prefs } from './state/prefs'
import { useCycleData, type CycleData } from './state/useCycle'
import { NavBar } from './ui/NavBar'
import { Screen, useBackButton } from './ui/kit'
import { usePartnerAutoUpload } from './partner/sync'

function LegacyOverlay({ children, onBack }: { children: ReactNode; onBack: () => void }) {
  useBackButton(onBack)
  return <>{children}</>
}

function RouteView({ route, data, prefs, locked }: { route: Route; data: CycleData; prefs: Prefs; locked: boolean }) {
  const t = useT()
  const { pop } = useNav()
  switch (route.name) {
    case 'why':
      return <WhyScreen data={data} />
    case 'fertility':
      return <FertilityScreen data={data} />
    case 'fertility-setup':
      return <FertilitySetupScreen />
    case 'method':
      return <MethodScreen data={data} />
    case 'life':
      return <LifeScreen data={data} />
    case 'pregnancy':
      return <PregnancyScreen data={data} />
    case 'privacy':
      return <PrivacyScreen />
    case 'partner':
      return <PartnerOwnerScreen data={data} />
    case 'partner-pair':
      return <PartnerPairScreen />
    case 'companion':
      return <CompanionScreen data={data} />
    case 'history':
      return <HistoryScreen data={data} />
    case 'appearance':
      return <AppearanceScreen prefs={prefs} />
    case 'notifications':
      return <NotificationsScreen prefs={prefs} data={data} />
    case 'lock':
      return <LockScreen locked={locked} />
    case 'about':
      return <AboutScreen />
    case 'doctor-report':
      return <DoctorReportScreen data={data} />
    case 'articles':
      return (
        <Screen title={t('you.articles')} onBack={pop}>
          <ArticleLibrary />
        </Screen>
      )
    case 'article':
      return (
        <LegacyOverlay onBack={pop}>
          <ArticleScreen slug={route.slug} onClose={pop} />
        </LegacyOverlay>
      )
  }
}

export function OwnerApp({ prefs, locked }: { prefs: Prefs; locked: boolean }) {
  const data = useCycleData()
  const { tab, stack, setTab, logDate, closeLog, openLog, quick, closeQuick } = useNav()
  const articleSlug = useApp((s) => s.articleSlug)
  const setArticleSlug = useApp((s) => s.setArticleSlug)
  usePartnerAutoUpload(data)

  // Back from a non-Today tab returns to Today before leaving the app.
  useEffect(() => {
    if (tab === 'today') return
    return useBackButtonFallback(() => setTab('today'))
  }, [tab, setTab])

  // The upstream article library opens articles through the old store.
  useEffect(() => {
    if (!articleSlug) return
    useNav.getState().push({ name: 'article', slug: articleSlug })
    setArticleSlug(null)
  }, [articleSlug, setArticleSlug])

  if (!data) return <div className="mz-app" role="status" aria-busy="true" />

  const top = stack.at(-1)
  return (
    <div className="mz-app">
      <main className="mz-main" aria-hidden={top ? true : undefined}>
        {tab === 'today' && <TodayScreen data={data} prefs={prefs} locked={locked} />}
        {tab === 'calendar' && <CalendarTab data={data} prefs={prefs} />}
        {tab === 'insights' && <InsightsTab data={data} />}
        {tab === 'you' && <YouTab data={data} prefs={prefs} />}
      </main>
      <NavBar role="owner" active={tab} onChange={setTab} onLog={() => openLog(data.today)} />
      {top && <RouteView key={stack.length} route={top} data={data} prefs={prefs} locked={locked} />}
      {logDate && <LogSheet date={logDate} onClose={closeLog} />}
      {quick && <QuickSheet kind={quick.kind} date={quick.date} onClose={closeQuick} />}
    </div>
  )
}

/** Install a temporary fallback for the hardware back button. */
function useBackButtonFallback(fn: () => void): () => void {
  setBackFallback(fn)
  return () => setBackFallback(null)
}
