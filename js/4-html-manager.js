(function() {

    let dd = new diffDOM.DiffDOM()
    // abort controller
    let controller = null

    const get_current_html = (sep = "\n") => {

        let html = "";
        let xml = new XMLSerializer();
        for (let n of document.childNodes) {
            if (n.nodeType == Node.ELEMENT_NODE)
                html += n.outerHTML + sep;
            else
                html += xml.serializeToString(n) + sep;
        }
        return html;
    }


    const refresh = debounce(() => {
        controller && controller.abort();
        controller = new AbortController();
        var signal = controller.signal;

        fetch(window.location.href, {signal}).then(response => {
            controller = null;
            response.text().then(diff)
        })
        .catch(e => {
            // console.error('Error refreshing page.', e)
            controller = null;
        })

    });

    const diff = debounce(newHtml => {
        const oldHtml = get_current_html()
        const d = dd.diff(oldHtml, newHtml)
        console.log(d)
    })

    ready(function() {
        // const debounced_refresh = debounce(refresh, 250)
        DEV_SYNC.eventbus.on('message', function (m) {
            // refresh_list.set(m.path, m.type)
            // debounced_refresh()
            if (DEV_SYNC.html_extensions.includes(m.ext)) {
                refresh()
            }
        })
    });
})();
