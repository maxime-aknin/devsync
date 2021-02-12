
build:
	go build *.go

js:
	rm public/dist/compiled/*
	rm public/dist/bundle.js
	# babel-minify
	minify public/js/src -d public/dist/compiled
	# concat cli
	concat-cli -f public/dist/compiled/* -o public/dist/bundle.js