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
	// do not replay each messages on new connection
	server.AutoReplay = false
	server.CreateStream("messages")
	mux := http.NewServeMux()
	mux.HandleFunc("/events", server.HTTPHandler)

	messages := make(chan []byte)
	go func() {
		for {
			msg := <-messages
			server.Publish("messages", &sse.Event{
				Data: msg,
			})
		}
	}()
	go watch(c.Watch, c.Root, messages)

	fmt.Println("SSE server running on port 8123...")
	log.Fatal(http.ListenAndServe(":8123", mux))
}
