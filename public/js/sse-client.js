const evtSource = new EventSource("http://localhost:8123/events?stream=messages");
const eventList = document.getElementById("messages-list");

evtSource.onmessage = function(event) {
	const newElement = document.createElement("li");
	const json = JSON.parse(event.data)
	console.log('new message', event)
	newElement.innerHTML = `
	<pre>${JSON.stringify(json, null, 2)}</pre>
	`
	eventList.appendChild(newElement);
}