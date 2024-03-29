package main

import (
	. "fmt"
	"log"
	devsync "max/devsync/internal"
	"net/http"

	"github.com/r3labs/sse/v2"
)

// main
func main() {

	c := devsync.NewConfig()

	server := sse.New()
	// do not replay each messages on new connection
	server.AutoReplay = false
	server.CreateStream("messages")
	mux := http.NewServeMux()
	mux.HandleFunc("/events", server.HTTPHandler)

	for _, glob := range c.Paths {
		messages := make(chan []byte)
		go handleMessages(server, messages)
		// Println("Watching: " + c.Root + glob)
		go devsync.Watch(glob, c, messages)
	}

	Printf("Server running on port %d...\n", c.Port)
	log.Fatal(http.ListenAndServe(Sprintf(":%d", c.Port), mux))
}

func handleMessages(server *sse.Server, ch <-chan []byte) {
	for msg := range ch {
		server.Publish("messages", &sse.Event{
			Data: msg,
		})
	}
}
