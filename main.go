package main

import (
	"gile/go-sync/file_watcher"
)

//

// main
func main() {
	c := newConfig()
	file_watcher.Watch(c.Watch, c.Root)
}
