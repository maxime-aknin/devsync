.SILENT: start build serve js

build:
	go build -o bin/devsync *.go

start: build
	./bin/devsync

serve:
	# you must have symfony cli installed
	symfony serve --dir=public	

js:
	rm -f public/dist/bundle.js
	# concat cli
	concat-cli -f public/js/src/* -o public/dist/sync-bundle.js
	# babel-minify
	minify public/dist/bundle.js -o public/dist/sync-bundle.min.js