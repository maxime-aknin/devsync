(function () {
	const log = DEV_SYNC.debug ? console.log : () => {};
	// using a shared worker allows to bypass browser limitations to 6 connections
	const worker = new SharedWorker(DEV_SYNC.worker);
	
	worker.port.start();
	worker.port.onmessage = function(event) {
		log('Message', event.data);
		if ('error' === event.data.type) {
			console.warn('Dev sync server connection error. Start or restart the server and reload the page if needed.');
			return;
		}
		if ('message' !== event.data.type) {
			return;
		}
		const json = JSON.parse(event.data.msg);
		// ignore temp files
		if (-1 !== json.path.indexOf('~')) {
			log('ignored')
			return;
		}
		DEV_SYNC.eventbus.emit('message', json);
	}
	
	// initialize the worker, localhost does not seem to work in sse url in worker, figure out why
	worker.port.postMessage(DEV_SYNC.stream);
})();


