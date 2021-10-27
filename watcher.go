package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/fsnotify/fsnotify"
)

// if I do this the watcher is shared each time I call watch
// var watcher *fsnotify.Watcher

type fsEvent struct {
	Type string `json:"type"`
	Path string `json:"path"`
}

// Watch the directory (or glob) at path and remove root_dir
// from file paths
func watch(glob string, root_dir string, ch chan<- []byte) {

	// fmt.Println("creating new watcher for " + glob)
	// creates a new file watcher
	watcher, _ := fsnotify.NewWatcher()
	defer watcher.Close()
	// watchers = append(watchers, watcher)

	root_dir, _ = filepath.Abs(root_dir)
	watch_dir := root_dir + path.Dir(glob)
	ext := path.Ext(glob)

	_, err := os.Stat(watch_dir)
	if err != nil {
		// todo fail without infinite loop
		// fmt.Println("Warning: cannot watch directory " + path + ". Please check that it exists.")
		// return
		log.Fatal(err)
	}
	// fmt.Printf("Public dir: %v\n", root_dir)
	fmt.Printf("Watching %v ...\n", root_dir+glob)

	// starting at the root of the project, walk each file/directory searching for
	// directories
	if err := filepath.Walk(watch_dir, recursiveWatchDir(watcher)); err != nil {
		fmt.Println("ERROR", err)
	}

	for {
		select {
		// watch for events
		case event := <-watcher.Events:
			t := fmt.Sprint(event.Op)
			p := event.Name
			// if it's a new dir, we watch it
			if t == "CREATE" {
				i, _ := os.Stat(p)
				if i.IsDir() {
					fmt.Println("New directory created, adding watcher...")
					if err := filepath.Walk(p, recursiveWatchDir(watcher)); err != nil {
						fmt.Println("ERROR", err)
					}
				}
			}

			// if a glob was provided, we check that the file matches
			if len(ext) > 0 && filepath.Ext(p) != ext {
				// fmt.Println("skipping path " + p + " cause the extension does not match " + ext)
				continue
			}

			e := &fsEvent{
				Type: t,
				Path: strings.Replace(p, root_dir, "", 1),
			}
			serialized, _ := json.Marshal(e)
			fmt.Println(string(serialized))
			ch <- serialized

		// watch for errors
		case err := <-watcher.Errors:
			fmt.Println("ERROR", err)
		}
	}
}

// watchDir gets run as a walk func, searching for directories to add watchers to
// since fsnotify can watch all the files in a directory, watchers only need
// to be added to each nested directory
func recursiveWatchDir(watcher *fsnotify.Watcher) func(string, os.FileInfo, error) error {
	return func(path string, fi os.FileInfo, err error) error {
		if fi.Mode().IsDir() {
			return watcher.Add(path)
		}

		return nil
	}
}
