package main

import (
	"encoding/json"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
)

type config struct {
	Watch string `json:"watch"`
	Root  string `json:"root"`
}

func newConfig() *config {

	jsonPath, err := filepath.Abs("config.json")
	if err != nil {
		log.Fatal("cannot find config.json")
	}

	jsonFile, err := os.Open(jsonPath)
	if err != nil {
		log.Fatal("Cannot open config.json")
	}

	bytes, err := ioutil.ReadAll(jsonFile)
	if err != nil {
		log.Fatal("cannot parse config.json")
	}

	// fmt.Println(string(bytes))

	var c config
	if err = json.Unmarshal(bytes, &c); err != nil {
		log.Fatal(err)
	}

	// fmt.Printf("Parsed config: %v\n", c)

	return &c
}
