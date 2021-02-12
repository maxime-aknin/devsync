(function () {
    const log = DEV_SYNC.debug ? console.log : () => {};
    let initial_stylesheets = []
    let refresh_list = new Map()

    // remove host and params
    function sanitizeHref(href) {
        href = href.replace(window.location.origin, '')
        href = href.split('?')[0]
        return href
    }

    function getStyle(href) {
        for (let s of document.styleSheets) {
            if (s.href && href === sanitizeHref(s.href)) {
                return s
            }
        }
    }

    function deleteStyle (href) {
        s = getStyle(href) && s.remove()
    }

    function updateStyle (href) {
        s = getStyle(href)
        // console.log('UPDATE', s)
        if (s) {
            s.ownerNode.href = href + '?v=' + uniqid()
        }
        // recreate it if it was initially on the page
        else if (-1 !== initial_stylesheets.indexOf(href)) {
            let link = document.createElement('link')
            link.href = href
            link.rel = 'stylesheet'
            document.head.appendChild(link)
        }
        else {
            log('stylesheet detected, but not loaded')
        }
    }

    function refresh () {
        log('REFRESHING STYLESHEETS', refresh_list)
        refresh_list.forEach((t, href) => {
            console.log(t, href)
            t === 'REMOVE' ? deleteStyle(href) : updateStyle(href)
            refresh_list.delete(href)
        })
    }

    ready(function() {
        for (let s of document.styleSheets) {
            s.href && initial_stylesheets.push(sanitizeHref(s.href))
        }
        const debounced_refresh = debounce(refresh, 250)
        DEV_SYNC.eventbus.on('message', function (m) {
            refresh_list.set(m.path, m.type)
            debounced_refresh()
        })

    });
})();