.PHONY: js serve so so_js
.SILENT: start build serve js so so_js

build:
	go build -o bin/devsync *.go

start: build
	./bin/devsync

serve:
	# you must have symfony cli installed
	symfony serve --dir=public	

js:
	echo "bundling js files..."
	rm -rf public/dist
	mkdir -p public/dist
	touch public/dist/sync-bundle.js
	# concat cli
	npx concat-cli -f js/* -o public/dist/sync-bundle.js
	# babel-minify
	npx minify public/dist/sync-bundle.js -o public/dist/sync-bundle.min.js

so: build
	cp bin/devsync ../sport-orthese/bin/

so_js: js
	cp public/dist/sync-bundle.min.js ../sport-orthese/prestashop/modules/max_devsync/views/js
	cp public/dist/sync-bundle.js ../sport-orthese/prestashop/modules/max_devsync/views/js

