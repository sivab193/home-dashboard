import Foundation

let bundle = CFBundleCreate(
    kCFAllocatorDefault,
    URL(fileURLWithPath: "/System/Library/PrivateFrameworks/MediaRemote.framework") as CFURL
)

typealias GetInfoFn = @convention(c) (DispatchQueue, @escaping ([String: Any]?) -> Void) -> Void
typealias SendCmdFn = @convention(c) (UInt32, UnsafeRawPointer?) -> Bool

func getPtr(_ name: String) -> UnsafeMutableRawPointer? {
    guard let bundle else { return nil }
    return CFBundleGetFunctionPointerForName(bundle, name as CFString)
}

func emitJson(_ obj: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: obj, options: []),
       let str = String(data: data, encoding: .utf8) {
        print(str)
    }
}

func getStatus() {
    guard let infoPtr = getPtr("MRMediaRemoteGetNowPlayingInfo") else {
        emitJson(["available": false, "state": "unsupported"])
        return
    }
    let getInfo = unsafeBitCast(infoPtr, to: GetInfoFn.self)
    let sem = DispatchSemaphore(value: 0)
    var payload: [String: Any] = ["available": false, "state": "not_open"]

    getInfo(DispatchQueue.global()) { info in
        if let info, let title = info["kMRMediaRemoteNowPlayingInfoTitle"] as? String, !title.isEmpty {
            let rate = (info["kMRMediaRemoteNowPlayingInfoPlaybackRate"] as? NSNumber)?.doubleValue ?? 0.0
            let duration = (info["kMRMediaRemoteNowPlayingInfoDuration"] as? NSNumber)?.doubleValue ?? 0.0
            let elapsed = (info["kMRMediaRemoteNowPlayingInfoElapsedTime"] as? NSNumber)?.doubleValue ?? 0.0
            let ts = info["kMRMediaRemoteNowPlayingInfoTimestamp"] as? Date
            let liveElapsed = (rate > 0.0 && ts != nil)
                ? elapsed + max(0.0, Date().timeIntervalSince(ts!)) * rate
                : elapsed
            let artist = (info["kMRMediaRemoteNowPlayingInfoArtist"] as? String) ?? ""
            let album = (info["kMRMediaRemoteNowPlayingInfoAlbum"] as? String) ?? ""
            payload = [
                "available": true,
                "state": rate > 0.0 ? "playing" : "paused",
                "title": title,
                "artist": artist,
                "album": album,
                "duration": max(0, Int(duration.rounded())),
                "position": max(0, Int(liveElapsed.rounded())),
                "browser": "Mac Now Playing",
                "source": "MediaRemote",
            ]
        }
        sem.signal()
    }
    _ = sem.wait(timeout: .now() + 1.5)
    emitJson(payload)
}

func sendMediaCommand(_ code: UInt32, _ cmd: String) {
    guard let ptr = getPtr("MRMediaRemoteSendCommand") else {
        emitJson(["ok": false, "error": "MediaRemoteSendCommand unavailable"])
        return
    }
    let sendCmd = unsafeBitCast(ptr, to: SendCmdFn.self)
    let ok = sendCmd(code, nil)
    if ok {
        RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.25))
    }
    emitJson(["ok": ok, "command": cmd])
}

let args = CommandLine.arguments
let cmd = args.count > 1 ? args[1] : "status"

switch cmd {
case "status":
    getStatus()
case "toggle", "play_pause":
    sendMediaCommand(2, cmd) // kMRTogglePlayPause
case "play":
    sendMediaCommand(0, cmd) // kMRPlay
case "pause":
    sendMediaCommand(1, cmd) // kMRPause
case "next":
    sendMediaCommand(4, cmd) // kMRNextTrack
case "previous", "prev":
    sendMediaCommand(5, cmd) // kMRPreviousTrack
default:
    emitJson(["ok": false, "error": "Unknown command"])
    exit(2)
}
