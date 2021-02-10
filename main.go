package main

// main
func main() {
	c := newConfig()
	watch(c.Watch, c.Root)
}
