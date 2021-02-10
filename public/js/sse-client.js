const evtSource = new EventSource("http://127.0.0.1:8123/events?stream=messages");

evtSource.onmessage = function(event) {
	const newElement = document.createElement("li");
	const eventList = document.getElementById("list");

	newElement.textContent = "message: " + event.data;
	eventList.appendChild(newElement);
}