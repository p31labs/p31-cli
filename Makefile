BINARY_NAME=p31
VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS := -s -w -X github.com/p31labs/p31-cli/cmd.version=$(VERSION)

.PHONY: build run clean install

build:
	@echo "Compiling optimized Go binary..."
	go build -ldflags="$(LDFLAGS)" -o $(BINARY_NAME) .

run: build
	./$(BINARY_NAME)

clean:
	rm -f $(BINARY_NAME)

install: build
	@echo "Hijacking ~/.local/bin/p31 namespace..."
	mkdir -p $(HOME)/.local/bin
	rm -f $(HOME)/.local/bin/$(BINARY_NAME)
	cp -f $(BINARY_NAME) $(HOME)/.local/bin/$(BINARY_NAME)
	chmod +x $(HOME)/.local/bin/$(BINARY_NAME)
	@echo "P31 God-Mode CLI deployed successfully."
