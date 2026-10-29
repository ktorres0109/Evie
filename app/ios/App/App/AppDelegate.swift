import UIKit
import Capacitor
import BackgroundTasks
import WidgetKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private var privacyCover: UIView?
    private let widgetRefreshTaskIdentifier = "io.github.ktorres0109.cycle.widget-refresh"

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: widgetRefreshTaskIdentifier,
            using: nil
        ) { [weak self] task in
            guard let self, let refreshTask = task as? BGAppRefreshTask else {
                task.setTaskCompleted(success: false)
                return
            }
            self.handleWidgetRefresh(refreshTask)
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Cover the app so the switcher shows a blank card instead of health data.
        let hide = UserDefaults.standard.object(forKey: MeztliNativePlugin.privacyScreenKey) as? Bool ?? true
        guard hide, privacyCover == nil, let window else { return }
        let cover = UIView(frame: window.bounds)
        cover.backgroundColor = UIColor(red: 0x14 / 255.0, green: 0x11 / 255.0, blue: 0x1C / 255.0, alpha: 1)
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        window.addSubview(cover)
        privacyCover = cover
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        scheduleWidgetRefresh()
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        privacyCover?.removeFromSuperview()
        privacyCover = nil
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    private func scheduleWidgetRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: widgetRefreshTaskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 6 * 60 * 60)
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            // Scheduling is opportunistic and may be declined by the system.
        }
    }

    private func handleWidgetRefresh(_ task: BGAppRefreshTask) {
        scheduleWidgetRefresh()
        task.expirationHandler = {}

        // The native task can safely refresh the last redacted snapshot without
        // launching the WebView or reading Meztli's private cycle database.
        WidgetCenter.shared.reloadAllTimelines()
        task.setTaskCompleted(success: true)
    }

}
