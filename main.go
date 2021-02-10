package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/r3labs/sse/v2"
)

// main
func main() {
	c := newConfig()

	server := sse.New()
	server.CreateStream("messages")

	mux := http.NewServeMux()
	mux.HandleFunc("/events", server.HTTPHandler)

	go func() {
		watch(c.Watch, c.Root, server)
	}()

	fmt.Println("SSE server running on port 8123...")
	log.Fatal(http.ListenAndServe(":8123", mux))
}
