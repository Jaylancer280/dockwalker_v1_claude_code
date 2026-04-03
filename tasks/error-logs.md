Incident Identifier: A2D55921-A0D8-412F-8AB1-E45797438090
Distributor ID: com.apple.TestFlight
Hardware Model: iPhone18,1
Process: DockWalker [11253]
Path: /private/var/containers/Bundle/Application/5200E4EB-9D62-4915-9C9D-0FFD257B2697/DockWalker.app/DockWalker
Identifier: io.dockwalker.app
Version: 1.0.0 (23)
AppStoreTools: 17E187
AppVariant: 1:iPhone18,1:26
Beta: YES
Code Type: ARM-64 (Native)
Role: Foreground
Parent Process: launchd [1]
Coalition: io.dockwalker.app [660]

Date/Time: 2026-03-31 23:31:50.7222 +0300
Launch Time: 2026-03-31 23:31:50.6455 +0300
OS Version: iPhone OS 26.3 (23D127)
Release Type: User
Baseband Version: 1.40.03
Report Version: 104

Exception Type: EXC_CRASH (SIGABRT)
Exception Codes: 0x0000000000000000, 0x0000000000000000
Termination Reason: SIGNAL 6 Abort trap: 6
Terminating Process: DockWalker [11253]

Triggered by Thread: 7

Thread 0 name:
Thread 0:
0 libsystem_kernel.dylib 0x000000024f3eecd4 mach_msg2_trap + 8 (:-1)
1 libsystem_kernel.dylib 0x000000024f3f22f8 mach_msg2_internal + 76 (mach_msg.c:201)
2 libsystem_kernel.dylib 0x000000024f3f2214 mach_msg_overwrite + 428 (mach_msg.c:0)
3 libsystem_kernel.dylib 0x000000024f3f205c mach_msg + 24 (mach_msg.c:323)
4 CoreFoundation 0x00000001a18b5868 **CFRunLoopServiceMachPort + 160 (CFRunLoop.c:2650)
5 CoreFoundation 0x00000001a188c848 **CFRunLoopRun + 1188 (CFRunLoop.c:3035)
6 CoreFoundation 0x00000001a188ba6c \_CFRunLoopRunSpecificWithOptions + 532 (CFRunLoop.c:3462)
7 GraphicsServices 0x0000000246211498 GSEventRunModal + 120 (GSEvent.c:2049)
8 UIKitCore 0x00000001a733bdf8 -[UIApplication _run] + 792 (UIApplication.m:3904)
9 UIKitCore 0x00000001a72e4e54 UIApplicationMain + 336 (UIApplication.m:5579)
10 DockWalker 0x0000000102ba566c 0x102ba0000 + 22124
11 dyld 0x000000019e866e28 start + 7116 (dyldMain.cpp:1477)

Thread 1:

Thread 2:

Thread 3:

Thread 4:

Thread 5:

Thread 6 name:
Thread 6:
0 libsystem_kernel.dylib 0x000000024f3eecd4 mach_msg2_trap + 8 (:-1)
1 libsystem_kernel.dylib 0x000000024f3f22f8 mach_msg2_internal + 76 (mach_msg.c:201)
2 libsystem_kernel.dylib 0x000000024f3f2214 mach_msg_overwrite + 428 (mach_msg.c:0)
3 libsystem_kernel.dylib 0x000000024f3f205c mach_msg + 24 (mach_msg.c:323)
4 CoreFoundation 0x00000001a18b5868 **CFRunLoopServiceMachPort + 160 (CFRunLoop.c:2650)
5 CoreFoundation 0x00000001a188c848 **CFRunLoopRun + 1188 (CFRunLoop.c:3035)
6 CoreFoundation 0x00000001a188ba6c \_CFRunLoopRunSpecificWithOptions + 532 (CFRunLoop.c:3462)
7 Foundation 0x000000019f84bf54 -[NSRunLoop(NSRunLoop) runMode:beforeDate:] + 212 (NSRunLoop.m:375)
8 Foundation 0x000000019f84c12c -[NSRunLoop(NSRunLoop) runUntilDate:] + 64 (NSRunLoop.m:422)
9 UIKitCore 0x00000001a7311094 -[UIEventFetcher threadMain] + 408 (UIEventFetcher.m:1333)
10 Foundation 0x000000019ef0b21c **NSThread**start\_\_ + 732 (NSThread.m:997)
11 libsystem_pthread.dylib 0x00000001fe3e044c \_pthread_start + 136 (pthread.c:931)
12 libsystem_pthread.dylib 0x00000001fe3dc8cc thread_start + 8 (:-1)

Thread 7 name:
Thread 7 Crashed:
0 libsystem_kernel.dylib 0x000000024f3f90cc **pthread_kill + 8 (:-1)
1 libsystem_pthread.dylib 0x00000001fe3e3810 pthread_kill + 268 (pthread.c:1721)
2 libsystem_c.dylib 0x00000001ad210f64 abort + 124 (abort.c:122)
3 libc++abi.dylib 0x000000019e914808 **abort_message + 132 (abort_message.cpp:66)
4 libc++abi.dylib 0x000000019e90346c demangling_terminate_handler() + 280 (cxa_default_handlers.cpp:71)
5 libobjc.A.dylib 0x000000019e813f88 \_objc_terminate() + 172 (objc-exception.mm:499)
6 libc++abi.dylib 0x000000019e913bdc std::**terminate(void (\*)()) + 16 (cxa_handlers.cpp:59)
7 libc++abi.dylib 0x000000019e9175c8 **cxa_rethrow + 188 (cxa_exception.cpp:658)
8 libobjc.A.dylib 0x000000019e820558 objc_exception_rethrow + 44 (objc-exception.mm:399)
9 DockWalker 0x0000000102ec44a8 0x102ba0000 + 3294376
10 DockWalker 0x0000000102ec8f58 0x102ba0000 + 3313496
11 libdispatch.dylib 0x00000001da594adc \_dispatch_call_block_and_release + 32 (init.c:1575)
12 libdispatch.dylib 0x00000001da5ae7fc \_dispatch_client_callout + 16 (client_callout.mm:85)
13 libdispatch.dylib 0x00000001da59d468 \_dispatch_lane_serial_drain + 740 (queue.c:3991)
14 libdispatch.dylib 0x00000001da59df44 \_dispatch_lane_invoke + 388 (queue.c:4082)
15 libdispatch.dylib 0x00000001da5a83ec \_dispatch_root_queue_drain_deferred_wlh + 292 (queue.c:7265)
16 libdispatch.dylib 0x00000001da5a7ce4 \_dispatch_workloop_worker_thread + 692 (queue.c:6859)
17 libsystem_pthread.dylib 0x00000001fe3dd3b8 \_pthread_wqthread + 292 (pthread.c:2696)
18 libsystem_pthread.dylib 0x00000001fe3dc8c0 start_wqthread + 8 (:-1)

Thread 8:

Thread 9:

Thread 10:

Thread 11 name:
Thread 11:
0 libsystem_kernel.dylib 0x000000024f3eecd4 mach_msg2_trap + 8 (:-1)
1 libsystem_kernel.dylib 0x000000024f3f22f8 mach_msg2_internal + 76 (mach_msg.c:201)
2 libsystem_kernel.dylib 0x000000024f3f2214 mach_msg_overwrite + 428 (mach_msg.c:0)
3 libsystem_kernel.dylib 0x000000024f3f205c mach_msg + 24 (mach_msg.c:323)
4 CoreFoundation 0x00000001a18b5868 **CFRunLoopServiceMachPort + 160 (CFRunLoop.c:2650)
5 CoreFoundation 0x00000001a188c848 **CFRunLoopRun + 1188 (CFRunLoop.c:3035)
6 CoreFoundation 0x00000001a188ba6c \_CFRunLoopRunSpecificWithOptions + 532 (CFRunLoop.c:3462)
7 DockWalker 0x0000000102f75994 0x102ba0000 + 4020628
8 Foundation 0x000000019ef0b21c **NSThread**start\_\_ + 732 (NSThread.m:997)
9 libsystem_pthread.dylib 0x00000001fe3e044c \_pthread_start + 136 (pthread.c:931)
10 libsystem_pthread.dylib 0x00000001fe3dc8cc thread_start + 8 (:-1)

Thread 12 name:
Thread 12:
0 libsystem_kernel.dylib 0x000000024f3f45d4 **psynch_cvwait + 8 (:-1)
1 libsystem_pthread.dylib 0x00000001fe3deb58 \_pthread_cond_wait + 984 (pthread_cond.c:862)
2 libc++.1.dylib 0x00000001b0bf3704 std::**1::condition_variable::wait(std::**1::unique_lock<std::**1::mutex>&) + 32 (condition_variable.cpp:30)
3 hermes 0x0000000103824e98 void std::**1::condition_variable::wait<hermes::vm::HadesGC::Executor::worker()::'lambda'()>(std::**1::unique_lock<std::**1::mutex>&, hermes::vm::HadesGC::Executor::worker()::'lambda'()) + 28 (**mutex_base:400)
4 hermes 0x0000000103824e98 hermes::vm::HadesGC::Executor::worker() + 116 (HadesGC.cpp:1062)
5 hermes 0x0000000103824e00 hermes::vm::HadesGC::Executor::Executor()::'lambda'()::operator()() const + 4 (HadesGC.cpp:1033)
6 hermes 0x0000000103824e00 decltype(std::declval<hermes::vm::HadesGC::Executor::Executor()::'lambda'()>()()) std::**1::**invoke[abi:v160006]<hermes::vm::HadesGC::Executor::Executor()::'lambda'()>(hermes::vm::HadesGC::Executo... + 4 (invoke.h:394)
7 hermes 0x0000000103824e00 void std::**1::**thread_execute[abi:v160006]<std::**1::unique_ptr<std::**1::**thread_struct, std::**1::default_delete<std::**1::**thread_struct>>, hermes::vm::HadesGC::Executor::Executor()::'lambda... + 4 (thread:288)
8 hermes 0x0000000103824e00 void\* std::**1::**thread_proxy[abi:v160006]<std::**1::tuple<std::**1::unique_ptr<std::**1::**thread_struct, std::**1::default_delete<std::**1::\_\_thread_struct>>, hermes::vm::HadesGC::Executor::Exec... + 44 (thread:299)
9 libsystem_pthread.dylib 0x00000001fe3e044c \_pthread_start + 136 (pthread.c:931)
10 libsystem_pthread.dylib 0x00000001fe3dc8cc thread_start + 8 (:-1)

Thread 7 crashed with ARM Thread State (64-bit):
x0: 0x0000000000000000 x1: 0x0000000000000000 x2: 0x0000000000000000 x3: 0x0000000000000000
x4: 0xfffffffffb0890ba x5: 0x000000000000001a x6: 0xffffffffbfc007ff x7: 0xfffff0003ffff800
x8: 0xcfe741030dae3ae7 x9: 0xcfe7410260cccae7 x10: 0x0000000000000002 x11: 0x0000010000000000
x12: 0x00000000fffffffd x13: 0x0000000000000000 x14: 0x0000000000000000 x15: 0x0000000000000000
x16: 0x0000000000000148 x17: 0x000000016d62f000 x18: 0x0000000000000000 x19: 0x0000000000000006
x20: 0x0000000000003813 x21: 0x000000016d62f0e0 x22: 0x434c4e47432b2b00 x23: 0x0000000108fd93a0
x24: 0x0000000108c2af40 x25: 0x0000000000000000 x26: 0x0000000000000000 x27: 0x0000000000000000
x28: 0x0000000000000114 fp: 0x000000016d62e6a0 lr: 0x00000001fe3e3810
sp: 0x000000016d62e680 pc: 0x000000024f3f90cc cpsr: 0x40000000
esr: 0x56000080 (Syscall)

Binary Images:
0x102ba0000 - 0x1032d7fff DockWalker arm64 <b720d53285b135b68e4ce4bd3b9d50b8> /var/containers/Bundle/Application/5200E4EB-9D62-4915-9C9D-0FFD257B2697/DockWalker.app/DockWalker
0x1035c0000 - 0x1035cbfff libobjc-trampolines.dylib arm64e <1954b963897d321f88be880ecef5b408> /private/preboot/Cryptexes/OS/usr/lib/libobjc-trampolines.dylib
0x103758000 - 0x103957fff hermes arm64 <ddeaa448cc23352b971f95956d8b97aa> /private/var/containers/Bundle/Application/5200E4EB-9D62-4915-9C9D-0FFD257B2697/DockWalker.app/Frameworks/hermes.framework/hermes
0x19e7e0000 - 0x19e831b5f libobjc.A.dylib arm64e <4358daf977583542a1e19f185534a911> /usr/lib/libobjc.A.dylib
0x19e862000 - 0x19e901347 dyld arm64e <7631b298c24e3532b62500a1ad73c1fd> /usr/lib/dyld
0x19e902000 - 0x19e91c6c7 libc++abi.dylib arm64e <a741ff8f8ad1315780ba476d6d990c23> /usr/lib/libc++abi.dylib
0x19eea9000 - 0x19fcefc9f Foundation arm64e <4c3912d2e14a3a21926b54bef625be89> /System/Library/Frameworks/Foundation.framework/Foundation
0x1a186f000 - 0x1a1df573f CoreFoundation arm64e <d52bceeee890347c84611537154e22d9> /System/Library/Frameworks/CoreFoundation.framework/CoreFoundation
0x1a729e000 - 0x1a96fd9bf UIKitCore arm64e <a70d8d96f3a53099901127eeb49d7be8> /System/Library/PrivateFrameworks/UIKitCore.framework/UIKitCore
0x1ad199000 - 0x1ad2195af libsystem_c.dylib arm64e <61a33aa9d6683b35a859b6925c4047b9> /usr/lib/system/libsystem_c.dylib
0x1b0bd1000 - 0x1b0c63e23 libc++.1.dylib arm64e <b5267b9b8993350586fc09e24812a29c> /usr/lib/libc++.1.dylib
0x1da593000 - 0x1da5d921f libdispatch.dylib arm64e <904d48a3d99e3962bfa9c3dfb66bba83> /usr/lib/system/libdispatch.dylib
0x1fe3dc000 - 0x1fe3e845f libsystem_pthread.dylib arm64e <4f94107b94d23e888542f5403c581b50> /usr/lib/system/libsystem_pthread.dylib
0x1fec56000 - 0x202f9be7f MetalPerformanceShadersGraph arm64e <a59319e7438b3393a428dd32f67b250e> /System/Library/Frameworks/MetalPerformanceShadersGraph.framework/MetalPerformanceShadersGraph
0x246210000 - 0x2462187ff GraphicsServices arm64e <12a401ff966436029f17f3047446e62b> /System/Library/PrivateFrameworks/GraphicsServices.framework/GraphicsServices
0x24f3ee000 - 0x24f428d2b libsystem_kernel.dylib arm64e <8d8301292cbe32a9b61ece493eecb399> /usr/lib/system/libsystem_kernel.dylib

EOF

{
"id" : "AH57AzeRXKM3FSi7CNFpLA4",
"timestamp" : "2026-03-31T20:32:15.574Z[UTC]",
"appAppleId" : 6761231147,
"cfBundleShortVersion" : "1.0.0",
"cfBundleVersion" : "23",
"deviceModel" : "iPhone18,1",
"osVersion" : "26.3",
"locale" : "en-ZA",
"carrier" : "Plus",
"timezone" : "Europe/Istanbul",
"architecture" : "arm64e",
"connectionStatus" : "WI_FI",
"pairedAppleWatch" : "",
"appUptimeMillis" : null,
"availableDiskBytes" : 131849461760,
"totalDiskBytes" : 255342497792,
"networkType" : "LTE",
"batteryPercentage" : 40,
"screenWidth" : 402,
"screenHeight" : 874,
"emailAddress" : "garethpsn12@gmail.com",
"comment" : "Crash7"
}
