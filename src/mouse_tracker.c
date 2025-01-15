#include <ApplicationServices/ApplicationServices.h>
#include <stdio.h>
#include <unistd.h>

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

int main() {
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

    return 0;
} 
