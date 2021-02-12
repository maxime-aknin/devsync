package main

import (
	"encoding/json"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"strings"
)

type config struct {
	Watch string `json:"watch"`
	Root  string `json:"root"`
	Port  int    `json:"port"`
}

func newConfig() *config {

	// config file can be in the same dir or in parent dir
	use_parent_dir := false
	jsonPath, err := filepath.Abs("devsync.json")
	if err != nil {
		jsonPath, err = filepath.Abs("../devsync.json")
		use_parent_dir = true
		if err != nil {
			log.Fatal("Cannot find config file")
		}
	}

	jsonFile, err := os.Open(jsonPath)
	if err != nil {
		log.Fatal("Cannot open config file")
	}

	bytes, err := ioutil.ReadAll(jsonFile)
	if err != nil {
		log.Fatal("cannot parse config file")
	}

	// fmt.Println(string(bytes))
	var c config
	if err = json.Unmarshal(bytes, &c); err != nil {
		log.Fatal(err)
	}
	// fmt.Printf("Parsed config: %v\n", c)

	// if we use parent dir and root path is relative, we need to prepent root with ../
	if use_parent_dir && 0 != strings.Index(c.Root, "/") {
		c.Root = "../" + c.Root
	}

	// add a / at beginning of path if needed
	if 0 != strings.Index(c.Watch, "/") {
		c.Watch = "/" + c.Watch
	}

	return &c
}
