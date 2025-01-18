#include <stdio.h>

#ifdef _WIN32
    #include <windows.h>
    HHOOK mouseHook;
#else
    #include <ApplicationServices/ApplicationServices.h>
#endif

#ifdef _WIN32
LRESULT CALLBACK MouseHookCallback(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode >= 0) {
        MSLLHOOKSTRUCT* mouseInfo = (MSLLHOOKSTRUCT*)lParam;
        
        switch (wParam) {
            case WM_MOUSEMOVE:
                printf("move,%ld,%ld\n", mouseInfo->pt.x, mouseInfo->pt.y);
                break;
            case WM_LBUTTONDOWN:
                printf("down,%ld,%ld\n", mouseInfo->pt.x, mouseInfo->pt.y);
                break;
            case WM_LBUTTONUP:
                printf("up,%ld,%ld\n", mouseInfo->pt.x, mouseInfo->pt.y);
                break;
        }
        fflush(stdout);
    }
    return CallNextHookEx(mouseHook, nCode, wParam, lParam);
}
#else
CGEventRef mouseCallback(CGEventTapProxy proxy, CGEventType type, CGEventRef event, void *refcon) {
    CGPoint location = CGEventGetLocation(event);
    
    if (type == kCGEventMouseMoved) {
        printf("move,%f,%f\n", location.x, location.y);
    } else if (type == kCGEventLeftMouseDragged) {
        printf("drag,%f,%f\n", location.x, location.y);
    } else if (type == kCGEventLeftMouseDown) {
        printf("down,%f,%f\n", location.x, location.y);
    } else if (type == kCGEventLeftMouseUp) {
        printf("up,%f,%f\n", location.x, location.y);
    }
    
    fflush(stdout);
    return event;
}
#endif

int main() {
#ifdef _WIN32
    // Windows implementation
    HINSTANCE hInstance = GetModuleHandle(NULL);
    
    mouseHook = SetWindowsHookEx(
        WH_MOUSE_LL,
        MouseHookCallback,
        hInstance,
        0
    );

    if (!mouseHook) {
        fprintf(stderr, "Failed to install mouse hook\n");
        return 1;
    }

    MSG msg;
    while (GetMessage(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }

    UnhookWindowsHookEx(mouseHook);
#else
    // macOS implementation
    CFMachPortRef eventTap = CGEventTapCreate(
        kCGSessionEventTap,
        kCGHeadInsertEventTap,
        kCGEventTapOptionDefault,
        CGEventMaskBit(kCGEventMouseMoved) | 
        CGEventMaskBit(kCGEventLeftMouseDown) | 
        CGEventMaskBit(kCGEventLeftMouseUp) |
        CGEventMaskBit(kCGEventLeftMouseDragged),
        mouseCallback,
        NULL
    );

    if (!eventTap) {
        fprintf(stderr, "Failed to create event tap\n");
        return 1;
    }

    CFRunLoopSourceRef runLoopSource = CFMachPortCreateRunLoopSource(
        kCFAllocatorDefault,
        eventTap,
        0
    );

    CFRunLoopAddSource(
        CFRunLoopGetCurrent(),
        runLoopSource,
        kCFRunLoopCommonModes
    );

    CGEventTapEnable(eventTap, true);
    CFRunLoopRun();
#endif

    return 0;
}