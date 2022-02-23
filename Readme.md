# Dev Sync

the plan is to use SSE to have a performant and stable hot reloading solution for development.

## Too many file error

Run devsync with `sudo` in case you see this error. Alternatively you can edit the currents 
limits by using the `ulimit` command ([setrlimit][1] wrapper). See `ulimit.go` for more infos.


[1]: https://man7.org/linux/man-pages/man2/setrlimit.2.html
