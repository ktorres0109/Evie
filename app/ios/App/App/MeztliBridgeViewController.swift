import Capacitor

@objc(MeztliBridgeViewController)
final class MeztliBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(MeztliNativePlugin())
    }
}

