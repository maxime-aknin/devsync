// goto to chrome://inspect/#workers to see these logs
let ports = [];
let debug = false
let EventSourceSingleton = (function () {
	var instance = null;
	return {
		getInstance: function (sse_url) {
			if (!instance) {
				instance = new EventSource(sse_url);
			}
			return instance;
		},
		reset: function () {
			instance = null;
		}
	};
})();


// https://developer.mozilla.org/en-US/docs/Web/API/SharedWorkerGlobalScope/onconnect
onconnect = function(e) {
	console.log('worker connected');
	var port = e.ports[0];
	ports.push(port);
	var notifyAll = function(message){
		ports.forEach(port => port.postMessage(message));
	}
	var makeConnection = function (sse_url) {
		var source = EventSourceSingleton.getInstance(sse_url);
		source.onopen = function (e){
			console.log(e);
			port.postMessage({type: 'open' , msg: 'Connection opened !'});
		}
		source.onerror = function(e){
			console.log(e);
			port.postMessage({type: 'error' , msg: 'error connecting to server'});
			// on server disconnect, we close the connection and reset singleton
			// or as long as there are old pages with connection active, any new connection after restart won't work
			source.close();
			EventSourceSingleton.reset();
			ports.forEach(p => p.close());
		}
		source.onmessage = function(e){
			console.log(e);
			notifyAll({type: 'message' , msg: e.data});
		}
	}

	port.onmessage = function(e) {
		console.log('received init message, making connection...')
		makeConnection(e.data);
	}
	port.start(); // Required when using addEventListener. Otherwise called implicitly by onmessage setter.

}