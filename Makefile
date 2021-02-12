.SILENT: start build serve js

build:
	go build *.go

start: build
	./dev-sync

serve:
	# you must have symfony cli installed
	symfony serve --dir=public	

js:
	rm public/dist/compiled/*
	rm public/dist/bundle.js
	# babel-minify
	minify public/js/src -d public/dist/compiled
	# concat cli
	concat-cli -f public/dist/compiled/* -o public/dist/bundle.js