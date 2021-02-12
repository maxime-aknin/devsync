const debug = true;
const log = debug ? console.log : () => {};
const eventList = document.getElementById("messages-list");
// using a shared worker allows to bypass browser limitations to 6 connections
const worker = new SharedWorker('/js/shared_worker.js');

worker.port.start();
worker.port.onmessage = function(event) {
	log('Message', event.data);
	if ('message' !== event.data.type) {
		return;
	}
	const newElement = document.createElement("li");
	const json = JSON.parse(event.data.msg);
    // ignore temp files
    if (-1 !== json.path.indexOf('~')) {
        console.log('ignored')
        return;
    }
    window.eventbus.emit('message', json);
	newElement.innerHTML = `
	<pre>${JSON.stringify(json, null, 2)}</pre>
	`
	eventList.appendChild(newElement);
}

// initialize the worker, localhost does not seem to work in sse url in worker, figure out why
worker.port.postMessage('http://127.0.0.1:8123/events?stream=messages');
