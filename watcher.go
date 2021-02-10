package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/fsnotify/fsnotify"
	"github.com/r3labs/sse/v2"
)

var watcher *fsnotify.Watcher

type fsEvent struct {
	Type string `json:"type"`
	Path string `json:"path"`
}

// Watch the directory at path and remove root_dir
// from file paths
func watch(path string, root_dir string, server *sse.Server) {

	// creates a new file watcher
	watcher, _ = fsnotify.NewWatcher()
	defer watcher.Close()

	root_dir, _ = filepath.Abs(root_dir)
	path, _ = filepath.Abs(path)
	_, err := os.Stat(path)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Root dir is %v\n", root_dir)
	fmt.Printf("Watching %v...\n", path)

	// starting at the root of the project, walk each file/directory searching for
	// directories
	if err := filepath.Walk(path, watchDir); err != nil {
		fmt.Println("ERROR", err)
	}

	done := make(chan bool)

	go func() {
		for {
			select {
			// watch for events
			case event := <-watcher.Events:
				t := fmt.Sprint(event.Op)
				p := event.Name
				// if it's a new dir, we watch it
				if "CREATE" == t {
					i, _ := os.Stat(p)
					if i.IsDir() {
						fmt.Println("New directory created, adding watcher...")
						if err := filepath.Walk(p, watchDir); err != nil {
							fmt.Println("ERROR", err)
						}
					}
				}

				e := &fsEvent{
					Type: t,
					Path: strings.Replace(p, root_dir, "", 1),
				}
				serialized, _ := json.Marshal(e)
				fmt.Println(string(serialized))
				server.Publish("messages", &sse.Event{
					Data: serialized,
				})

			// watch for errors
			case err := <-watcher.Errors:
				fmt.Println("ERROR", err)
			}
		}
	}()

	<-done

}

// watchDir gets run as a walk func, searching for directories to add watchers to
func watchDir(path string, fi os.FileInfo, err error) error {
	// since fsnotify can watch all the files in a directory, watchers only need
	// to be added to each nested directory
	if fi.Mode().IsDir() {
		return watcher.Add(path)
	}

	return nil
}
