.PHONY: js serve so so_js release
.SILENT: start build serve js release

build:
	go build -o devsync cmd/devsync/main.go

release:
	mkdir -p release
	GOOARCH=arm64 GOOS=darwin go build -ldflags "-s -w" -o ./release/devsync cmd/devsync/main.go
	(cd ./release; tar czf devsync_darwin_arm64.tar.gz devsync; rm devsync)
	GOOARCH=amd64 GOOS=darwin go build -ldflags "-s -w" -o ./release/devsync cmd/devsync/main.go
	(cd ./release; tar czf devsync_darwin_amd64.tar.gz devsync; rm devsync)
	GOOARCH=arm64 GOOS=linux go build -ldflags "-s -w" -o ./release/devsync cmd/devsync/main.go
	(cd ./release; tar czf devsync_linux_arm64.tar.gz devsync; rm devsync)
	GOOARCH=amd64 GOOS=linux go build -ldflags "-s -w" -o ./release/devsync cmd/devsync/main.go
	(cd ./release; tar czf devsync_linux_amd64.tar.gz devsync; rm devsync)
	GOOARCH=amd64 GOOS=windows go build -ldflags "-s -w" -o ./release/devsync cmd/devsync/main.go
	(cd ./release; tar czf devsync_windows_amd64.tar.gz devsync; rm devsync)

start: build
	./devsync

serve:
	# you must have symfony cli installed
	symfony serve --dir=web	

js:
	echo "bundling js files..."
	rm -rf web/dist
	mkdir web/dist
	touch web/dist/sync-bundle.js
	# concat cli
	node web/node_modules/.bin/concat-cli -f web/js/* -o web/dist/sync-bundle.js
	# babel-minify
	node web/node_modules/.bin/babel-minify web/dist/sync-bundle.js -o web/dist/sync-bundle.min.js
