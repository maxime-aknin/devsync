package main

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"syscall"
)

// (macos) run sysctl -a | grep ^kern.max to see initial sysctl values
const MAX_FILES = 20000

// about "too many opened files on mac":
// https://github.com/fsnotify/fsnotify/issues/129
// https://gist.github.com/tombigel/d503800a282fcadbee14b537735d202c
// https://apple.stackexchange.com/questions/366187/why-does-setting-the-hard-limit-for-maxfiles-to-unlimited-using-launchctl-lim

// Execute this function instead of having to do ulimit -n MAX_FILES or creating a launch config
// this is only executed on macos, and will only apply to the devsync process (💯)
// also see: https://github.com/docker/go-units/blob/master/ulimit.go
// Note: if you have error like: "setrlimit failed invalid argument", you need to adjust launchctl limit maxfiles settings first...
// see https://elisabethirgens.github.io/notes/2019/12/ulimit-and-limit/
func increaseFileDescriptorsLimit() {

	// Ulimit is a shell builtin command to set Rlimit
	// https://man7.org/linux/man-pages/man2/setrlimit.2.html
	var uLimit syscall.Rlimit
	err := syscall.Getrlimit(syscall.RLIMIT_NOFILE, &uLimit)
	if err != nil {
		fmt.Println("Error Getting Rlimit ", err)
	}

	// cur is soft limit, max is hard limit
	if uLimit.Cur >= MAX_FILES && uLimit.Max >= MAX_FILES {
		return
	}

	mess := "soft & hard"

	// hard limit
	if isRoot() {
		if uLimit.Max < MAX_FILES {
			uLimit.Max = MAX_FILES
		}
	} else {
		mess = "soft"
		if uLimit.Max < MAX_FILES {
			fmt.Println("Cannot set a soft limit higher than the hard limit if not root.")
			os.Exit(1)
		}
	}

	// Soft limit
	if uLimit.Cur < MAX_FILES {
		uLimit.Cur = MAX_FILES
	}

	err = syscall.Setrlimit(syscall.RLIMIT_NOFILE, &uLimit)
	if err != nil {
		fmt.Printf("Error Setting Rlimit (%s): %s\n", mess, err.Error())

		// fmt.Println("Try running `sudo launchctl limit maxfiles 65000 65000` if you're on macos and retry")
		// fmt.Println("Or run with sudo")
		if err.Error() == "invalid argument" && runtime.GOOS == "darwin" {
			fmt.Println("Trying to increase launchctl limit maxfiles settings (need root permission)")
			cmd := exec.Command("/bin/sh", "-c", fmt.Sprintf("sudo launchctl limit maxfiles %d %d", MAX_FILES, MAX_FILES))
			err = cmd.Run()
			if err != nil {
				fmt.Printf("Failed to execute command. %s. Exiting...\n", err)
				os.Exit(1)
			}

			err = syscall.Setrlimit(syscall.RLIMIT_NOFILE, &uLimit)
			if err != nil {
				fmt.Println("Failed to set rlimit. Try run the command with sudo. Exiting...")
				os.Exit(1)
			}
		}
	}
}

func isRoot() bool {
	return os.Geteuid() == 0
}
