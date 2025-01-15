CC=clang
CFLAGS=-framework ApplicationServices
TARGET=mouse_tracker

$(TARGET): src/mouse_tracker.c
	$(CC) $(CFLAGS) -o $(TARGET) src/mouse_tracker.c

clean:
	rm -f $(TARGET) 
