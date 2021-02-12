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
        }
    };
})();


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
			console.log(e)
            var message = "Connection open"
            port.postMessage({type: 'open' , msg: 'Connection open'});
        }
        source.onerror = function(e){
			console.log(e)
            port.postMessage({type: 'error' , msg: e});
        }
        source.onmessage = function(e){
			console.log(e)
            // var message = JSON.parse(event.data);
            notifyAll({type: 'message' , msg: e.data});
        }
    }

    port.onmessage = function(e) {
		console.log('received init message, making connection...')
        makeConnection(e.data);
    }
    port.start(); // Required when using addEventListener. Otherwise called implicitly by onmessage setter.
}