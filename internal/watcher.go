package devsync

import (
	"encoding/json"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/fsnotify/fsnotify"
)

// about "too many opened files on mac":
// https://github.com/fsnotify/fsnotify/issues/129
// https://gist.github.com/tombigel/d503800a282fcadbee14b537735d202c
// https://apple.stackexchange.com/questions/366187/why-does-setting-the-hard-limit-for-maxfiles-to-unlimited-using-launchctl-lim
// NOTE: ulimit file created to tackle the problem.

// if I do this the watcher is shared each time I call watch
// var watcher *fsnotify.Watcher

type fsEvent struct {
	Type string              `json:"type"`
	Path string              `json:"path"`
	Ext  string              `json:"ext"`
	Html map[string][]string `json:"html"`
}

// Watch the directory (or glob) at path and remove root_dir
// from file paths
func Watch(watch_path string, c *config, ch chan<- []byte) {

	if runtime.GOOS == "darwin" {
		increaseFileDescriptorsLimit()
	}

	root_dir := c.Root
	// fmt.Println("creating new watcher for " + path)
	// creates a new file watcher
	watcher, _ := fsnotify.NewWatcher()
	defer watcher.Close()
	// watchers = append(watchers, watcher)

	recursive := true
	root_dir, _ = filepath.Abs(root_dir)
	ext := path.Ext(watch_path)
	var watch_dir string
	if len(ext) > 0 {
		watch_dir = root_dir + path.Dir(watch_path)
	} else {
		watch_dir = root_dir + watch_path
	}

	// support **/*.ext globs
	if "**" == path.Base(watch_dir) {
		watch_dir = path.Dir(watch_dir)
	} else if len(ext) > 0 {
		// for patterns like dir/*.ext we don't recurse
		recursive = false
	}

	// check watch dir exists
	_, err := os.Stat(watch_dir)
	if err != nil {
		fmt.Println("Warning: cannot watch " + watch_path + ". Please check that it exists.")
		return
		// log.Fatal(err)
	}

	// fmt.Printf("Public dir: %v\n", root_dir)
	fmt.Printf("Watching %v ...\n", root_dir+watch_path)

	// starting at the root of the project, walk each file/directory searching for
	// directories
	if recursive {
		if err := filepath.Walk(watch_dir, recursiveWatch(watcher)); err != nil {
			fmt.Println("ERROR", err)
		}
	} else {
		watcher.Add(watch_dir)
	}

	for {
		select {
		// watch for events
		case event := <-watcher.Events:
			t := fmt.Sprint(event.Op)
			p := event.Name
			// if it's a new dir, we watch it
			if recursive && t == "CREATE" {
				i, err := os.Stat(p)
				// prevent segmentation fault errors
				if err != nil {
					continue
				}
				if i.IsDir() {
					fmt.Println("New directory created, adding watcher...")
					if err := filepath.Walk(p, recursiveWatch(watcher)); err != nil {
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
				Ext:  ext,
				Html: c.Html,
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
func recursiveWatch(watcher *fsnotify.Watcher) func(string, os.FileInfo, error) error {
	return func(path string, fi os.FileInfo, err error) error {
		if fi.Mode().IsDir() {
			return watcher.Add(path)
		}

		return nil
	}
}
