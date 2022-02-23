(function() {

    let selectors = []
    let dd = new diffDOM.DiffDOM()

    // abort controller
    let controller = null

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

        // get dom objects from html
        const parser = new DOMParser();
        // const oldDom = parser.parseFromString(get_current_html(), "text/html");
        const newDom = parser.parseFromString(newHtml, "text/html");

        selectors.map(selector => {
            const oldEl = document.querySelector(selector);
            const newEl = newDom.querySelector(selector);
            if (oldEl && newEl) {
                const d = dd.diff(oldEl, newEl);
                dd.apply(oldEl, d);
            }
        });
    })

    ready(function() {
        // const debounced_refresh = debounce(refresh, 250)
        DEV_SYNC.eventbus.on('message', function (m) {
            if (m.type === 'CHMOD') {
                return;
            }
            selectors = m.html.selectors;
            if (m.html.extensions.includes(m.ext)) {
                refresh();
            }
        })
    });
})();
