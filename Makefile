.SILENT: start build serve js

build:
	go build -o bin/devsync *.go

start: build
	./bin/devsync

serve:
	# you must have symfony cli installed
	symfony serve --dir=public	

js:
	echo "bundling js files..."
	rm -f public/dist/bundle.js
	mkdir -p public/dist
	touch public/dist/sync-bundle.js
	# concat cli
	npx concat-cli -f public/js/src/* -o public/dist/sync-bundle.js
	# babel-minify
	npx minify public/dist/sync-bundle.js -o public/dist/sync-bundle.min.js
