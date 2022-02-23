.PHONY: js serve so so_js
.SILENT: start build serve js

build:
	go build -o devsync cmd/devsync/main.go

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
