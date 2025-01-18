# Use gcc.exe on Windows with MINGW64
ifeq ($(OS),Windows_NT)
    CC = gcc.exe
    LIBS = -luser32
    TARGET = mouse_tracker.exe
    RM = rm -f
else
    CC = gcc
    UNAME_S := $(shell uname -s)
    ifeq ($(UNAME_S),Darwin)
        LIBS = -framework ApplicationServices
        TARGET = mouse_tracker
        RM = rm -f
    else
        # Linux case if needed in future
        TARGET = mouse_tracker
        RM = rm -f
    endif
endif

CFLAGS = -Wall

.PHONY: all clean

all: $(TARGET)

$(TARGET): src/mouse_tracker.c
	$(CC) $(CFLAGS) src/mouse_tracker.c -o $(TARGET) $(LIBS)

clean:
	-$(RM) $(TARGET)